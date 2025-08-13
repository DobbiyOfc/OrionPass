import { Item, EncryptedItem, ProtectedUserKeySet, LoginItem, NoteItem } from '../types';
import { toBase64, base64ToArrayBuffer, base64ToUint8Array, ensureUint8ArraySalt } from '../utils/encoding';
import { argon2id } from '@noble/hashes/argon2';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';

// Argon2id parameters - Increased time cost for better security against brute-force attacks.
const ARGON2_TIME_COST = 3; // Increased from 1 to 3
const ARGON2_MEMORY_COST = 65536; // 64 MiB in KiB
const ARGON2_PARALLELISM = 4;
const ARGON2_HASH_LENGTH = 32; // 32 bytes for a 256-bit key

// PBKDF2 fallback parameters - OWASP recommendation
const PBKDF2_ITERATIONS = 310000;
const PBKDF2_HASH = 'SHA-256';

const SALT_LENGTH = 16; // 128 bits
const IV_LENGTH = 12; // 96 bits for AES-GCM

const generateSalt = (): Uint8Array => {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
};

// Derives a key from a password using Argon2id for hashing and HKDF for key derivation.
const deriveKeyFromPassword = async (password: string, salt: Uint8Array | string): Promise<CryptoKey> => {
    const saltBytes = ensureUint8ArraySalt(salt);
    const passwordBytes = new TextEncoder().encode(password);

    try {
        // --- Step 1: Argon2id for password hashing (Primary KDF) ---
        // This is the preferred, more secure method for turning a user password into a secret.
        const masterSecret = argon2id(passwordBytes, saltBytes, {
            t: ARGON2_TIME_COST,
            m: ARGON2_MEMORY_COST,
            p: ARGON2_PARALLELISM,
            dkLen: ARGON2_HASH_LENGTH,
        });

        // --- Step 2: HKDF for key separation (Secondary KDF) ---
        // Using HKDF is a security best practice. It takes the strong, but generic, secret from Argon2
        // and derives a new key specifically for one purpose (in this case, wrapping other keys).
        // The 'info' parameter ensures that if we need another key for a different purpose later,
        // it will be cryptographically separate from this one.
        const info = new TextEncoder().encode('orion-vault-aes-kw-wrapping-key');
        const wrappingKeyBytes = hkdf(sha256, masterSecret, saltBytes, info, ARGON2_HASH_LENGTH);

        // Import the final wrapping key for use with AES-KW to wrap/unwrap the main encryption key
        return await crypto.subtle.importKey(
            'raw',
            wrappingKeyBytes,
            { name: 'AES-KW' },
            false, // The wrapping key is not exportable for better security
            ['wrapKey', 'unwrapKey']
        );
    } catch (e) {
        // --- Fallback Method: PBKDF2 via Web Crypto API ---
        // This acts as a safety net. While @noble/hashes is very reliable, this ensures
        // functionality in any unexpected edge case where the Argon2id implementation might fail.
        console.warn("Argon2id derivation failed, falling back to PBKDF2. Error:", e);
        
        try {
            const masterKey = await crypto.subtle.importKey(
                'raw',
                passwordBytes,
                { name: 'PBKDF2' },
                false,
                ['deriveKey']
            );

            return await crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: saltBytes,
                    iterations: PBKDF2_ITERATIONS,
                    hash: PBKDF2_HASH,
                },
                masterKey,
                { name: 'AES-KW', length: 256 },
                false,
                ['wrapKey', 'unwrapKey']
            );
        } catch (pbkdf2Error) {
            console.error("Critical error: PBKDF2 fallback also failed.", pbkdf2Error);
            throw new Error("A critical security component failed to initialize. Please try again.");
        }
    }
};

// Generates the user's main symmetric key for entry encryption/decryption
const generateUserKey = async (): Promise<CryptoKey> => {
    return crypto.subtle.generateKey(
        {
            name: 'AES-GCM',
            length: 256,
        },
        true, // extractable
        ['encrypt', 'decrypt']
    );
};

