// Orion Vault Browser Extension Service Worker
// This script handles all background tasks, state management, and API communication.

import { apiService, setAuthToken, clearAuthToken } from './services/apiService.js';
import { cryptoService } from './services/cryptoService.js';
import { base64ToArrayBuffer, base64ToUint8Array, toBase64 } from './utils/encoding.js';

// --- LIFECYCLE EVENTS ---
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('[Orion Vault BG] First install detected. Opening welcome page.');
        // Open the full app view on first install to guide the user.
        const welcomeUrl = chrome.runtime.getURL("index.html");
        chrome.tabs.create({ url: welcomeUrl });
    } else if (details.reason === 'update') {
        console.log(`[Orion Vault BG] Extension updated from ${details.previousVersion}.`);
        // Future logic for migrations can be placed here.
    }
});


// --- STATE MANAGEMENT ---
let session = null; // Holds the full session object, including the sensitive decryptedPrivateKey
let encryptedItems = []; // In-memory cache of encrypted items
let settings = { // Default settings, loaded from storage on startup
    logoutOnInactive: true,
    inactivityDuration: 15, // in minutes
};
let disabledSites = []; // Array of hostnames where autofill is disabled
let masterIdleHandler = null; // Store the handler reference to be able to remove it
let connectedPorts = []; // Holds connected UI ports for state broadcasting

// --- UTILITY & PERSISTENCE HELPERS ---

const isUuid = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

/**
 * Converts items with binary data (ArrayBuffer, Uint8Array) to a storable format (Base64 strings).
 * @param {EncryptedItem[]} items - The array of items to serialize.
 * @returns {object[]} A new array with items ready for JSON serialization.
 */
function serializeItems(items) {
    if (!items) return [];
    return items.map(item => ({
        ...item,
        encryptedData: toBase64(item.encryptedData),
        nonce: toBase64(item.nonce)
    }));
}

/**
 * Converts items from their storable format (Base64 strings) back to their original format with binary data.
 * @param {object[]} storedItems - The array of items from storage.
 * @returns {EncryptedItem[]} A new array with items containing ArrayBuffers and Uint8Arrays.
 */
function deserializeItems(storedItems) {
    if (!storedItems) return [];
    return storedItems.map(item => ({
        ...item,
        encryptedData: base64ToArrayBuffer(item.encryptedData),
        nonce: base64ToUint8Array(item.nonce)
    }));
}

/**
 * Saves the current encrypted items to local storage after serializing them.
 * @param {EncryptedItem[]} items - The current list of encrypted items.
 */
async function saveEncryptedItemsToStorage(items) {
    try {
        const storableItems = serializeItems(items);
        await chrome.storage.local.set({ encryptedItems: storableItems });
    } catch (e) {
        console.error("Failed to save encrypted items to storage:", e);
    }
}

/**
 * Returns a "shell" of the session object, safe to send to the UI (without the decrypted key).
 * @param {Session | null} sessionObject The full session object.
 * @returns A session object without the decryptedPrivateKey, or null.
 */
function getSessionShell(sessionObject) {
    if (!sessionObject) return null;
    const { decryptedPrivateKey, ...shell } = sessionObject;
    return shell;
}

/**
 * Persists the current session shell (without the private key) to chrome.storage.local.
 * This should be called whenever session data that needs to persist (like vaults) is changed.
 */
async function persistSessionShell() {
    if (!session) return;
    try {
        console.log("[Orion Vault BG] Persisting session shell to storage...", getSessionShell(session));
        await chrome.storage.local.set({ sessionShell: getSessionShell(session) });
    } catch (e) {
        console.error("[Orion Vault BG] Failed to persist session shell:", e);
    }
}

/**
 * Broadcasts the current session state to all connected UI instances.
 */
