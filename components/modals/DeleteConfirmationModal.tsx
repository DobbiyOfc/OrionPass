import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';

interface DeleteConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    itemName: string;
    itemType: 'item' | 'vault';
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({ isOpen, onClose, onConfirm, itemName, itemType }) => {
    const [confirmationInput, setConfirmationInput] = useState('');
    const { t } = useTranslation();
    const isConfirmed = confirmationInput === itemName;

    useEffect(() => {
        if (isOpen) {
            setConfirmationInput('');
        }
    }, [isOpen]);

    if (!isOpen) return null;
    
    const translatedItemType = t(itemType);

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-xl z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="w-full max-w-sm rounded-2xl shadow-xl bg-panel/80 dark:bg-panel/60 backdrop-blur-2xl border border-border-color/10 dark:border-white/10" onClick={e => e.stopPropagation()}>
                <div className="p-6 text-center">
                    <AlertTriangle className="h-12 w-12 text-danger mx-auto mb-4"/>
                    <h2 className="text-xl font-bold text-text-primary">{t('delete_confirmation_title', { itemType: translatedItemType })}</h2>
                </div>
                <div className="p-6 space-y-4">
                    <p className="text-sm text-text-secondary text-center">
                        {t('delete_confirmation_message', { itemType: translatedItemType })} <strong className="font-bold text-text-primary">{itemName}</strong>.
                    </p>
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">{t('delete_confirmation_prompt')}</label>
                        <input
                            type="text"
                            value={confirmationInput}
                            onChange={e => setConfirmationInput(e.target.value)}
                            className="block w-full bg-black/20 border border-border-color/20 dark:border-white/10 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-danger focus:border-transparent"
                            placeholder={itemName}
                            autoFocus
                        />
                    </div>
                    <div className="flex justify-end space-x-4 pt-2">
                        <button type="button" onClick={onClose} className="py-2 px-5 bg-black/10 dark:bg-white/10 text-text-primary rounded-lg hover:opacity-80 transition-opacity">{t('cancel')}</button>
                        <button 
                            type="button" 
                            onClick={onConfirm}
                            disabled={!isConfirmed}
                            className="py-2 px-5 bg-danger text-white rounded-lg font-semibold transition-opacity disabled:opacity-50 disabled:cursor-not-allowed hover:bg-rose-700"
                        >
                            {t('delete')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DeleteConfirmationModal;
