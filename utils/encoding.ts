// Helper functions to correctly handle conversion between binary data (ArrayBuffer/Uint8Array)
// and Base64 strings. This is crucial for storing binary crypto data in string-based
// storage like JSON or in-memory objects that might be stringified.

/**
 * Converts an ArrayBuffer or Uint8Array to a Base64 string.
 * @param buffer The buffer to convert.
 * @returns A Base64 encoded string.
 */
export function toBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  // Use global btoa which is available in both window and worker contexts
  return btoa(binary);
}

/**
 * Converts a Base64 string to a Uint8Array.
 * @param base64 The Base64 string to convert.
 * @returns A Uint8Array.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  try {
    // Use global atob which is available in both window and worker contexts
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    console.error("Failed to decode base64 string:", base64, e);
    throw new Error("Invalid Base64 string provided for decoding.");
  }
}

/**
 * Converts a Base64 string to an ArrayBuffer.
 * @param base64 The Base64 string to convert.
 * @returns An ArrayBuffer.
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const uint8Array = base64ToUint8Array(base64);
    return uint8Array.buffer;
}


/**
 * Converts a hex string to a Uint8Array.
 * @param hex The hex string to convert.
 * @returns A Uint8Array.
 */
export function hexToUint8Array(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("Invalid hex string: must have an even number of characters.");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Converts an ArrayBuffer or Uint8Array to a hex string.
 * @param buffer The buffer to convert.
 * @returns A hex encoded string.
 */
export function toHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}


/**
 * Ensures the salt is a Uint8Array, converting from Base64 if it's a string.
 * @param salt The salt as a Base64 string or a Uint8Array.
 * @returns A Uint8Array.
 */
export function ensureUint8ArraySalt(salt: Uint8Array | string): Uint8Array {
  if (typeof salt === 'string') {
    // The application exclusively uses Base64 for storing salts.
    // The previous heuristic to detect hex was buggy, causing login failures
    // for valid Base64 salts that happened to only contain hex characters.
    return base64ToUint8Array(salt);
  }
  return salt;
}