function broadcastStateChange() {
    const newState = {
        action: 'stateUpdated',
        payload: {
            session: getSessionShell(session),
            isLocked: !!session && !session.decryptedPrivateKey,
        }
    };
    console.log(`[Orion Vault BG] Broadcasting state change to ${connectedPorts.length} port(s). Locked: ${newState.payload.isLocked}`);
    // Use a copy of the array in case of modifications during iteration
    [...connectedPorts].forEach(port => {
        try {
            port.postMessage(newState);
        } catch (e) {
            console.warn("[Orion Vault BG] Could not post message to a port, it might be disconnected.", e.message);
            // The onDisconnect listener will handle cleanup.
        }
    });
}


/** Locks the vault by clearing the in-memory decryption key and notifies the UI. */
function lock() {
    if (session && session.decryptedPrivateKey) { // Only lock if it's currently unlocked
        session.decryptedPrivateKey = null;
        chrome.storage.session.remove('sessionDecryptedKey'); // Clear session key
        clearIdleListener();
        console.log("[Orion Vault BG] Vault has been locked.");
        broadcastStateChange(); // Notify the UI about the lock
    }
    return { success: true };
}

/** Sets up the idle listener based on user settings. */
function setupIdleListener() {
    // If a handler is already defined, remove it first to prevent duplicates.
    if (masterIdleHandler) {
        chrome.idle.onStateChanged.removeListener(masterIdleHandler);
    }

    // Define the single handler function
    masterIdleHandler = (newState) => {
        console.log(`[Orion Vault BG] Idle state changed to: ${newState}. Auto-lock setting is ${settings.logoutOnInactive ? 'ON' : 'OFF'}.`);
        // We only perform the lock action if the setting is explicitly enabled.
        if (settings.logoutOnInactive) {
            if (newState === 'idle' || newState === 'locked') {
                if (session && session.decryptedPrivateKey) {
                    lock();
                }
            }
        }
    };

    const durationInSeconds = settings.logoutOnInactive 
        ? Math.max(15, settings.inactivityDuration * 60)
        : 4 * 60 * 60; // 4 hours for keep-alive

    chrome.idle.setDetectionInterval(durationInSeconds);
    chrome.idle.onStateChanged.addListener(masterIdleHandler);
    
    if (settings.logoutOnInactive) {
        console.log(`[Orion Vault BG] Idle listener configured for auto-lock every ${settings.inactivityDuration} minutes.`);
    } else {
        console.log(`[Orion Vault BG] Idle listener configured for keep-alive only.`);
    }
}


/** Removes the idle state change listener. */
function clearIdleListener() {
    if (masterIdleHandler) {
        chrome.idle.onStateChanged.removeListener(masterIdleHandler);
        masterIdleHandler = null; // Clear the reference
        console.log("[Orion Vault BG] Idle listener cleared.");
    }
}


// --- AUTHENTICATION & SESSION LOGIC ---

async function register(email, masterPassword) {
    try {
        const userKey = await cryptoService.generateUserKey();
        const { keys, salt } = await cryptoService.protectUserKey(masterPassword, userKey);
        await apiService.register({ email, keys, salt });
        return { success: true };
    } catch (error) {
        console.error("Registration failed in background:", error);
        return { success: false, error: (error).message || "Registration failed." };
    }
}

