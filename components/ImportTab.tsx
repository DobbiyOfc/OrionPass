import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { LoginItem, NoteItem, Vault } from '../types';
import { UploadCloud, FileText, Loader2, CheckCircle, ShieldCheck, ChevronRight, Lock } from 'lucide-react';
import clsx from 'clsx';

const parseCsv = (csvText: string): Record<string, string>[] => {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;
    const text = csvText.trim() + '\n';

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        
        if (inQuotes) {
            if (char === '"') {
                if (text[i+1] === '"') { 
                    currentField += '"';
                    i++; 
                } else { 
                    inQuotes = false;
                }
            } else {
                currentField += char;
            }
        } else { 
            if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                currentRow.push(currentField);
                currentField = '';
            } else if (char === '\n' || char === '\r') {
                if (text[i+1] === '\n' && char === '\r') i++;
                currentRow.push(currentField);
                if (currentRow.some(val => val.trim())) {
                    rows.push(currentRow);
                }
                currentRow = [];
                currentField = '';
            } else {
                currentField += char;
            }
        }
    }

    if (rows.length < 2) return [];

    const header = rows.shift()!.map(h => h.trim().toLowerCase());
    if (header[0].startsWith('\uFEFF')) {
        header[0] = header[0].substring(1);
    }
    const expectedColumnCount = header.length;
    const result: Record<string, string>[] = [];

    for (const row of rows) {
        if (row.length !== expectedColumnCount) continue;
        
        const obj: Record<string, string> = {};
        header.forEach((key, index) => {
            obj[key] = row[index] || '';
        });
        if(obj.name && obj.name.trim()) { 
            result.push(obj);
        }
    }
    
    return result;
};


type ManagerId = 'protonpass';

const managers: { id: ManagerId; name: string; icon: React.ReactNode }[] = [
    { id: 'protonpass', name: 'Proton Pass', icon: <ShieldCheck size={24} className="text-accent-start" /> },
];

