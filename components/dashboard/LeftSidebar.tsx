
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Vault } from '../../types';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { 
    Plus, ShieldCheck, Vault as VaultIcon,
    Trash2, User, Edit, MoreHorizontal, X,
    Settings, ExternalLink, LogOut
} from 'lucide-react';
import { iconComponents } from '../icons';

declare const chrome: any;

interface LeftSidebarProps { 
    isOpen: boolean; 
    onClose: () => void; 
    vaults: Vault[]; 
    itemCounts: Map<number, number>;
    selectedVaultId: number | 'all';
    onSelectVault: (id: number | 'all') => void;
    onAddNewVault: () => void;
    onEditVault: (vault: Vault) => void;
    onDeleteVault: (vault: Vault) => void;
    onOpenSettings: () => void;
}

const LeftSidebar: React.FC<LeftSidebarProps> = ({ isOpen, onClose, vaults, itemCounts, selectedVaultId, onSelectVault, onAddNewVault, onEditVault, onDeleteVault, onOpenSettings }) => {
    const { session, logout } = useAuth();
    const { t } = useTranslation();
    const totalCount = useMemo(() => Array.from(itemCounts.values()).reduce((sum, count) => sum + count, 0), [itemCounts]);
    const [openVaultMenuId, setOpenVaultMenuId] = useState<number | null>(null);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    
    const vaultMenuRef = useRef<HTMLDivElement>(null);
    const userMenuRef = useRef<HTMLDivElement>(null);

    const isPopup = typeof chrome !== 'undefined' && chrome.action;


    const handleOpenFullView = () => {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({ action: 'openFullApp' });
            window.close();
        }
    };

    const handleOpenSettings = () => {
        setIsUserMenuOpen(false);
        if (isPopup) {
            // Open full page app with a query param to show settings
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                chrome.runtime.sendMessage({ action: 'openFullApp', payload: { query: '?view=settings' } });
                window.close(); // Close the popup
            }
        } else {
            onOpenSettings(); // Open modal in full view
        }
    };


     useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (openVaultMenuId && vaultMenuRef.current && !vaultMenuRef.current.contains(event.target as Node)) {
                setOpenVaultMenuId(null);
            }
            if(isUserMenuOpen && userMenuRef.current && !userMenuRef.current.contains(event.target as Node)){
                setIsUserMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [openVaultMenuId, isUserMenuOpen]);

    const getVaultIcon = (vault: Vault) => {
        const iconName = vault.icon || 'folder';
        const IconComponent = iconComponents[iconName] || iconComponents['folder'];
        return <IconComponent className="mr-3 h-5 w-5" />;
    };

    return (
        <>
            {isOpen && <div onClick={onClose} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden" />}
            <aside className={`fixed lg:static inset-y-0 left-0 w-64 bg-panel/70 dark:bg-panel/30 backdrop-blur-xl flex-shrink-0 flex flex-col rounded-r-2xl lg:rounded-r-none lg:rounded-l-2xl border border-gray-200/80 dark:border-white/10 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-300 ease-in-out z-40 lg:border-r-0`}>
                <div className="p-4 flex items-center justify-between h-20">
                    <div className="flex items-center space-x-3">
                        <ShieldCheck className="h-8 w-8 accent-gradient-text"/>
                        <h1 className="text-xl font-bold text-text-primary">{t('vaultsafe')}</h1>
                    </div>
                    <button onClick={onClose} className="lg:hidden p-1 text-text-secondary hover:text-text-primary">
                        <X size={24}/>
                    </button>
                </div>
            
                <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
                    <div className="px-2 pb-4">
                        <div className="flex justify-between items-center mb-2">
                            <h2 className="text-xs font-semibold tracking-wider uppercase text-text-secondary">{t('vaults')}</h2>
                            <button onClick={onAddNewVault} className="p-1 text-text-secondary hover:text-text-primary"><Plus size={16}/></button>
                        </div>
                        <ul className="space-y-1">
                            <li><button onClick={() => onSelectVault('all')} className={clsx("w-full flex items-center p-3 text-sm font-medium rounded-lg transition-colors", selectedVaultId === 'all' ? 'text-text-primary bg-black/10 dark:bg-white/10' : 'text-text-secondary hover:bg-black/5 dark:hover:bg-white/5 hover:text-text-primary')}>
                                <VaultIcon className="mr-3 h-5 w-5"/> {t('all_items')} <span className="ml-auto text-xs bg-accent-start/50 text-white/80 px-2 py-0.5 rounded-full">{totalCount}</span>
                            </button></li>
                            {vaults.map((vault) => (
                                <li key={vault.id} className="relative group">
                                    <button onClick={() => onSelectVault(vault.id)} className={clsx("w-full flex items-center p-3 text-sm font-medium rounded-lg transition-colors", selectedVaultId === vault.id ? 'text-text-primary bg-black/10 dark:bg-white/10' : 'text-text-secondary hover:bg-black/5 dark:hover:bg-white/5 hover:text-text-primary')}>
                                        {getVaultIcon(vault)}
                                        <span className="truncate flex-1 text-left">{vault.name}</span>
                                        <span className="ml-auto text-xs opacity-50 group-hover:opacity-0 transition-opacity">
                                            {itemCounts.get(vault.id) || 0}
                                        </span>
                                    </button>
                                    <div className="absolute top-1/2 right-2 -translate-y-1/2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="text-xs text-text-secondary mr-1">
                                            {itemCounts.get(vault.id) || 0}
                                        </span>
                                        <div className="relative">
                                            <button
                                                onClick={() => setOpenVaultMenuId(openVaultMenuId === vault.id ? null : vault.id)}
                                                className="p-2 rounded-full text-text-secondary hover:bg-black/5 dark:hover:bg-white/5"
                                                aria-label={t('vault_options')}
                                            >
                                                <MoreHorizontal size={18} />
                                            </button>
                                            {openVaultMenuId === vault.id && (
                                                <div
                                                    ref={vaultMenuRef}
                                                    className="absolute bottom-full right-0 mb-1 w-40 bg-background rounded-lg shadow-lg border border-border-color z-20 origin-bottom-right animate-fade-in-fast"
                                                >
                                                    <ul className="py-1">
                                                        <li><button onClick={() => { onEditVault(vault); setOpenVaultMenuId(null); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-text-primary hover:bg-black/5 dark:hover:bg-white/5">
                                                            <Edit size={14}/> {t('edit')}
                                                        </button></li>
                                                        <li><button onClick={() => { onDeleteVault(vault); setOpenVaultMenuId(null); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-danger hover:bg-danger/10">
                                                            <Trash2 size={14}/> {t('delete')}
                                                        </button></li>
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </nav>

                <div className="p-4 mt-auto relative" ref={userMenuRef}>
                    {isUserMenuOpen && (
                        <div className="absolute bottom-full left-4 right-4 mb-2 w-auto bg-background rounded-lg shadow-lg border border-border-color z-20 origin-bottom animate-fade-in-fast">
                             <ul className="py-2">
                                {isPopup && (
                                    <li><button onClick={handleOpenFullView} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-text-primary hover:bg-black/5 dark:hover:bg-white/5">
                                        <ExternalLink size={14}/> {t('open_in_full_view')}
                                    </button></li>
                                )}
                                <li><button onClick={handleOpenSettings} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-text-primary hover:bg-black/5 dark:hover:bg-white/5">
                                    <Settings size={14}/> {t('settings')}
                                </button></li>
                                <li><button onClick={logout} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-text-primary hover:bg-black/5 dark:hover:bg-white/5">
                                    <LogOut size={14}/> {t('logout')}
                                </button></li>
                            </ul>
                        </div>
                    )}
                    {session && (
                        <button onClick={() => setIsUserMenuOpen(p => !p)} className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                            <div className="flex items-center space-x-3 min-w-0">
                                <div className="h-9 w-9 accent-gradient rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                    {session.email.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0 text-left">
                                    <p className="text-sm font-medium text-text-primary truncate">{session.email}</p>
                                </div>
                            </div>
                            <MoreHorizontal className="h-5 w-5 text-text-secondary flex-shrink-0" />
                        </button>
                    )}
                </div>
            </aside>
        </>
    );
};

export default LeftSidebar;
