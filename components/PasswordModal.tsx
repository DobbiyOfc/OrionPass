

import React, { useState, useEffect } from 'react';
import { Item, Vault, ItemType, LoginItem, NoteItem } from '../types';
import PasswordGenerator from './PasswordGenerator';
import { Sparkles, X, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';


interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: Omit<LoginItem, 'id' | 'UUID_Identifier' | 'createdAt' | 'updatedAt'> | Omit<NoteItem, 'id' | 'UUID_Identifier' | 'createdAt' | 'updatedAt'>, existingItem: Item | null) => Promise<void>;
  existingItem: Item | null;
  itemType: ItemType;
  vaults: Vault[];
  defaultVaultId?: number;
}

const ItemModal: React.FC<ItemModalProps> = ({ isOpen, onClose, onSave, existingItem, itemType, vaults, defaultVaultId }) => {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [notes, setNotes] = useState('');
  const [vaultId, setVaultId] = useState<number | string>('');
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { t } = useTranslation();

  const currentItemType = existingItem ? existingItem.type : itemType;

  useEffect(() => {
    if (existingItem) {
      setTitle(existingItem.title);
      setVaultId(existingItem.vaultId);
      if (existingItem.type === 'login') {
        setUrl(existingItem.url);
        setUsername(existingItem.username);
        setPassword(existingItem.password || '');
        setNotes(existingItem.notes);
      }
      if (existingItem.type === 'note') {
        setNotes(existingItem.notes);
      }
    } else {
      // Reset for new item
      setTitle('');
      setUrl('');
      setUsername('');
      setPassword('');
      setNotes('');
      setVaultId(defaultVaultId || (vaults.length > 0 ? vaults[0].id : ''));
    }
    setIsSaving(false);
  }, [existingItem, isOpen, vaults, defaultVaultId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || !title || !vaultId) {
        if(!title || !vaultId) alert("Title and Vault are required.");
        return;
    }
    
    const numericVaultId = typeof vaultId === 'string' ? parseInt(vaultId, 10) : vaultId;
    if (isNaN(numericVaultId)) {
      alert("Invalid Vault selected.");
      return;
    }


    let entryData: Omit<LoginItem, 'id' | 'UUID_Identifier' | 'createdAt' | 'updatedAt'> | Omit<NoteItem, 'id' | 'UUID_Identifier' | 'createdAt' | 'updatedAt'>;

    switch(currentItemType) {
        case 'login': {
            entryData = { type: 'login', title, url, username, password, notes, vaultId: numericVaultId };
            break;
        }
        case 'note': {
            entryData = { type: 'note', title, notes, vaultId: numericVaultId };
            break;
        }
        default:
            console.error("Unknown item type");
            return;
    }

    setIsSaving(true);
    try {
        await onSave(entryData, existingItem);
    } catch (error) {
        console.error("Save operation failed from modal perspective:", error);
    } finally {
        setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const getTitle = () => {
      if (existingItem) return t('edit_item');
      switch(itemType) {
          case 'login': return t('create_login');
          case 'note': return t('create_note');
          default: return t('create_item');
      }
  }

  return (
    <>
    <div className="fixed inset-0 bg-black/30 backdrop-blur-xl z-40 flex justify-center items-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl shadow-xl bg-panel/80 dark:bg-panel/60 backdrop-blur-2xl border border-border-color/10 dark:border-white/10 relative" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-border-color/10 dark:border-white/5">
            <h2 className="text-2xl font-bold text-text-primary">{getTitle()}</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">{t('vault')}</label>
                <select value={vaultId} onChange={e => setVaultId(e.target.value)} required className="block w-full bg-black/20 border border-border-color/20 dark:border-white/10 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-accent-start focus:border-transparent">
                    {vaults.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">{t('title')}</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} required className="block w-full bg-black/20 border border-border-color/20 dark:border-white/10 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-accent-start focus:border-transparent"/>
            </div>

            {currentItemType === 'login' && (
                <>
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">{t('url')}</label>
                        <input type="text" value={url} onChange={e => setUrl(e.target.value)} className="block w-full bg-black/20 border border-border-color/20 dark:border-white/10 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-accent-start focus:border-transparent"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">{t('username')}</label>
                        <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="block w-full bg-black/20 border border-border-color/20 dark:border-white/10 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-accent-start focus:border-transparent"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">{t('password')}</label>
                        <div className="relative">
                            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="block w-full bg-black/20 border border-border-color/20 dark:border-white/10 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-accent-start focus:border-transparent pr-10"/>
                            <button type="button" onClick={() => setIsGeneratorOpen(true)} className="absolute inset-y-0 right-0 px-3 flex items-center text-text-secondary hover:text-accent-start" title={t('password_generator')}>
                                <Sparkles size={18} />
                            </button>
                        </div>
                    </div>
                </>
            )}
            
            {(currentItemType === 'login' || currentItemType === 'note') && (
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">{t('notes')}</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={currentItemType === 'note' ? 8 : 3} className="block w-full bg-black/20 border border-border-color/20 dark:border-white/10 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-accent-start focus:border-transparent"/>
                </div>
            )}
            
            <div className="flex justify-end space-x-4 pt-4">
                <button type="button" onClick={onClose} className="py-2 px-5 bg-black/10 dark:bg-white/10 text-text-primary rounded-lg hover:opacity-80 transition-opacity">{t('cancel')}</button>
                <button 
                    type="submit" 
                    disabled={isSaving}
                    className="w-24 flex justify-center py-2 px-5 accent-gradient text-white rounded-lg hover:opacity-90 transition-opacity font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : t('save')}
                </button>
            </div>
        </form>
        <button onClick={onClose} className="absolute top-5 right-5 p-2 rounded-full text-text-secondary hover:bg-black/10 dark:hover:bg-white/10 hover:text-text-primary transition-colors">
            <X size={20} />
        </button>
      </div>
    </div>
    {isGeneratorOpen && (
        <PasswordGenerator 
            isOpen={isGeneratorOpen}
            onClose={() => setIsGeneratorOpen(false)}
            onGenerated={(newPassword) => {
                setPassword(newPassword);
                setIsGeneratorOpen(false);
            }}
        />
    )}
    </>
  );
};

export default ItemModal;