async function login(email, masterPassword) {
    try {
        const response = await apiService.login({ email });
        const authToken = response.token;

        if (!authToken) throw new Error("Login failed: Missing auth token from server.");
        setAuthToken(authToken);

        if (!response.user?.salt || !response.user?.encrypted_private_key) {
            throw new Error("Account data is corrupted or incomplete.");
        }

        const decryptedPrivateKey = await cryptoService.unprotectPrivateKey(
            masterPassword,
            response.user.salt,
            response.user.encrypted_private_key
        );

        session = {
            userId: response.user.id,
            email: response.user.email,
            decryptedPrivateKey,
            vaults: [],
            salt: response.user.salt,
            encryptedPrivateKey: response.user.encrypted_private_key,
        };
        
        const initialItems = (response.items || []).map(item => ({
            id: item.id,
            UUID_Identifier: isUuid(item.UUID_Identifier) ? item.UUID_Identifier : String(item.id),
            vaultId: item.vault_id,
            createdAt: item.created_at,
            updatedAt: item.updated_at,
            encryptedData: base64ToArrayBuffer(item.encrypted_data),
            nonce: base64ToUint8Array(item.nonce),
        }));
        encryptedItems = initialItems;
        
        await chrome.storage.local.set({ authToken });
        await saveEncryptedItemsToStorage(initialItems);

        let userVaults = await apiService.getVaults();
        if (!userVaults || userVaults.length === 0) {
            const defaultVault = await apiService.createVault("Personal", "folder");
            userVaults = [defaultVault];
        }
        session.vaults = userVaults;
        
        await persistSessionShell();
        setupIdleListener();
        broadcastStateChange();

        return { success: true, session: getSessionShell(session) };
    } catch (error) {
        console.error("Login failed in background:", error);
        await logout(); // Ensure clean state on failure
        return { success: false, error: (error).message || "Login failed." };
    }
}

async function unlock(masterPassword) {
    if (!session || !session.salt || !session.encryptedPrivateKey) {
        return { success: false, error: "No session to unlock." };
    }
    try {
        const decryptedPrivateKey = await cryptoService.unprotectPrivateKey(
            masterPassword,
            session.salt,
            session.encryptedPrivateKey
        );
        session.decryptedPrivateKey = decryptedPrivateKey;
        
        // Persist key in session storage if auto-lock is off
        if (!settings.logoutOnInactive) {
            const exportedKey = await crypto.subtle.exportKey('jwk', decryptedPrivateKey);
            await chrome.storage.session.set({ sessionDecryptedKey: exportedKey });
            console.log("[Orion Vault BG] Unlocked and saved decryption key to session storage (auto-lock is OFF).");
        }
        
        setupIdleListener();
        
        await refreshItems();
        broadcastStateChange();

        return { success: true, session: getSessionShell(session) };
    } catch (error) {
        console.error("Unlock failed:", error);
        return { success: false, error: "Invalid master password." };
    }
}

async function logout() {
    console.log("[Orion Vault BG] Logout initiated. Clearing session and all local data.");
    clearAuthToken();
    session = null;
    encryptedItems = [];
    await chrome.storage.local.remove(['sessionShell', 'authToken', 'encryptedItems']);
    await chrome.storage.session.remove('sessionDecryptedKey'); // Clear session key
    clearIdleListener();
    broadcastStateChange();
    return { success: true };
}


// --- DATA LOGIC ---

async function getDecryptedItems(filterFn) {
    if (!session?.decryptedPrivateKey) {
      return []; // Return empty array if locked or no session
    }
  
    const itemsToDecrypt = filterFn ? encryptedItems.filter(filterFn) : encryptedItems;
    if (itemsToDecrypt.length === 0) {
      return [];
    }
  
    try {
      const decryptedPromises = itemsToDecrypt.map(entry =>
        cryptoService.decryptItem(entry, session.decryptedPrivateKey)
      );
      const results = await Promise.allSettled(decryptedPromises);
      return results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value);
    } catch (error) {
      console.error("Decryption failed for a batch of items", error);
      return []; // Return empty on error
    }
}

async function handleGetDecryptedItems() {
    if (!session?.decryptedPrivateKey) {
        return { success: false, error: "Not authenticated or vault is locked." };
    }
    const items = await getDecryptedItems();
    return { success: true, items };
}
  

async function refreshItems() {
     if (!session) return { success: false, error: "Not authenticated." };
     try {
        encryptedItems = await apiService.getItems();
        await saveEncryptedItemsToStorage(encryptedItems); // Persist the updated items
        return await handleGetDecryptedItems();
     } catch (error) {
        return { success: false, error: (error).message };
     }
}

