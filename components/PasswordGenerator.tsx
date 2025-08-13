



import React, { useState, useEffect, useCallback } from 'react';
import { cryptoService } from '../services/cryptoService';
import { useToast } from '../contexts/ToastContext';
import { RefreshCw, Copy, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PasswordGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerated: (password: string) => void;
}

const PasswordGenerator: React.FC<PasswordGeneratorProps> = ({ isOpen, onClose, onGenerated }) => {
  const [length, setLength] = useState(16);
  const [useNumbers, setUseNumbers] = useState(true);
  const [useSymbols, setUseSymbols] = useState(true);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const { showToast } = useToast();
  const { t } = useTranslation();

  const generate = useCallback(() => {
    const newPassword = cryptoService.generatePassword(length, useNumbers, useSymbols);
    setGeneratedPassword(newPassword);
  }, [length, useNumbers, useSymbols]);

  useEffect(() => {
    if (isOpen) {
      generate();
    }
  }, [isOpen, generate]);

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedPassword)
      .then(() => showToast(t('copied_to_clipboard', { field: t('password') }), 'success'))
      .catch(() => showToast(t('failed_to_copy', { field: t('password') }), 'error'));
  };

  const handleUsePassword = () => {
    onGenerated(generatedPassword);
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-xl z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl shadow-xl bg-panel/80 dark:bg-panel/60 backdrop-blur-2xl border border-border-color/10 dark:border-white/10" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-border-color/10 dark:border-white/5 flex justify-between items-center">
            <h2 className="text-2xl font-bold text-text-primary">{t('password_generator')}</h2>
            <button onClick={onClose} className="p-2 rounded-full text-text-secondary hover:bg-black/10 dark:hover:bg-white/10 hover:text-text-primary transition-colors">
                <X size={20} />
            </button>
        </div>
        
        <div className="p-6 space-y-6">
            <div className="relative bg-black/20 p-4 rounded-lg flex items-center border border-border-color/20 dark:border-white/10">
                <span className="font-mono text-lg text-text-primary flex-grow break-all">{generatedPassword}</span>
                <div className="flex items-center pl-3 space-x-3">
                    <button onClick={generate} className="text-text-secondary hover:text-accent-start transition-colors" title={t('generate_new_password')}><RefreshCw size={18} /></button>
                    <button onClick={handleCopy} className="text-text-secondary hover:text-accent-start transition-colors" title={t('copy_password')}><Copy size={18} /></button>
                </div>
            </div>

            <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                    <label htmlFor="length" className="text-text-secondary">{t('length')}: <span className="text-text-primary font-medium">{length}</span></label>
                    <input id="length" type="range" min="8" max="64" value={length} onChange={e => setLength(parseInt(e.target.value, 10))} className="w-48 accent-accent-start"/>
                </div>
                <div className="flex items-center space-x-6">
                    <label className="flex items-center space-x-2 text-text-secondary cursor-pointer">
                        <input type="checkbox" checked={useNumbers} onChange={() => setUseNumbers(!useNumbers)} className="form-checkbox h-5 w-5 rounded bg-black/20 border-border-color/50 dark:border-white/10 text-accent-start focus:ring-accent-start"/>
                        <span>{t('numbers')}</span>
                    </label>
                    <label className="flex items-center space-x-2 text-text-secondary cursor-pointer">
                        <input type="checkbox" checked={useSymbols} onChange={() => setUseSymbols(!useSymbols)} className="form-checkbox h-5 w-5 rounded bg-black/20 border-border-color/50 dark:border-white/10 text-accent-start focus:ring-accent-start"/>
                        <span>{t('symbols')}</span>
                    </label>
                </div>
            </div>
        </div>

        <div className="flex justify-end space-x-4 p-6 border-t border-border-color/10 dark:border-white/5">
            <button type="button" onClick={onClose} className="py-2 px-5 bg-black/10 dark:bg-white/10 text-text-primary rounded-lg hover:opacity-80 transition-opacity">{t('cancel')}</button>
            <button type="button" onClick={handleUsePassword} className="py-2 px-5 accent-gradient text-white rounded-lg hover:opacity-90 transition-opacity font-semibold">{t('use_password')}</button>
        </div>
      </div>
    </div>
  );
};

export default PasswordGenerator;