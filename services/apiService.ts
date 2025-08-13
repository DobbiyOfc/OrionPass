import { RegisterPayload, LoginPayload, LoginResponse, EncryptedItem, Vault, LogLevel } from '../types';
import { toBase64, base64ToArrayBuffer, base64ToUint8Array } from '../utils/encoding';

let authToken: string | null = null;

/**
 * Stores the authentication token in memory for the current session.
 * @param token The auth token from the server.
 */
export const setAuthToken = (token: string) => {
    authToken = token;
};

/**
 * Clears the in-memory authentication token.
 */
export const clearAuthToken = () => {
    authToken = null;
};


// The base URLs for the API. Replace these with your own backend endpoint.
// It's recommended to use environment variables for this in a real deployment.
const API_BASE = 'https://your-backend-api.com/api/auth'; // For auth endpoints
const DATA_API_BASE = 'https://your-backend-api.com/api/data'; // For data endpoints


const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (id: string | null | undefined): boolean => {
    if (!id) return false;
    return uuidRegex.test(id);
};

/**
 * Maps a raw item object from the server to the client-side EncryptedItem interface.
 * Handles backward compatibility for old items that may not have a UUID.
 * @param item The raw item object from the API.
 * @returns An `EncryptedItem` object.
 */
const mapServerItem = (item: any): EncryptedItem => {
    if (!item || typeof item.id === 'undefined' || typeof item.vault_id === 'undefined' || !item.encrypted_data || !item.nonce) {
        console.error("Invalid item structure received from server:", item);
        throw new Error("Invalid item structure received from server");
    }
    return {
        id: item.id,
        // If UUID_Identifier from the server is not a valid UUID (i.e., it's null, empty, or not in UUID format),
        // we fall back to using the numeric `id` as a string. The update logic will later "upgrade" this
        // to a real UUID upon the first save.
        UUID_Identifier: isUuid(item.UUID_Identifier) ? item.UUID_Identifier : String(item.id),
        vaultId: item.vault_id,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        encryptedData: base64ToArrayBuffer(item.encrypted_data),
        nonce: base64ToUint8Array(item.nonce),
    };
};


/**
 * Handles the response from a fetch request, parsing JSON and throwing errors for non-ok statuses.
 * @param response The fetch Response object.
 * @returns A promise that resolves with the parsed JSON data.
 */
async function handleResponse<T>(response: Response): Promise<T> {
  // Error handling part
  if (!response.ok) {
    let errorBody;
    let errorText = '';
    try {
      errorText = await response.text();
      // Only parse if there's content, otherwise use status text
      errorBody = errorText ? JSON.parse(errorText) : { message: response.statusText };
    } catch (e) {
      console.error("API Error: Failed to parse error response as JSON. Raw text:", errorText);
      // Use the raw text if parsing fails
      errorBody = { message: errorText || `${response.status} ${response.statusText}` };
    }
    console.error(`API Error: ${response.status} ${response.statusText}`, { 
        url: response.url, 
        status: response.status,
        response: errorBody 
    });
    throw new Error(errorBody.message || 'An API error occurred');
  }

  // Success handling part
  const responseText = await response.text();

  try {
    // Return undefined if there's no text to parse, handles 204 No Content etc.
    return responseText ? (JSON.parse(responseText) as T) : (undefined as T);
  } catch (e) {
    console.error("API Success: Failed to parse successful response as JSON. Raw text:", responseText);
    // If it's not JSON, we should throw because our app expects it.
    throw new Error("Received a non-JSON response from the server.");
  }
}

const apiFetch = <T>(url: string, options: RequestInit = {}): Promise<T> => {
    const token = authToken;
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    return fetch(url, { ...options, headers })
        .then(response => handleResponse<T>(response))
        .catch(error => {
            console.error(`Fetch to ${url} failed. This could be a network issue, CORS, or the server is down. Error:`, error);
            if (error.message.includes('Failed to fetch')) {
                throw new Error('Could not connect to the server. Please check your network connection.');
            }
            throw error; // Re-throw other errors (like those from handleResponse)
        });
};


// --- Auth Endpoints ---

