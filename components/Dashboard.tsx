
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Item, Vault, ItemType, LoginItem, NoteItem } from '../types';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from 'react-i18next';

// Refactored Components
import LeftSidebar from './dashboard/LeftSidebar';
import Header from './dashboard/Header';
import ItemList from './dashboard/ItemList';
import ItemDetailView from './dashboard/ItemDetailView';
import { SortOption } from './dashboard/SortDropdown';

// Modals
import ItemModal from './PasswordModal';
import SettingsModal from './SettingsModal';
import CreateVaultModal from './modals/CreateVaultModal';
import DeleteConfirmationModal from './modals/DeleteConfirmationModal';
import EditVaultModal from './modals/EditVaultModal';
import MoveVaultModal from './modals/MoveVaultModal';

const Dashboard: React.FC = () => {
    const { 
        session, getDecryptedItems, logout, refreshItems, 
        saveItem, deleteItem, createVault, updateVaultDetails, deleteVault
    } = useAuth();
    const [items, setItems] = useState<Item[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Item | null>(null);
    const [newItemType, setNewItemType] = useState<ItemType>('login');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [selectedVaultId, setSelectedVaultId] = useState<number | 'all'>('all');
    const [sortOption, setSortOption] = useState<SortOption>('recent_grouped');
    const [isCreateVaultModalOpen, setIsCreateVaultModalOpen] = useState(false);
    const [movingItem, setMovingItem] = useState<Item | null>(null);
    const [deletingThing, setDeletingThing] = useState<{ type: 'item', data: Item } | { type: 'vault', data: Vault } | null>(null);
    const [editingVault, setEditingVault] = useState<Vault | null>(null);
    const { showToast } = useToast();
    const { t } = useTranslation();

    const loadItems = useCallback(async (isRefresh = false) => {
        setIsLoading(true);
        try {
            const fetchFunction = isRefresh ? refreshItems : getDecryptedItems;
            const decryptedItems = await fetchFunction();
            setItems(decryptedItems);
        } catch (error) {
            console.error("Failed to load items:", error);
            const errorMessage = (error as Error).message.toLowerCase();
            if (errorMessage.includes('401') || errorMessage.includes('unauthorized') || errorMessage.includes('not authenticated')) {
                 showToast("Session expired. Please log in again.", "error");
                 logout();
            } else if (!errorMessage.includes('429')) {
                 showToast(t('could_not_load_items'), "error");
            }
        } finally {
            setIsLoading(false);
        }
    }, [getDecryptedItems, logout, showToast, t, refreshItems]);

     useEffect(() => {
        if(session) {
            loadItems();
        }
    }, [session, loadItems]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('view') === 'settings') {
            setIsSettingsModalOpen(true);
            // Clean up URL so reloading doesn't re-open the modal
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
        }
    }, []);
    
     const sortedAndFilteredItems = useMemo(() => {
        const filtered = items.filter(p => {
            const inVault = selectedVaultId === 'all' || p.vaultId === selectedVaultId;
            const searchLower = searchTerm.toLowerCase();
            if (!searchLower) return inVault;
            
            const titleMatch = p.title.toLowerCase().includes(searchLower);
            let otherMatch = false;
            if (p.type === 'login') {
                otherMatch = p.username.toLowerCase().includes(searchLower) ||
                             p.url.toLowerCase().includes(searchLower);
            } else if (p.type === 'note') {
                otherMatch = p.notes.toLowerCase().includes(searchLower);
            }
            return inVault && (titleMatch || otherMatch);
        });

        switch (sortOption) {
            case 'alphabetical':
                return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
            case 'date_asc':
                return [...filtered].sort((a, b) => a.updatedAt - b.updatedAt);
            case 'date_desc':
            case 'recent_grouped': // The list needs to be sorted by date for grouping to work correctly
            default:
                return [...filtered].sort((a, b) => b.updatedAt - a.updatedAt);
        }
    }, [items, selectedVaultId, searchTerm, sortOption]);

    const itemCountsByVault = useMemo(() => {
        const counts = new Map<number, number>();
        items.forEach(p => {
            counts.set(p.vaultId, (counts.get(p.vaultId) || 0) + 1);
        });
        return counts;
    }, [items]);

    const selectedItem = items.find(p => p.UUID_Identifier === selectedItemId) ?? null;

     useEffect(() => {
        if (!isLoading && sortedAndFilteredItems.length > 0 && !selectedItemId) {
            if (window.innerWidth >= 768) {
               setSelectedItemId(sortedAndFilteredItems[0].UUID_Identifier);
            }
        }
        if (selectedItemId && !sortedAndFilteredItems.find(p => p.UUID_Identifier === selectedItemId)) {
            setSelectedItemId(sortedAndFilteredItems.length > 0 ? sortedAndFilteredItems[0].UUID_Identifier : null);
        }
    }, [sortedAndFilteredItems, isLoading, selectedItemId]);
    
    const handleSaveItem = async (entry: Omit<LoginItem, 'id' | 'UUID_Identifier' | 'createdAt' | 'updatedAt'> | Omit<NoteItem, 'id' |'UUID_Identifier' | 'createdAt' | 'updatedAt'>, existingItem: Item | null) => {
         try {
            const isEditing = !!existingItem;
            const savedItem = await saveItem(entry, existingItem);

            if (isEditing) {
                setItems(prev => prev.map(i => i.UUID_Identifier === savedItem.UUID_Identifier ? savedItem : i));
                showToast(t('item_updated_successfully'), 'success');
            } else {
                setItems(prev => [savedItem, ...prev]);
                setSelectedItemId(savedItem.UUID_Identifier);
                showToast(t('item_saved_successfully'), 'success');
            }

            setIsModalOpen(false);
            setEditingItem(null);
        } catch (error) {
            console.error("Failed to save item:", error);
            showToast(t('failed_to_save_item') + `: ${(error as Error).message}`, "error");
            throw error; // Propagate error to modal
        }
    };

    const handleConfirmDelete = async () => {
        if (!deletingThing) return;
        
        try {
            if (deletingThing.type === 'item') {
                await deleteItem(deletingThing.data);
                showToast(t('item_deleted'), "success");
                setItems(prevItems => prevItems.filter(i => i.UUID_Identifier !== deletingThing.data.UUID_Identifier));
                if (selectedItemId === deletingThing.data.UUID_Identifier) {
                    setSelectedItemId(null);
                }
            } else if (deletingThing.type === 'vault') {
                const vaultItemCount = itemCountsByVault.get(deletingThing.data.id) || 0;
                if (vaultItemCount > 0) {
                    showToast(t('cannot_delete_vault_with_items', { count: vaultItemCount }), "error");
                    setDeletingThing(null);
                    return;
                }
                await deleteVault(deletingThing.data.id);
                showToast(t('vault_deleted'), "success");
                if (selectedVaultId === deletingThing.data.id) {
                    setSelectedVaultId('all');
                }
            }
        } catch (error) {
            const { type } = deletingThing;
            console.error(`Failed to delete ${type}:`, error);
            showToast((error as Error).message || t(`failed_to_delete_${type}`), "error");
        } finally {
            setDeletingThing(null);
        }
    };
    
    const handleMoveItem = async (item: Item, newVaultId: number) => {
        setMovingItem(null);
        try {
            const { id, UUID_Identifier, createdAt, updatedAt, ...rest } = item;
            const entryToSave = { ...rest, vaultId: newVaultId };
            
            // We are essentially editing the item to change its vaultId
            const movedItem = await saveItem(entryToSave, item);
            
            // Update the local items state with the moved item
            setItems(prev => prev.map(i => i.UUID_Identifier === movedItem.UUID_Identifier ? movedItem : i));
            
            // Switch the view to the destination vault
            setSelectedVaultId(newVaultId);

            // Select the moved item in the new vault's list
            setSelectedItemId(movedItem.UUID_Identifier);

            showToast(t('item_moved_successfully'), 'success');
        } catch (error) {
             console.error("Failed to move item:", error);
            showToast(t('failed_to_move_item'), "error");
        }
    };

    const handleCreateVault = async (name: string, icon: string) => {
        try {
            await createVault(name, icon);
            showToast(t('vault_created', { name }), 'success');
            setIsCreateVaultModalOpen(false);
        } catch (error) {
            console.error("Failed to create vault:", error);
            showToast((error as Error).message || t('failed_to_create_vault'), "error");
        }
    };
    
    const handleUpdateVault = async (vaultId: number, name: string, icon: string) => {
        try {
            await updateVaultDetails(vaultId, name, icon);
            showToast(t('vault_updated', { name }), 'success');
            setEditingVault(null);
        } catch (error) {
            console.error("Failed to update vault:", error);
            showToast((error as Error).message || t('failed_to_update_vault'), "error");
        }
    }

    const handleEditItemRequest = (item: Item) => {
        setEditingItem(item);
        setIsModalOpen(true);
    };
    
    const handleDeleteItemRequest = (item: Item) => {
        setDeletingThing({ type: 'item', data: item });
    };

    const handleDeleteVaultRequest = (vault: Vault) => {
        setDeletingThing({ type: 'vault', data: vault });
    };

    const handleEditVaultRequest = (vault: Vault) => {
        setEditingVault(vault);
    };

    const handleNewItemRequest = (type: ItemType) => {
        setEditingItem(null);
        setNewItemType(type);
        setIsModalOpen(true);
    };

    const currentVaultName = selectedVaultId === 'all' 
        ? t('all_items') 
        : session?.vaults.find(v => v.id === selectedVaultId)?.name || '';

    return (
        <div className="h-screen w-screen flex items-center justify-center p-0 md:p-4 bg-transparent">
            <div className="relative flex h-full w-full max-w-7xl font-sans antialiased">
                {session && (
                    <LeftSidebar 
                        isOpen={isSidebarOpen} 
                        onClose={() => setIsSidebarOpen(false)}
                        vaults={session.vaults}
                        itemCounts={itemCountsByVault}
                        selectedVaultId={selectedVaultId}
                        onSelectVault={setSelectedVaultId}
                        onAddNewVault={() => setIsCreateVaultModalOpen(true)}
                        onEditVault={handleEditVaultRequest}
                        onDeleteVault={handleDeleteVaultRequest}
                        onOpenSettings={() => setIsSettingsModalOpen(true)}
                    />
                )}
                <div className="flex flex-col flex-1 min-w-0 bg-panel/70 dark:bg-panel/30 backdrop-blur-xl lg:rounded-r-2xl border-l-0 lg:border lg:border-l-0 lg:border-gray-200/80 dark:lg:border-white/10">
                     <Header 
                        onNewItemRequest={handleNewItemRequest} 
                        searchTerm={searchTerm} 
                        setSearchTerm={setSearchTerm} 
                        vaultName={currentVaultName}
                        onToggleSidebar={() => setIsSidebarOpen(true)}
                    />
                    <div className="flex flex-1 overflow-hidden border-t border-border-color/10 dark:border-white/5">
                        <div className={`w-full md:w-80 lg:w-96 flex-shrink-0 border-r border-border-color/10 dark:border-white/5 md:flex flex-col ${selectedItemId ? 'hidden' : 'flex'} md:flex`}>
                            <ItemList 
                                items={sortedAndFilteredItems} 
                                isLoading={isLoading} 
                                selectedItemId={selectedItemId}
                                sortOption={sortOption}
                                onSelectItem={setSelectedItemId} 
                                onEdit={handleEditItemRequest}
                                onMove={setMovingItem}
                                onDelete={handleDeleteItemRequest}
                                onSortChange={setSortOption}
                            />
                        </div>
                        <div className={`w-full flex-1 md:flex flex-col ${!selectedItemId ? 'hidden' : 'flex'} md:flex`}>
                            <ItemDetailView
                                item={selectedItem}
                                vaults={session?.vaults || []}
                                onEdit={handleEditItemRequest}
                                onDelete={handleDeleteItemRequest}
                                onMove={setMovingItem}
                                onBack={() => setSelectedItemId(null)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {isModalOpen && session && (
                <ItemModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSaveItem}
                    existingItem={editingItem}
                    itemType={newItemType}
                    vaults={session.vaults}
                    defaultVaultId={selectedVaultId !== 'all' ? selectedVaultId : undefined}
                />
            )}
            <CreateVaultModal
                isOpen={isCreateVaultModalOpen}
                onClose={() => setIsCreateVaultModalOpen(false)}
                onCreate={handleCreateVault}
            />
             <SettingsModal 
                isOpen={isSettingsModalOpen}
                onClose={() => setIsSettingsModalOpen(false)}
                onImportComplete={() => loadItems(true)}
            />
            {movingItem && session && (
                <MoveVaultModal
                    isOpen={!!movingItem}
                    onClose={() => setMovingItem(null)}
                    onMove={(newVaultId) => handleMoveItem(movingItem, newVaultId)}
                    vaults={session.vaults}
                    currentVaultId={movingItem.vaultId}
                />
            )}
             {deletingThing && (
                <DeleteConfirmationModal
                    isOpen={!!deletingThing}
                    onClose={() => setDeletingThing(null)}
                    onConfirm={handleConfirmDelete}
                    itemType={deletingThing.type}
                    itemName={deletingThing.type === 'vault' ? deletingThing.data.name : deletingThing.data.title}
                />
            )}
            {editingVault && (
                <EditVaultModal
                    isOpen={!!editingVault}
                    onClose={() => setEditingVault(null)}
                    onUpdate={handleUpdateVault}
                    vault={editingVault}
                />
            )}
        </div>
    );
};

export default Dashboard;