

export interface Vault {
  id: number;
  name: string;
  icon?: string;
}

export type ItemType = 'login' | 'note';

export interface BaseItem {
  id: number; // The numeric ID from the server, used in URLs
  UUID_Identifier: string; // The UUID, used in request bodies
  vaultId: number;
  type: ItemType;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface LoginItem extends BaseItem {
  type: 'login';
  username: string;
  password?: string;
  url: string;
  notes: string;
}

export interface NoteItem extends BaseItem {
  type: 'note';
  notes: string;
}

export type Item = LoginItem | NoteItem;

export interface EncryptedItem {
  id: number; // The numeric ID from the server
  UUID_Identifier: string; // The UUID for the item
  vaultId: number;
  encryptedData: ArrayBuffer;
  nonce: Uint8Array;
  createdAt: number;
  updatedAt: number;
}

// Data as stored on the "server"
export interface ProtectedUserKeySet {
  publicKey: JsonWebKey;
  encryptedPrivateKey: string; // Encrypted with user's master key, stored as Base64
}

export interface User {
  id: number;
  email: string;
  encryptedPrivateKey: string;
  publicKey: JsonWebKey;
  salt: string; // Stored as Base64
  items: EncryptedItem[];
  vaults: Vault[];
}

export interface Session {
  userId: number;
  email: string;
  // This is the user's main private key, decrypted and held in memory for the session
  decryptedPrivateKey: CryptoKey;
  vaults: Vault[];
  salt: string; // Stored as Base64
  encryptedPrivateKey: string; // Stored as Base64
}

// API Payloads and Responses
export interface RegisterPayload {
    email: string;
    keys: ProtectedUserKeySet;
    salt: string; // Stored as Base64
}

export interface LoginPayload {
    email:string;
}


// The response from the /auth/login endpoint.
export interface LoginResponse {
  token: string;
  user: {
    id: number;
    email: string;
    encrypted_private_key: string;
    public_key: JsonWebKey;
    salt: string;
  };
  // The backend returns the raw items which will be mapped client-side
  items: any[]; 
  vaults: Vault[];
}


// Log types
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  timestamp: number;
  message: string;
  level: LogLevel;
  source?: string;
}