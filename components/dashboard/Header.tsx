
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Menu, User, StickyNote } from 'lucide-react';
import { ItemType } from '../../types';

interface HeaderProps {
    onToggleSidebar: () => void; 
    onNewItemRequest: (type: ItemType) => void; 
    searchTerm: string; 
    setSearchTerm: (term: string) => void; 
    vaultName: string; 
}

const Header: React.FC<HeaderProps> = ({ onToggleSidebar, onNewItemRequest, searchTerm, setSearchTerm, vaultName }) => {
    const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
    const { t } = useTranslation();
    const createMenuRef = useRef<HTMLDivElement>(null);

     useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isCreateMenuOpen && createMenuRef.current && !createMenuRef.current.contains(event.target as Node)) {
                setIsCreateMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isCreateMenuOpen]);

    const handleSelectType = (type: ItemType) => {
        setIsCreateMenuOpen(false);
        onNewItemRequest(type);
    };
    
    return (
        <header className="flex items-center h-20 px-4 md:px-6 flex-shrink-0 space-x-4">
            <button onClick={onToggleSidebar} className="p-2 -ml-2 text-text-secondary lg:hidden">
                <Menu size={24} />
            </button>
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
                <input
                    type="text"
                    placeholder={t('search_in', { vaultName })}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-black/10 dark:bg-white/5 text-text-primary border border-border-color/20 dark:border-white/10 rounded-lg focus:ring-accent-start focus:border-accent-start transition-colors"
                />
            </div>
            <div className="relative" ref={createMenuRef}>
                <button onClick={() => setIsCreateMenuOpen(prev => !prev)} className="flex-shrink-0 flex items-center space-x-2 accent-gradient text-white px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                    <Plus size={16} />
                    <span className="hidden sm:inline">{t('create_item')}</span>
                </button>
                 {isCreateMenuOpen && (
                    <div className="absolute top-full right-0 mt-2 w-56 bg-background rounded-lg shadow-lg border border-border-color z-20 origin-top-right animate-fade-in-fast">
                        <ul className="p-2 space-y-1">
                            <li><button onClick={() => handleSelectType('login')} className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md text-text-primary hover:bg-black/5 dark:hover:bg-white/5">
                                <User size={16}/> {t('login')}
                            </button></li>
                            <li><button onClick={() => handleSelectType('note')} className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md text-text-primary hover:bg-black/5 dark:hover:bg-white/5">
                                <StickyNote size={16}/> {t('secure_note')}
                            </button></li>
                        </ul>
                    </div>
                )}
            </div>
        </header>
    );
}

export default Header;
