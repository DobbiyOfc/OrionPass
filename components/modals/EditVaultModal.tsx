import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { iconService } from '../../services/iconService';
import { Vault } from '../../types';

interface EditVaultModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpdate: (vaultId: number, name: string, icon: string) => Promise<void>;
    vault: Vault;
}

const EditVaultModal: React.FC<EditVaultModalProps> = ({ isOpen, onClose, onUpdate, vault }) => {
    const [name, setName] = useState('');
    const [selectedIcon, setSelectedIcon] = useState('folder');
    const { t } = useTranslation();
    const IconPicker = iconService.IconPicker;

    useEffect(() => {
        if (vault) {
            setName(vault.name);
            setSelectedIcon(vault.icon || 'folder');
        }
    }, [vault, isOpen]); // Rerun effect when isOpen becomes true
    
    if (!isOpen || !vault) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            onUpdate(vault.id, name.trim(), selectedIcon);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-xl z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="w-full max-w-sm rounded-2xl shadow-xl bg-panel/80 dark:bg-panel/60 backdrop-blur-2xl border border-border-color/10 dark:border-white/10" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-border-color/10 dark:border-white/5">
                    <h2 className="text-xl font-bold text-text-primary">{t('edit_vault')}</h2>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">{t('vault_name')}</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} required autoFocus className="block w-full bg-black/20 border border-border-color/20 dark:border-white/10 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-accent-start focus:border-transparent"/>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">{t('icon')}</label>
                        <IconPicker selectedIcon={selectedIcon} onSelect={setSelectedIcon} />
                    </div>
                    <div className="flex justify-end space-x-4 pt-2">
                        <button type="button" onClick={onClose} className="py-2 px-5 bg-black/10 dark:bg-white/10 text-text-primary rounded-lg hover:opacity-80 transition-opacity">{t('cancel')}</button>
                        <button type="submit" className="py-2 px-5 accent-gradient text-white rounded-lg hover:opacity-90 transition-opacity font-semibold">{t('save')}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditVaultModal;