async function saveItem(entry, existingItem, timestamps) {
    if (!session?.decryptedPrivateKey || !session.userId) {
        return { success: false, error: "Not authenticated or vault is locked." };
    }
     try {
        const isEditing = !!existingItem;
        const now = Date.now();
        const { encryptedData, nonce } = await cryptoService.encryptItem(entry, session.decryptedPrivateKey);

        let finalItem;
        if (isEditing) {
            const encryptedEntry = {
                id: existingItem.id,
                UUID_Identifier: existingItem.UUID_Identifier,
                vaultId: entry.vaultId,
                encryptedData, nonce,
                createdAt: existingItem.createdAt,
                updatedAt: now
            };
            const updatedEncryptedItem = await apiService.updateItem(session.userId, encryptedEntry);
            encryptedItems = encryptedItems.map(i => i.UUID_Identifier === updatedEncryptedItem.UUID_Identifier ? updatedEncryptedItem : i);
            finalItem = await cryptoService.decryptItem(updatedEncryptedItem, session.decryptedPrivateKey);
        } else {
            const newItemData = {
                vaultId: entry.vaultId,
                encryptedData, nonce,
                createdAt: timestamps?.createdAt ?? now,
                updatedAt: timestamps?.updatedAt ?? now
            };
            const createdEncryptedItem = await apiService.createItem(session.userId, newItemData);
            encryptedItems.push(createdEncryptedItem);
            finalItem = await cryptoService.decryptItem(createdEncryptedItem, session.decryptedPrivateKey);
        }
        await saveEncryptedItemsToStorage(encryptedItems); // Persist changes
        return { success: true, item: finalItem };
    } catch (error) {
        console.error("Failed to save item in background:", error);
        return { success: false, error: (error).message };
    }
}

async function deleteItem(itemToDelete) {
    if (!session) return { success: false, error: "Not authenticated" };
    try {
        await apiService.deleteItem(itemToDelete.id, itemToDelete.UUID_Identifier);
        encryptedItems = encryptedItems.filter(i => i.UUID_Identifier !== itemToDelete.UUID_Identifier);
        await saveEncryptedItemsToStorage(encryptedItems); // Persist changes
        return { success: true };
    } catch (error) {
        console.error("Failed to delete item in background:", error);
        return { success: false, error: (error).message };
    }
}

async function createVault(name, icon) {
    if (!session) return { success: false, error: "Not authenticated" };
    try {
        const newVault = await apiService.createVault(name, icon);
        if (session) {
            session.vaults.push(newVault);
            await persistSessionShell(); // Save the updated session with the new vault
            broadcastStateChange(); // Notify UI of the new vault
        }
        return { success: true, vault: newVault };
    } catch (error) {
        console.error("Failed to create vault in background:", error);
        return { success: false, error: (error).message };
    }
}

async function updateVault(vaultId, name, icon) {
    if (!session) return { success: false, error: "Not authenticated" };
    try {
        const updatedVault = await apiService.updateVault(vaultId, name, icon);
        if (session) {
            session.vaults = session.vaults.map(v => v.id === vaultId ? updatedVault : v);
            await persistSessionShell(); // Save the updated session
            broadcastStateChange(); // Notify UI of the vault update
        }
        return { success: true, vault: updatedVault };
    } catch (error) {
        console.error("Failed to update vault in background:", error);
        return { success: false, error: (error).message };
    }
}

async function deleteVault(vaultId) {
    if (!session) return { success: false, error: "Not authenticated" };
    try {
        await apiService.deleteVault(vaultId);
        if (session) {
            session.vaults = session.vaults.filter(v => v.id !== vaultId);
            await persistSessionShell(); // Save the updated session
            broadcastStateChange(); // Notify UI of the vault deletion
        }
        return { success: true };
    } catch (error) {
        console.error("Failed to delete vault in background:", error);
        return { success: false, error: (error).message };
    }
}