const ImportTab: React.FC<{ onClose: () => void, onImportComplete?: () => void }> = ({ onClose, onImportComplete }) => {
    const { t } = useTranslation();
    const { session, createVault, saveItem, getDecryptedItems } = useAuth();
    const { showToast } = useToast();
    
    const [selectedManager, setSelectedManager] = useState<ManagerId | null>(null);
    const [step, setStep] = useState<'upload_file' | 'importing' | 'done'>('upload_file');
    const [file, setFile] = useState<File | null>(null);
    const [error, setError] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [importProgress, setImportProgress] = useState({ message: '', progress: 0 });
    const [importedCount, setImportedCount] = useState(0);
    const [skippedCount, setSkippedCount] = useState(0);

    const handleFileChange = (selectedFile: File | null) => {
        if (selectedFile && selectedFile.name.endsWith('.csv')) {
            setFile(selectedFile);
            setError('');
        } else {
            setFile(null);
            setError(t('import_csv_only_error'));
        }
    };
    
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileChange(e.dataTransfer.files[0]);
            e.dataTransfer.clearData();
        }
    };

    const handleDragEvents = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setIsDragging(true);
        } else if (e.type === 'dragleave') {
            setIsDragging(false);
        }
    };

    const handleImport = async () => {
        if (!file || !session) return;

        setStep('importing');
        setSkippedCount(0);

        try {
            const fileContent = await file.text();
            const parsedData = parseCsv(fileContent);
            if (parsedData.length === 0) throw new Error("CSV file is empty or could not be parsed.");
            
            const totalItems = parsedData.length;
            const existingItems = await getDecryptedItems();
            const existingLogins = new Set(
                existingItems
                    .filter(item => item.type === 'login')
                    .map((item: any) => `${(item as LoginItem).url?.toLowerCase().trim()}|${(item as LoginItem).username?.toLowerCase().trim()}`)
            );
            const existingNotes = new Set(
                existingItems
                    .filter(item => item.type === 'note')
                    .map((item: any) => (item as NoteItem).title?.toLowerCase().trim())
            );

            setImportProgress({ message: t('import_analyzing_vaults'), progress: 5 });
            const importVaultNames = [...new Set(parsedData.map(item => item.vault).filter(Boolean))];
            
            const existingVaults: Vault[] = [...session.vaults];
            const existingVaultNames = existingVaults.map(v => v.name.toLowerCase());
            const vaultsToCreate = importVaultNames.filter(name => !existingVaultNames.includes(name.toLowerCase()));

            const newVaults: Vault[] = [];
            for (const vaultName of vaultsToCreate) {
                const newVault = await createVault(vaultName, 'folder');
                newVaults.push(newVault);
            }
            const allVaults = [...existingVaults, ...newVaults];
            const vaultNameToIdMap = new Map(allVaults.map(v => [v.name.toLowerCase(), v.id]));
            
            setImportProgress({ message: t('importing_data'), progress: 15 });

            let importedItemsCount = 0;
            let currentSkippedCount = 0;
            for (const [index, pItem] of parsedData.entries()) {
                const defaultVaultId = session.vaults[0]?.id || allVaults[0]?.id;
                if (!defaultVaultId) throw new Error("Could not determine a default vault.");
                
                const vaultId = pItem.vault ? (vaultNameToIdMap.get(pItem.vault.toLowerCase()) || defaultVaultId) : defaultVaultId;
                
                let itemData: Omit<LoginItem, 'id' | 'UUID_Identifier'|'createdAt'|'updatedAt'> | Omit<NoteItem, 'id' |'UUID_Identifier'|'createdAt'|'updatedAt'>;

                if (pItem.type === 'login') {
                    const noteParts: string[] = [];
                    if (pItem.note) noteParts.push(pItem.note);
                    if (pItem.totp) noteParts.push(`TOTP Secret: ${pItem.totp}`);
                    const finalNotes = noteParts.join('\n\n');
                    
                    const finalUsername = pItem.email?.trim() || pItem.username?.trim() || '';

                    itemData = { type: 'login', title: pItem.name, url: pItem.url, username: finalUsername, password: pItem.password, notes: finalNotes, vaultId };
                } else { 
                    const noteParts: string[] = [];
                    if (pItem.note) noteParts.push(pItem.note);
                    if (pItem.type === 'alias' && pItem.email) noteParts.push(`Email Alias: ${pItem.email}`);
                    else if (pItem.email) noteParts.push(`Email: ${pItem.email}`);
                    if (pItem.totp) noteParts.push(`TOTP Secret: ${pItem.totp}`);
                    const finalNotes = noteParts.join('\n\n');
                    itemData = { type: 'note', title: pItem.name, notes: finalNotes, vaultId };
                }

                let isDuplicate = false;
                if (itemData.type === 'login') {
                    const loginKey = `${itemData.url?.toLowerCase().trim()}|${itemData.username?.toLowerCase().trim()}`;
                    if (existingLogins.has(loginKey)) isDuplicate = true;
                } else {
                    const noteKey = itemData.title?.toLowerCase().trim();
                    if (existingNotes.has(noteKey)) isDuplicate = true;
                }

                if (isDuplicate) {
                    currentSkippedCount++;
                    continue;
                }

                const now = Date.now();
                const createdAt = pItem.createtime && !isNaN(new Date(pItem.createtime).getTime()) ? new Date(pItem.createtime).getTime() : now;
                const updatedAt = pItem.modifytime && !isNaN(new Date(pItem.modifytime).getTime()) ? new Date(pItem.modifytime).getTime() : now;
                
                await saveItem(itemData, null, { createdAt, updatedAt });
                
                importedItemsCount++;
                setImportProgress({ 
                    message: t('import_progress', { current: importedItemsCount, total: totalItems - currentSkippedCount }),
                    progress: 15 + ((index + 1) / totalItems) * 80 
                });

                // Add delay between imports, but not after the last one.
                if (index < parsedData.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
            }

            setImportProgress({ message: t('import_done'), progress: 100 });
            setImportedCount(importedItemsCount);
            setSkippedCount(currentSkippedCount);
            
            const successMessage = currentSkippedCount > 0
                ? t('import_successful', { count: importedItemsCount, skipped: currentSkippedCount })
                : t('import_successful_no_skip', { count: importedItemsCount });
            showToast(successMessage, 'success');
            
            if (onImportComplete) onImportComplete();
            setStep('done');

        } catch (err) {
            console.error("Import failed:", err);
            showToast((err as Error).message || t('import_failed'), 'error');
            setStep('upload_file');
        }
    };

    const resetSelection = () => {
        setSelectedManager(null);
        setFile(null);
        setError('');
        setStep('upload_file');
    };
    
    const renderManagerSelection = () => (
        <div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">{t('select_your_manager')}</h3>
            <p className="text-sm text-text-secondary mb-6">{t('import_file_description')}</p>
            <div className="space-y-3">
                {managers.map(manager => (
                    <button
                        key={manager.id}
                        onClick={() => setSelectedManager(manager.id)}
                        className="w-full flex items-center p-4 bg-black/5 dark:bg-white/5 rounded-lg border border-border-color/10 dark:border-white/10 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                    >
                        {manager.icon}
                        <span className="ml-4 font-medium text-text-primary">{manager.name}</span>
                        <ChevronRight size={20} className="ml-auto text-text-secondary" />
                    </button>
                ))}
            </div>
        </div>
    );

    const renderUploader = () => (
        <div>
            <div className="mb-6">
                <div className="flex justify-between items-center mb-1">
                    <h3 className="text-lg font-semibold text-text-primary">{t('import_from', { manager: 'Proton Pass' })}</h3>
                    <button onClick={resetSelection} className="text-sm font-medium text-accent-start hover:underline">
                        {t('change_manager')}
                    </button>
                </div>
            </div>

            <div 
                onDrop={handleDrop} 
                onDragOver={handleDragEvents} 
                onDragEnter={handleDragEvents} 
                onDragLeave={handleDragEvents}
                className={clsx(
                    "relative border-2 border-dashed rounded-lg p-12 text-center transition-colors",
                    isDragging ? 'border-accent-start bg-accent-start/10' : 'border-border-color/30 dark:border-white/20'
                )}
            >
                <input
                    type="file"
                    accept=".csv"
                    onChange={e => handleFileChange(e.target.files ? e.target.files[0] : null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center">
                    <UploadCloud size={48} className="text-text-secondary mb-4" />
                    <p className="text-text-primary font-semibold">{t('upload_file_prompt')}</p>
                    <p className="text-text-secondary text-sm mt-1">Only .csv files are supported for this importer.</p>
                </div>
            </div>

            {file && (
                <div className="mt-4 p-3 bg-black/10 dark:bg-white/5 rounded-lg flex items-center">
                    <FileText size={20} className="text-accent-start mr-3 flex-shrink-0" />
                    <span className="text-sm text-text-primary truncate">{file.name}</span>
                    <button onClick={() => setFile(null)} className="ml-auto text-sm text-danger hover:underline">Remove</button>
                </div>
            )}
            {error && <p className="text-danger text-sm mt-2">{error}</p>}
            
             <div className="mt-6 space-y-4">
                <div className="text-right">
                    <button 
                        onClick={handleImport} 
                        disabled={!file}
                        className="py-2 px-8 accent-gradient text-white rounded-lg hover:opacity-90 transition-opacity font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {t('import_button')}
                    </button>
                </div>
            </div>
        </div>
    );

    const renderProgress = () => (
        <div className="flex flex-col items-center justify-center text-center py-16">
            <Loader2 size={48} className="animate-spin text-accent-start mb-6" />
            <h3 className="text-xl font-semibold text-text-primary">{t('importing_data')}</h3>
            <p className="text-text-secondary mt-2">{importProgress.message}</p>
            <div className="w-full bg-black/20 rounded-full h-2 mt-4 max-w-xs">
                <div 
                    className="h-2 rounded-full transition-all duration-300 bg-accent-start"
                    style={{ width: `${importProgress.progress}%` }}
                ></div>
            </div>
            <p className="text-text-secondary text-sm mt-4">{t('import_please_wait')}</p>
        </div>
    );
    
    const renderDone = () => (
        <div className="flex flex-col items-center justify-center text-center py-16">
            <CheckCircle size={48} className="text-success mb-6" />
            <h3 className="text-xl font-semibold text-text-primary">{t('import_done')}</h3>
            <p className="text-text-secondary mt-2">
                {skippedCount > 0 
                    ? t('import_successful', { count: importedCount, skipped: skippedCount })
                    : t('import_successful_no_skip', { count: importedCount })
                }
            </p>
             <button 
                onClick={onClose} 
                className="mt-8 py-2 px-8 accent-gradient text-white rounded-lg hover:opacity-90 transition-opacity font-semibold"
            >
                {t('close')}
            </button>
        </div>
    );

    const renderContent = () => {
        if (step === 'importing') {
            return renderProgress();
        }
        if (step === 'done') {
            return renderDone();
        }
        if (selectedManager) {
            return renderUploader();
        }
        return renderManagerSelection();
    }

    return (
        <div>
            {renderContent()}
        </div>
    );
};

export default ImportTab;