// Encrypts (wraps) the user's main symmetric key with a key derived from their master password.
const protectUserKey = async (masterPassword: string, userKey: CryptoKey): Promise<{ keys: ProtectedUserKeySet, salt: string }> => {
    const salt = generateSalt();
    const wrappingKey = await deriveKeyFromPassword(masterPassword, salt);
    
    // We encrypt the user's symmetric key. This is stored as "encryptedPrivateKey" for compatibility
    // with the existing data structure that was designed for an asymmetric key pair.
    const encryptedPrivateKeyBuffer = await crypto.subtle.wrapKey(
        'raw', // Use 'raw' format for AES-KW compatibility
        userKey,
        wrappingKey,
        'AES-KW'
    );
    
    // The 'publicKey' field is a remnant of a previous asymmetric design and is not used.
    // We'll store an empty object to satisfy the data structure.
    const publicKey: JsonWebKey = {};

    // Convert binary data to Base64 strings for safe storage/serialization
    const encryptedPrivateKey = toBase64(encryptedPrivateKeyBuffer);
    const saltBase64 = toBase64(salt);

    return { 
        keys: { publicKey, encryptedPrivateKey },
        salt: saltBase64
    };
};

const unprotectPrivateKey = async (masterPassword: string, saltBase64: string, encryptedPrivateKeyBase64: string): Promise<CryptoKey> => {
    const encryptedPrivateKey = base64ToArrayBuffer(encryptedPrivateKeyBase64);

    // deriveKeyFromPassword now accepts the Base64 salt string directly
    const wrappingKey = await deriveKeyFromPassword(masterPassword, saltBase64);
    try {
        // We unwrap the main symmetric key, which was stored in the "encryptedPrivateKey" field.
        return await crypto.subtle.unwrapKey(
            'raw', // The key was wrapped in 'raw' format
            encryptedPrivateKey,
            wrappingKey,
            'AES-KW',
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
    } catch(e) {
        console.error("Failed to unwrap private key. Master password may be incorrect.", e);
        throw new Error("Invalid master password.");
    }
};

const encryptItem = async (entry: Omit<LoginItem, 'id' | 'UUID_Identifier' | 'createdAt' | 'updatedAt'> | Omit<NoteItem, 'id' | 'UUID_Identifier' | 'createdAt' | 'updatedAt'>, key: CryptoKey): Promise<{ encryptedData: ArrayBuffer, nonce: Uint8Array }> => {
    const enc = new TextEncoder();
    const dataToEncrypt = JSON.stringify(entry);
    const nonce = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: nonce,
      },
      key,
      enc.encode(dataToEncrypt)
    );
    return { encryptedData, nonce };
};

const decryptItem = async (encryptedEntry: EncryptedItem, key: CryptoKey): Promise<Item> => {
    const dec = new TextDecoder();
    try {
      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: encryptedEntry.nonce,
        },
        key,
        encryptedEntry.encryptedData
      );
      const decryptedJson = dec.decode(decrypted);
      const decryptedData = JSON.parse(decryptedJson);
      
      return {
          ...decryptedData,
          id: encryptedEntry.id,
          UUID_Identifier: encryptedEntry.UUID_Identifier,
          createdAt: encryptedEntry.createdAt,
          updatedAt: encryptedEntry.updatedAt,
      } as Item;
    } catch (e) {
      console.error("Decryption failed:", e);
      throw new Error("Failed to decrypt data. The key may be incorrect or the data corrupted.");
    }
};

// Generates a cryptographically random password
const generatePassword = (length: number, useNumbers: boolean, useSymbols: boolean): string => {
    let charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (useNumbers) charset += '0123456789';
    if (useSymbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';

    const randomValues = new Uint32Array(length);
    crypto.getRandomValues(randomValues);

    let password = '';
    for (let i = 0; i < length; i++) {
        password += charset[randomValues[i] % charset.length];
    }
    return password;
};


export const cryptoService = {
  deriveKeyFromPassword,
  generateUserKey,
  protectUserKey,
  unprotectPrivateKey,
  encryptItem,
  decryptItem,
  generatePassword
};