async function getCredentialsForTab(tabUrl) {
    const isLocked = !session || !session.decryptedPrivateKey;
    
    let hostname;
    try {
        hostname = new URL(tabUrl).hostname;
    } catch (e) {
        return { success: true, logins: [], isLocked, isDisabled: false };
    }

    if (disabledSites.includes(hostname)) {
        return { success: true, logins: [], isLocked, isDisabled: true };
    }

    if (isLocked) {
      return { success: true, logins: [], isLocked: true, isDisabled: false };
    }
  
    const domainToMatch = hostname.replace(/^www\./, '');
  
    const loginItems = await getDecryptedItems();

    const matchingLogins = loginItems.filter(item => {
        if (item.type !== 'login' || !item.url) return false;
        try {
            const itemUrlObj = new URL(item.url.startsWith('http') ? item.url : `https://${item.url}`);
            const itemDomain = itemUrlObj.hostname.replace(/^www\./, '');
            return itemDomain === domainToMatch || itemDomain.endsWith(`.${domainToMatch}`);
        } catch {
            return item.url.includes(domainToMatch);
        }
    });
  
    return { success: true, logins: matchingLogins, isLocked: false, isDisabled: false };
}

// --- SECURE LOGIN DETECTION FLOW ---

async function encryptPendingLogin(payload) {
    console.log("[background.js] encryptPendingLogin: Received request with payload:", payload);
    if (!session?.decryptedPrivateKey) {
        console.error("[background.js] encryptPendingLogin: Vault is locked. Cannot encrypt.");
        return { success: false, error: "Vault is locked." };
    }
    try {
        const { username, password, url } = payload;
        // Encrypt a simplified object for temporary storage.
        const dataToEncrypt = { u: username, p: password, l: url };
        const dataString = JSON.stringify(dataToEncrypt);
        const dataBytes = new TextEncoder().encode(dataString);
        
        const nonce = crypto.getRandomValues(new Uint8Array(12)); // AES-GCM standard IV length
        const encryptedData = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: nonce },
            session.decryptedPrivateKey,
            dataBytes
        );

        const encryptedBlob = {
            data: toBase64(encryptedData),
            nonce: toBase64(nonce)
        };
        console.log("[background.js] encryptPendingLogin: Encryption successful. Sending back encrypted blob.");
        return { success: true, encryptedBlob };
    } catch (err) {
        console.error('Orion Vault: Could not encrypt and store pending login.', err);
        return { success: false, error: err.message };
    }
}

async function processEncryptedPendingLogin(payload, sender) {
    console.log("[background.js] processEncryptedPendingLogin: Received request with encrypted data from tab:", sender.tab?.id);
    if (!session?.decryptedPrivateKey || !sender.tab) {
         console.error("[background.js] processEncryptedPendingLogin: Vault is locked or sender tab is missing.");
        return { success: false, error: "Vault is locked or sender tab is missing." };
    }
    if (disabledSites.includes(new URL(sender.tab.url).hostname)) {
        console.log("[background.js] processEncryptedPendingLogin: Site is disabled. Aborting.");
        return { success: false, error: "Site is disabled." };
    }

    try {
        const encryptedDataBytes = base64ToArrayBuffer(payload.data);
        const nonceBytes = base64ToUint8Array(payload.nonce);
        
        const decryptedBytes = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: nonceBytes },
            session.decryptedPrivateKey,
            encryptedDataBytes
        );
        
        const decryptedJson = new TextDecoder().decode(decryptedBytes);
        const decryptedPayload = JSON.parse(decryptedJson);

        const { u: username, p: password, l: url } = decryptedPayload;
        console.log(`[background.js] processEncryptedPendingLogin: Decryption successful. Plaintext username: ${username}`);

        // Now with plaintext credentials, check if this login already exists.
        const allItems = await getDecryptedItems();
            
        let domain;
        try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch { return { success: false, error: 'Invalid URL' }; }

        const exists = allItems.some(item => {
            if (item.type !== 'login' || !item.url) return false;
            let itemDomain;
            try { itemDomain = new URL(item.url).hostname.replace(/^www\./, ''); } catch { return false; }
            return itemDomain === domain && (item.username === username);
        });

        console.log(`[background.js] processEncryptedPendingLogin: Checking if login exists for domain '${domain}' and username '${username}'. Result: ${exists}`);

        // If it doesn't exist, prompt the user on the current tab to save it.
        if (!exists) {
            console.log("[background.js] processEncryptedPendingLogin: Login does not exist. Sending prompt to tab", sender.tab.id);
            chrome.tabs.sendMessage(sender.tab.id, {
                action: 'showSaveLoginPrompt',
                payload: {
                    username: username,
                    password: password,
                    url: url,
                    vaults: getSessionShell(session)?.vaults || []
                }
            });
        }
        return { success: true };
    } catch (error) {
        console.error("[background.js] processEncryptedPendingLogin: Failed to process.", error);
        return { success: false, error: "Decryption failed. Could not process login." };
    }
}


