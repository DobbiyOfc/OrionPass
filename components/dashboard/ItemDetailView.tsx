
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Item, Vault } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { 
    KeySquare, User, Globe, StickyNote, MoreHorizontal, Pencil, Zap,
    Edit, ArrowLeft, Eye, EyeOff, Copy
} from 'lucide-react';

const DetailField: React.FC<{ icon: React.ReactNode, label: string, value: string | React.ReactNode, isSecret?: boolean, copyValue?: string }> = ({ icon, label, value, isSecret = false, copyValue }) => {
    const [isVisible, setIsVisible] = useState(false);
    const { showToast } = useToast();
    const { t } = useTranslation();

    const handleCopy = () => {
        const textToCopy = copyValue ?? (typeof value === 'string' ? value : '');
        if (!textToCopy) return;
        navigator.clipboard.writeText(textToCopy)
            .then(() => showToast(t('copied_to_clipboard', { field: label }), 'success'))
            .catch(() => showToast(t('failed_to_copy', { field: label }), 'error'));
    };

    return (
        <div className="flex items-start py-5 border-b border-border-color/10 dark:border-white/5">
            <div className="flex-shrink-0 w-8 text-text-secondary pt-1">{icon}</div>
            <div className="flex-1 min-w-0 ml-4">
                <p className="text-sm text-text-secondary">{label}</p>
                <div className="flex items-center justify-between mt-1">
                    <div className="font-mono text-base text-text-primary truncate pr-4 whitespace-pre-wrap break-words">
                        {isSecret && !isVisible ? '••••••••••••' : value}
                    </div>
                    <div className="flex items-center space-x-4 flex-shrink-0 ml-4">
                        {isSecret && (
                            <button onClick={() => setIsVisible(!isVisible)} className="text-text-secondary hover:text-text-primary">
                                {isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        )}
                        {copyValue !== undefined && copyValue && (
                             <button onClick={handleCopy} className="text-text-secondary hover:text-text-primary">
                                <Copy size={18} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

interface ItemDetailViewProps { 
    item: Item | null; 
    vaults: Vault[];
    onEdit: (p: Item) => void; 
    onDelete: (p: Item) => void; 
    onMove: (p: Item) => void;
    onBack: () => void; 
}

const ItemDetailView: React.FC<ItemDetailViewProps> = ({ item, vaults, onEdit, onDelete, onMove, onBack }) => {
    const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
    const { t } = useTranslation();
    const moreMenuRef = useRef<HTMLDivElement>(null);

     useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isMoreMenuOpen && moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
                setIsMoreMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isMoreMenuOpen]);

    if (!item) {
        return (
            <div className="flex-1 items-center justify-center hidden md:flex">
                <div className="text-center">
                    <KeySquare size={48} className="mx-auto text-text-secondary opacity-50" />
                    <p className="mt-4 text-text-secondary">{t('select_item_prompt')}</p>
                </div>
            </div>
        );
    }
    const vaultName = vaults.find(v => v.id === item.vaultId)?.name || 'Unknown';
    
    return (
        <div className="flex-1 flex flex-col overflow-y-auto bg-transparent">
            <header className="p-4 md:p-6 flex justify-between items-center sticky top-0 bg-panel/80 dark:bg-panel/30 backdrop-blur-lg z-10 h-20 border-b border-border-color/10 dark:border-white/5">
                <div className="flex items-center flex-1 min-w-0">
                    <button onClick={onBack} className="md:hidden p-2 mr-2 text-text-secondary hover:text-text-primary">
                        <ArrowLeft size={22} />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-xl md:text-2xl font-bold text-text-primary truncate">{item.title}</h2>
                        <p className="text-sm text-text-secondary">{t('in_vault', { vaultName })}</p>
                    </div>
                </div>

                <div className="flex items-center space-x-1 md:space-x-2">
                    <button onClick={() => onEdit(item)} className="flex items-center space-x-2 bg-black/10 dark:bg-white/5 text-text-primary px-3 py-2 md:px-4 rounded-lg text-sm font-medium hover:opacity-80 transition-opacity">
                        <Edit size={16} />
                        <span className="hidden sm:inline">{t('edit')}</span>
                    </button>
                    <div className="relative" ref={moreMenuRef}>
                        <button onClick={() => setIsMoreMenuOpen(prev => !prev)} className="p-2.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/5 text-text-secondary" aria-label="More options">
                            <MoreHorizontal size={18} />
                        </button>
                        {isMoreMenuOpen && (
                            <div className="absolute top-full right-0 mt-2 w-56 bg-background rounded-lg shadow-lg border border-border-color z-20 origin-top-right animate-fade-in-fast">
                                <ul className="py-2">
                                    <li><button onClick={() => { onMove(item); setIsMoreMenuOpen(false); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-text-primary hover:bg-black/5 dark:hover:bg-white/5">{t('move_to_another_vault')}</button></li>
                                    <li><button onClick={() => { onDelete(item); setIsMoreMenuOpen(false); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-danger hover:bg-danger/10">{t('delete')}</button></li>
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <div className="p-4 md:p-6 flex-1">
                {item.type === 'login' && (
                    <>
                        <DetailField icon={<User size={20} />} label={t('username')} value={item.username} copyValue={item.username} />
                        <DetailField icon={<KeySquare size={20} />} label={t('password')} value={item.password} isSecret copyValue={item.password} />
                        <DetailField icon={<Globe size={20} />} label={t('website')} value={item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{item.url}</a> : 'N/A'} copyValue={item.url} />
                        <DetailField icon={<StickyNote size={20} />} label={t('notes')} value={item.notes || 'N/A'} copyValue={item.notes} />
                    </>
                )}
                 {item.type === 'note' && (
                    <>
                       <DetailField icon={<StickyNote size={20} />} label={t('notes')} value={item.notes || 'N/A'} copyValue={item.notes} />
                    </>
                )}
                
                <div className="mt-8 pt-6 border-t border-border-color/10 dark:border-white/5">
                    <h3 className="text-base font-semibold text-text-primary mb-4">{t('information')}</h3>
                    <div className="space-y-4 text-sm">
                        <div className="flex items-center"><Pencil className="mr-4 text-text-secondary" size={16}/>{t('last_modified')}: {new Date(item.updatedAt).toLocaleString()}</div>
                        <div className="flex items-center"><Zap className="mr-4 text-text-secondary" size={16}/>{t('created')}: {new Date(item.createdAt).toLocaleString()}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ItemDetailView;