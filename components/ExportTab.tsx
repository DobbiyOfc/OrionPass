import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Item, LoginItem, NoteItem } from '../types';
import { Download, Loader2, AlertTriangle, Lock } from 'lucide-react';

const ExportTab: React.FC = () => {
    const { t } = useTranslation();
    const { getDecryptedItems, session, unlock } = useAuth();
    const { showToast } = useToast();
    const [isExporting, setIsExporting] = useState(false);
    const [masterPassword, setMasterPassword] = useState('');

    const handleExport = async () => {
        if (!masterPassword) {
            showToast(t('master_password_required'), 'error');
            return;
        }

        setIsExporting(true);
        const isUnlocked = await unlock(masterPassword);
        
        if (!isUnlocked) {
            setIsExporting(false);
            // unlock shows its own toast on failure
            return;
        }

        try {
            const items = await getDecryptedItems();
            const vaults = session?.vaults || [];
            const vaultMap = new Map(vaults.map(v => [v.id, v.name]));

            const header = "name,type,url,email,username,password,note,totp,createTime,modifyTime,vault\n";
            
            const csvRows = items.map(item => {
                const escapeCsv = (str: string | undefined | null): string => {
                    if (str === null || str === undefined) return '';
                    const s = String(str);
                    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                        return `"${s.replace(/"/g, '""')}"`;
                    }
                    return s;
                };

                const common = {
                    name: item.title,
                    createTime: new Date(item.createdAt).toISOString(),
                    modifyTime: new Date(item.updatedAt).toISOString(),
                    vault: vaultMap.get(item.vaultId) || ''
                };

                if (item.type === 'login') {
                    const login = item as LoginItem;
                    return [
                        escapeCsv(common.name),
                        'login',
                        escapeCsv(login.url),
                        '', // email field from proton, we use username
                        escapeCsv(login.username),
                        escapeCsv(login.password),
                        escapeCsv(login.notes),
                        '', // totp is not supported yet
                        escapeCsv(common.createTime),
                        escapeCsv(common.modifyTime),
                        escapeCsv(common.vault)
                    ].join(',');
                } else if (item.type === 'note') {
                    const note = item as NoteItem;
                    return [
                        escapeCsv(common.name),
                        'note',
                        '', '', '', '', // no url/user/pass for notes
                        escapeCsv(note.notes),
                        '', // totp
                        escapeCsv(common.createTime),
                        escapeCsv(common.modifyTime),
                        escapeCsv(common.vault)
                    ].join(',');
                }
                return '';
            }).filter(Boolean).join('\n');

            const csvContent = header + csvRows;
            const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' }); // Add BOM for Excel compatibility
            const link = document.createElement("a");
            
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `orion_vault_export_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            setMasterPassword(''); // Clear password after successful export

        } catch (e) {
            console.error("Export failed:", e);
            showToast((e as Error).message || t('import_failed'), "error");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="space-y-6">
            <h3 className="text-lg font-semibold text-text-primary">{t('export_vault_title')}</h3>
            
            <div className="p-4 bg-yellow-500/10 border-l-4 border-yellow-500 text-yellow-200 rounded-r-lg">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <AlertTriangle className="h-5 w-5 text-yellow-400" aria-hidden="true" />
                    </div>
                    <div className="ml-3">
                        <p className="text-sm">
                            {t('export_vault_warning')}
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">{t('master_password_required')}</label>
                     <p className="text-xs text-text-secondary mb-2">{t('master_password_prompt_export')}</p>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary pointer-events-none" />
                        <input 
                            type="password"
                            value={masterPassword}
                            onChange={e => setMasterPassword(e.target.value)}
                            className="w-full max-w-sm pl-10 pr-3 py-2 bg-black/20 border border-border-color/20 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent-start focus:border-transparent"
                            placeholder={t('master_password_placeholder')}
                        />
                    </div>
                </div>
            </div>


            <div className="flex justify-end">
                 <button 
                    onClick={handleExport} 
                    disabled={isExporting || !masterPassword}
                    className="w-40 flex justify-center items-center gap-2 py-2 px-5 accent-gradient text-white rounded-lg hover:opacity-90 transition-opacity font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isExporting ? (
                        <>
                            <Loader2 className="animate-spin" size={20} />
                            <span>{t('exporting_data')}</span>
                        </>
                    ) : (
                         <>
                            <Download size={18} />
                            <span>{t('export_button')}</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default ExportTab;