// --- MESSAGE LISTENER & INITIALIZATION ---

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // UI interaction does not reset the idle timer; chrome.idle handles this automatically.
    const { action, payload } = request;

    // Diagnostic log to identify the action being called.
    console.log(`[Orion Vault BG] Received action: "${action}"`, { payload, sender: sender.tab?.url || 'popup' });

    if (action === 'saveDetectedLogin') {
        const { username, password, url, vaultId } = payload;
        let title;
        try { title = new URL(url).hostname; } catch { title = url; }

        const entry = {
            type: 'login', title, url, username,
            password, notes: '', vaultId
        };
        
        saveItem(entry, null).then(sendResponse);
        return true;
    }

    // --- Standard sync/async actions ---
    const actions = {
        getInitialState: () => Promise.resolve({ success: true, session: getSessionShell(session), isLocked: !!session && !session.decryptedPrivateKey }),
        register: () => register(payload.email, payload.masterPassword),
        login: () => login(payload.email, payload.masterPassword),
        unlock: () => unlock(payload.masterPassword),
        logout: () => logout(),
        lock: () => lock(),
        getDecryptedItems: () => handleGetDecryptedItems(),
        refreshItems: () => refreshItems(),
        saveItem: () => saveItem(payload.entry, payload.existingItem, payload.timestamps),
        deleteItem: () => deleteItem(payload.item),
        createVault: () => createVault(payload.name, payload.icon),
        updateVault: () => updateVault(payload.vaultId, payload.name, payload.icon),
        deleteVault: () => deleteVault(payload.vaultId),
        getCredentialsForTab: () => getCredentialsForTab(payload.url),
        getDisabledSites: () => Promise.resolve({ success: true, sites: disabledSites }),
        disableSite: async () => {
            const { hostname } = payload;
            if (hostname && !disabledSites.includes(hostname)) {
                disabledSites.push(hostname);
                await chrome.storage.sync.set({ disabledSites });
                const tabs = await chrome.tabs.query({});
                for (const tab of tabs) {
                    try {
                        chrome.tabs.sendMessage(tab.id, {
                            action: 'disabledSitesUpdated',
                            payload: { sites: disabledSites }
                        });
                    } catch (e) { /* Ignore tabs that don't have the script */ }
                }
            }
            return { success: true };
        },
        openFullApp: () => {
             const baseUrl = chrome.runtime.getURL('index.html');
             const finalUrl = (payload && payload.query) ? `${baseUrl}${payload.query}` : baseUrl;
             chrome.tabs.create({ url: finalUrl });
             return Promise.resolve({ success: true });
        },
        // Secure login detection actions
        encryptPendingLogin: () => encryptPendingLogin(payload),
        processEncryptedPendingLogin: () => processEncryptedPendingLogin(payload, sender),
    };

    const handler = actions[action];
    if (handler) {
        handler().then(sendResponse).catch(err => sendResponse({ success: false, error: err.message }));
    } else {
        sendResponse({ success: false, error: 'Unknown action' });
    }
    
    return true; // Indicate asynchronous response
});

