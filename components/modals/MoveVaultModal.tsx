import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Vault } from '../../types';

interface MoveVaultModalProps {
    isOpen: boolean;
    onClose: () => void;
    onMove: (newVaultId: number) => void;
    vaults: Vault[];
    currentVaultId: number;
}

const MoveVaultModal: React.FC<MoveVaultModalProps> = ({ isOpen, onClose, onMove, vaults, currentVaultId }) => {
    const { t } = useTranslation();
    const [targetVaultId, setTargetVaultId] = useState('');
    
    const availableVaults = useMemo(() => 
        vaults.filter(v => v.id !== currentVaultId),
        [vaults, currentVaultId]
    );

    useEffect(() => {
        // Set the initial default vault only when the modal is opened
        // or when the list of available vaults changes.
        if (isOpen && availableVaults.length > 0) {
            setTargetVaultId(String(availableVaults[0].id));
        } else if (!isOpen) {
            // Reset when closing
            setTargetVaultId('');
        }
    }, [isOpen, availableVaults]);

    if (!isOpen) return null;
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (targetVaultId) {
            onMove(parseInt(targetVaultId, 10));
        }
    };

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-xl z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="w-full max-w-sm rounded-2xl shadow-xl bg-panel/80 dark:bg-panel/60 backdrop-blur-2xl border border-border-color/10 dark:border-white/10" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-border-color/10 dark:border-white/5">
                    <h2 className="text-xl font-bold text-text-primary">{t('move_item_title')}</h2>
                </div>
                {availableVaults.length > 0 ? (
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">{t('select_destination_vault')}</label>
                            <select value={targetVaultId} onChange={e => setTargetVaultId(e.target.value)} className="block w-full bg-black/20 border border-border-color/20 dark:border-white/10 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-accent-start focus:border-transparent">
                                {availableVaults.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                            </select>
                        </div>
                        <div className="flex justify-end space-x-4 pt-2">
                           <button type="button" onClick={onClose} className="py-2 px-5 bg-black/10 dark:bg-white/10 text-text-primary rounded-lg hover:opacity-80 transition-opacity">{t('cancel')}</button>
                            <button type="submit" className="py-2 px-5 accent-gradient text-white rounded-lg hover:opacity-90 transition-opacity font-semibold">{t('move')}</button>
                        </div>
                    </form>
                ) : (
                    <div className="p-6">
                        <p className="text-text-secondary text-center">{t('no_other_vaults')}</p>
                        <div className="flex justify-end pt-6">
                             <button type="button" onClick={onClose} className="py-2 px-5 bg-black/10 dark:bg-white/10 text-text-primary rounded-lg hover:opacity-80 transition-opacity">{t('close')}</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MoveVaultModal;