const register = (payload: RegisterPayload): Promise<any> => {
    const payloadToSend = {
        email: payload.email,
        salt: payload.salt,
        keys: payload.keys.publicKey,
        encrypted_private_key: payload.keys.encryptedPrivateKey
    };

    return apiFetch(`${API_BASE}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadToSend),
    });
};

const login = (payload: LoginPayload): Promise<LoginResponse> => {
    return apiFetch<LoginResponse>(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
};


// --- Data Endpoints (Auth token-based for security) ---

const getItems = async (): Promise<EncryptedItem[]> => {
    const serverItemsResponse = await apiFetch<any[] | any>(`${DATA_API_BASE}/item`, {
        method: 'GET',
    });

    const serverItems = Array.isArray(serverItemsResponse) ? serverItemsResponse : (serverItemsResponse ? [serverItemsResponse] : []);

    if (!serverItems || serverItems.length === 0) {
        return [];
    }

    return serverItems
      .filter(item => item && typeof item.id !== 'undefined' && typeof item.vault_id !== 'undefined' && item.encrypted_data && item.nonce)
      .map(mapServerItem);
};

const createItem = async (userId: number, newEntry: Omit<EncryptedItem, 'id' | 'UUID_Identifier'>): Promise<EncryptedItem> => {
    const payload = {
        UUID_Identifier: crypto.randomUUID(), // Backend expects UUID under UUID_Identifier key
        created_at: newEntry.createdAt,
        updated_at: newEntry.updatedAt,
        encrypted_data: toBase64(newEntry.encryptedData),
        nonce: toBase64(newEntry.nonce),
        user_id: userId,
        vault_id: newEntry.vaultId,
    };
    
    const createdServerItem = await apiFetch<any>(`${DATA_API_BASE}/item`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });

    return mapServerItem(createdServerItem);
};

const updateItem = async (userId: number, entry: EncryptedItem): Promise<EncryptedItem> => {
    const uuidToSend = isUuid(entry.UUID_Identifier) ? entry.UUID_Identifier : crypto.randomUUID();

    const payload = {
        UUID_Identifier: uuidToSend, // Backend expects UUID under UUID_Identifier key
        vault_id: entry.vaultId,
        user_id: userId,
        updated_at: entry.updatedAt,
        encrypted_data: toBase64(entry.encryptedData),
        nonce: toBase64(entry.nonce),
    };
    
    // The endpoint URL must use the numeric `entry.id` to identify the record to patch.
    const updatedServerItem = await apiFetch<any>(`${DATA_API_BASE}/item/${entry.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    });

    return mapServerItem(updatedServerItem);
};


const deleteItem = (id: number, uuid: string): Promise<void> => {
    // The item is identified by its numeric `id` in the URL.
    // The body contains the UUID_Identifier for validation.
    return apiFetch<void>(`${DATA_API_BASE}/item/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({ UUID_Identifier: uuid }),
    });
};

const getVaults = async (): Promise<Vault[]> => {
    const serverVaultsResponse = await apiFetch<any[] | any>(`${DATA_API_BASE}/vault`, {
        method: 'GET',
    });

    if (!serverVaultsResponse) {
        return [];
    }

    const vaultsArray = Array.isArray(serverVaultsResponse) ? serverVaultsResponse : [serverVaultsResponse];

    // Explicitly map to the Vault interface to ensure all properties, including `icon`, are correctly assigned.
    return vaultsArray
        .filter(vault => vault && vault.id && vault.name)
        .map(vault => ({
            id: vault.id,
            name: vault.name,
            icon: vault.icon,
        }));
};


const createVault = (vaultName: string, icon: string): Promise<Vault> => {
    return apiFetch<Vault>(`${DATA_API_BASE}/vault`, {
        method: 'POST',
        body: JSON.stringify({ 
            name: vaultName,
            icon: icon
        }),
    });
};

const updateVault = (vaultId: number, newName: string, newIcon: string): Promise<Vault> => {
    // Using PATCH to update the vault.
    const payload = {
        name: newName,
        icon: newIcon,
        vault_id: vaultId,
    };
    return apiFetch<Vault>(`${DATA_API_BASE}/vault/${vaultId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    });
};

const deleteVault = (vaultId: number): Promise<void> => {
    // Using DELETE to the specific resource endpoint.
    return apiFetch<void>(`${DATA_API_BASE}/vault/${vaultId}`, {
        method: 'DELETE',
        body: JSON.stringify({ vault_id: vaultId }),
    });
};

export const apiService = {
  register,
  login,
  getItems,
  createItem,
  updateItem,
  deleteItem,
  getVaults,
  createVault,
  updateVault,
  deleteVault,
};