// Listen for changes in user settings from other extension contexts
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') {
        let settingsChanged = false;
        if (changes.logoutOnInactive) {
            const autoLockEnabled = changes.logoutOnInactive.newValue;
            settings.logoutOnInactive = autoLockEnabled;
            settingsChanged = true;

            // If user just enabled auto-lock, clear the session key for security
            if (autoLockEnabled) {
                chrome.storage.session.remove('sessionDecryptedKey');
                console.log("[Orion Vault BG] Auto-lock enabled. Removed session key for security.");
            }
        }
        if (changes.inactivityDuration) {
            settings.inactivityDuration = changes.inactivityDuration.newValue;
            settingsChanged = true;
        }
        if (changes.disabledSites) {
            disabledSites = changes.disabledSites.newValue || [];
        }
        if (settingsChanged) {
            console.log("Inactivity settings updated:", settings);
            if (session && session.decryptedPrivateKey) {
                // Re-apply the listener with new settings
                setupIdleListener();
            }
        }
    }
});

// Listen for connections from the UI to keep the service worker alive
chrome.runtime.onConnect.addListener(port => {
    if (port.name === 'ui-keep-alive') {
        console.log("[Orion Vault BG] UI connected. Adding port to broadcast list.");
        connectedPorts.push(port);
        
        port.onDisconnect.addListener(() => {
            console.log("[Orion Vault BG] UI disconnected. Removing port from broadcast list.");
            const index = connectedPorts.indexOf(port);
            if (index > -1) {
                connectedPorts.splice(index, 1);
            }
        });
    }
});


// Initialization logic when the service worker starts
(async () => {
    console.log("Orion Vault service worker starting...");
    // 1. Load settings first, as they determine behavior
    try {
        const storedSettings = await chrome.storage.sync.get(['logoutOnInactive', 'inactivityDuration', 'disabledSites']);
        settings = { ...settings, ...storedSettings };
        if (Array.isArray(storedSettings.disabledSites)) {
            disabledSites = storedSettings.disabledSites;
        }
    } catch (e) {
        console.error("Could not load settings from chrome.storage.sync", e);
    }

    // 2. Pre-load session key if auto-lock is disabled
    let sessionKey = null;
    if (!settings.logoutOnInactive) {
        try {
            const { sessionDecryptedKey } = await chrome.storage.session.get('sessionDecryptedKey');
            if (sessionDecryptedKey) {
                sessionKey = await crypto.subtle.importKey(
                    'jwk',
                    sessionDecryptedKey,
                    { name: 'AES-GCM', length: 256 },
                    true,
                    ['encrypt', 'decrypt']
                );
            }
        } catch (e) {
            console.warn("[Orion Vault BG] Could not restore session key, might be invalid.", e);
        }
    }

    // 3. Try to restore the main session state
    try {
        const { sessionShell, authToken, encryptedItems: storedItems } = await chrome.storage.local.get(['sessionShell', 'authToken', 'encryptedItems']);
        
        if (sessionShell && authToken) {
            session = sessionShell;
            session.decryptedPrivateKey = sessionKey; // Assign pre-loaded key or null
            setAuthToken(authToken);

            if (session.decryptedPrivateKey) {
                console.log("[Orion Vault BG] Successfully restored session in an UNLOCKED state.");
                setupIdleListener(); // Setup keep-alive listener since we're unlocked
            } else {
                 console.log("[Orion Vault BG] Restored session in a LOCKED state.");
            }
        }

        if (storedItems) {
            console.log(`Restoring ${storedItems.length} encrypted items from storage.`);
            encryptedItems = deserializeItems(storedItems);
        }
    } catch(e) {
        console.error("Could not load session or items from chrome.storage.local", e);
        await logout(); // Clear everything on error
    }
    
    // 4. Final broadcast of initial state
    broadcastStateChange(); 
    console.log("Service worker initialized.");
})();