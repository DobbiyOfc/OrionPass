import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback, useMemo } from 'react';
import { useToast } from './ToastContext';
import { useLog } from './LogContext';
import { Session, Item, Vault, LoginItem, NoteItem } from '../types';

// This tells TypeScript that a 'chrome' object might exist globally.
declare const chrome: any;

interface AuthContextType {
  session: Omit<Session, 'decryptedPrivateKey'> | null;
  isInitialized: boolean;
  isLocked: boolean;
  register: (email: string, masterPassword: string) => Promise<boolean>;
  login: (email: string, masterPassword: string) => Promise<boolean>;
  unlock: (masterPassword: string) => Promise<boolean>;
  logout: () => void;
  getDecryptedItems: () => Promise<Item[]>;
  refreshItems: () => Promise<Item[]>;
  createVault: (name: string, icon: string) => Promise<Vault>;
  saveItem: (entry: Omit<LoginItem, 'id' | 'UUID_Identifier' | 'createdAt' | 'updatedAt'> | Omit<NoteItem, 'id' |'UUID_Identifier' | 'createdAt' | 'updatedAt'>, existingItem: Item | null, timestamps?: { createdAt: number, updatedAt: number }) => Promise<Item>;
  deleteItem: (item: Item) => Promise<void>;
  updateVaultDetails: (vaultId: number, name: string, icon: string) => Promise<Vault>;
  deleteVault: (vaultId: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// A helper to promisify chrome.runtime.sendMessage
const sendMessage = <T extends {}>(message: { action: string; payload?: any }): Promise<T & { success: boolean; error?: string }> => {
    return new Promise((resolve, reject) => {
        if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
             console.warn("Browser extension context not found. App is running in standalone web mode. Operations will be no-ops.");
             // Resolve with a default "failure" state for web mode
             return resolve({ success: false, error: "Not in extension context" } as T & { success: boolean; error?: string });
        }
        chrome.runtime.sendMessage(message, (response: any) => {
            if (chrome.runtime.lastError) {
                // Reject with a standard Error object for better catch block handling
                reject(new Error(chrome.runtime.lastError.message || 'An unknown error occurred in the extension runtime.'));
            } else {
                // The background script should always return an object.
                // If it doesn't, it's an unexpected state.
                if (typeof response === 'object' && response !== null) {
                    resolve(response);
                } else {
                    // This case handles unexpected non-object responses, preventing crashes.
                     reject(new Error(`Unexpected response type from background script: ${typeof response}`));
                }
            }
        });
    });
};


export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Omit<Session, 'decryptedPrivateKey'> | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isLocked, setIsLocked] = useState(true);
    const { showToast } = useToast();
    const { addLog } = useLog();

    const addVault = useCallback((vault: Vault) => {
        setSession(prev => prev ? { ...prev, vaults: [...prev.vaults, vault] } : null);
    }, []);

    const updateVault = useCallback((updatedVault: Vault) => {
        setSession(prev => prev ? { ...prev, vaults: prev.vaults.map(v => v.id === updatedVault.id ? updatedVault : v) } : null);
    }, []);

    const removeVault = useCallback((vaultId: number) => {
        setSession(prev => prev ? { ...prev, vaults: prev.vaults.filter(v => v.id !== vaultId) } : null);
    }, []);

    // Effect to keep the service worker alive and receive state updates.
    useEffect(() => {
        if (typeof chrome === 'undefined' || !chrome.runtime?.connect) {
            return;
        }

        addLog("UI connecting to background script...", 'debug', 'Auth');
        const port = chrome.runtime.connect({ name: 'ui-keep-alive' });

        const messageListener = (message: any) => {
            if (message.action === 'stateUpdated') {
                const { session: newSession, isLocked: newIsLocked } = message.payload;
                addLog(`State update received from background. Locked: ${newIsLocked}`, 'debug', 'Auth');
                setSession(newSession);
                setIsLocked(newIsLocked);
            }
        };

        port.onMessage.addListener(messageListener);

        // Cleanup function
        return () => {
            addLog("UI disconnecting from background script.", 'debug', 'Auth');
            port.onMessage.removeListener(messageListener);
            port.disconnect();
        };
    }, [addLog]); // Dependency array ensures this runs once when AuthProvider mounts.

    useEffect(() => {
        addLog("Auth context initializing.", 'debug', 'Auth');
        sendMessage<{ session: Omit<Session, 'decryptedPrivateKey'> | null, isLocked: boolean }>({ action: 'getInitialState' }).then(response => {
            if (response.success) {
                setSession(response.session);
                setIsLocked(response.isLocked);
                if (response.session) {
                    addLog("Session shell restored from background script.", 'info', 'Auth');
                }
            }
            setIsInitialized(true);
        }).catch(error => {
            addLog(`Error getting initial state: ${(error as Error).message}`, 'error', 'Auth');
            setIsInitialized(true); 
        });
    }, [addLog]);

    const logout = useCallback(async () => {
        // Optimistically update the UI for a faster response.
        // The broadcast from the background will ensure final consistency.
        setSession(null);
        setIsLocked(true);
        addLog("User is logging out.", 'info', 'Auth');
        await sendMessage({ action: 'logout' });
        // No need to do anything with the response, the broadcast listener handles it.
    }, [addLog]);

    const register = useCallback(async (email: string, masterPassword: string): Promise<boolean> => {
        addLog(`Attempting registration for ${email}.`, 'info', 'Auth');
        const response = await sendMessage({ 
            action: 'register', 
            payload: { email, masterPassword } 
        });

        if (response.success) {
            addLog(`Registration successful for ${email}.`, 'info', 'Auth');
            showToast("Registration successful! You can now log in.", "success");
            return true;
        } else {
            addLog(`Registration failed for ${email}: ${response.error}`, 'error', 'Auth');
            showToast(response.error || "Registration failed.", "error");
            return false;
        }
    }, [addLog, showToast]);
    
    const login = useCallback(async (email: string, masterPassword: string): Promise<boolean> => {
        addLog(`Attempting login for ${email}.`, 'info', 'Auth');
        const response = await sendMessage<{ session?: Session }>({
            action: 'login',
            payload: { email, masterPassword }
        });

        if (response.success && response.session) {
            // State is set via broadcast from background script, but we can set it here for immediate feedback if needed.
            setSession(response.session);
            setIsLocked(false);
            addLog(`Login successful for ${email}. Session established.`, 'info', 'Auth');
            showToast("Welcome back!", "success");
            return true;
        } else {
            addLog(`Login failed for ${email}: ${response.error}`, 'error', 'Auth');
            showToast(response.error || "Login failed. Please check your credentials.", "error");
            return false;
        }
    }, [addLog, showToast]);

    const unlock = useCallback(async (masterPassword: string): Promise<boolean> => {
        addLog(`Attempting to unlock vault.`, 'info', 'Auth');
        const response = await sendMessage<{ session?: Session }>({
            action: 'unlock',
            payload: { masterPassword }
        });

        if (response.success && response.session) {
             // State is set via broadcast from background script.
            addLog(`Vault unlocked successfully.`, 'info', 'Auth');
            return true;
        } else {
            addLog(`Unlock failed: ${response.error}`, 'error', 'Auth');
            showToast(response.error || "Invalid master password.", "error");
            return false;
        }
    }, [addLog, showToast]);

    const getDecryptedItems = useCallback(async (): Promise<Item[]> => {
        addLog("Requesting decrypted items from background.", 'info', 'Data');
        const response = await sendMessage<{ items?: Item[] }>({ action: 'getDecryptedItems' });
        if (response.success && response.items) {
            return response.items;
        } else {
            addLog(`Failed to get decrypted items: ${response.error}`, 'error', 'Data');
            throw new Error(response.error || "Could not retrieve items.");
        }
    }, [addLog]);
    
    const refreshItems = useCallback(async (): Promise<Item[]> => {
        addLog("Requesting item refresh from background.", 'info', 'Data');
        const response = await sendMessage<{ items?: Item[] }>({ action: 'refreshItems' });
        if (response.success && response.items) {
            return response.items;
        } else {
            addLog(`Failed to refresh items: ${response.error}`, 'error', 'Data');
            if (!response.error?.includes('429')) {
                 showToast('Failed to sync with server.', 'error');
            }
            throw new Error(response.error || 'Failed to sync with server.');
        }
    }, [addLog, showToast]);

    const saveItem = useCallback(async (entry: Omit<LoginItem, 'id' | 'UUID_Identifier' | 'createdAt' | 'updatedAt'> | Omit<NoteItem, 'id' |'UUID_Identifier' | 'createdAt' | 'updatedAt'>, existingItem: Item | null, timestamps?: { createdAt: number, updatedAt: number }): Promise<Item> => {
        const response = await sendMessage<{ item?: Item }>({
            action: 'saveItem',
            payload: { entry, existingItem, timestamps }
        });
        if (response.success && response.item) {
            return response.item;
        }
        throw new Error(response.error || "Failed to save item.");
    }, []);
    
    const deleteItem = useCallback(async (item: Item): Promise<void> => {
        const response = await sendMessage({
            action: 'deleteItem',
            payload: { item }
        });
        if (!response.success) {
            throw new Error(response.error || "Failed to delete item.");
        }
    }, []);

    const createVault = useCallback(async (name: string, icon: string): Promise<Vault> => {
        const response = await sendMessage<{ vault?: Vault }>({
            action: 'createVault',
            payload: { name, icon }
        });
        if (response.success && response.vault) {
            addVault(response.vault);
            return response.vault;
        }
        throw new Error(response.error || "Failed to create vault.");
    }, [addVault]);

    const updateVaultDetails = useCallback(async (vaultId: number, name: string, icon: string): Promise<Vault> => {
        const response = await sendMessage<{ vault?: Vault }>({
            action: 'updateVault',
            payload: { vaultId, name, icon }
        });
        if (response.success && response.vault) {
            updateVault(response.vault);
            return response.vault;
        }
        throw new Error(response.error || "Failed to update vault.");
    }, [updateVault]);

    const deleteVault = useCallback(async (vaultId: number): Promise<void> => {
        const response = await sendMessage({
            action: 'deleteVault',
            payload: { vaultId }
        });
        if (response.success) {
            removeVault(vaultId);
        } else {
            throw new Error(response.error || "Failed to delete vault.");
        }
    }, [removeVault]);

    const value = useMemo(() => ({
        session,
        isInitialized,
        isLocked,
        register,
        login,
        unlock,
        logout,
        getDecryptedItems,
        refreshItems,
        createVault,
        saveItem,
        deleteItem,
        updateVaultDetails,
        deleteVault
    }), [
        session, isInitialized, isLocked, register, login, unlock, logout, getDecryptedItems, 
        refreshItems, createVault, saveItem, deleteItem, updateVaultDetails, deleteVault
    ]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};