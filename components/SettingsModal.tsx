import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../contexts/SettingsContext';
import { useLog } from '../contexts/LogContext';
import { useToast } from '../contexts/ToastContext';
import { LogEntry, LogLevel } from '../types';
import { X, Sun, Moon, Laptop, Download, Trash, Check, FileText, Code, ExternalLink, Shield, Upload, LogOut } from 'lucide-react';
import clsx from 'clsx';
import ImportTab from './ImportTab';
import ExportTab from './ExportTab';


const languages = [
    { code: 'en', name: 'English' },
    { code: 'pt', name: 'Português (Brasil)' },
    { code: 'es', name: 'Español' },
];

const inactivityDurations = [ // in minutes
    { value: 1, label: '1 minute' },
    { value: 5, label: '5 minutes' },
    { value: 15, label: '15 minutes' },
    { value: 30, label: '30 minutes' },
    { value: 60, label: '60 minutes' },
]

type TabName = 'general' | 'import' | 'export' | 'dev';

const TabButton: React.FC<{
    name: TabName;
    label: string;
    isActive: boolean;
    onClick: () => void;
    disabled?: boolean;
    icon: React.ReactNode;
}> = ({ name, label, isActive, onClick, disabled = false, icon }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={clsx(
            "flex items-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors px-2",
            isActive 
                ? 'text-accent-start border-accent-start' 
                : 'text-text-secondary border-transparent hover:text-text-primary',
            disabled && 'opacity-50 cursor-not-allowed'
        )}
    >
        {icon}
        {label}
    </button>
);


const LogViewer: React.FC = () => {
    const { logs, clearLogs } = useLog();
    const { showToast } = useToast();
    const { t } = useTranslation();
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    const getLogLevelClass = (level: LogLevel) => {
        switch (level) {
            case 'error': return 'text-red-400';
            case 'warn': return 'text-yellow-400';
            case 'info': return 'text-blue-400';
            case 'debug': return 'text-purple-400';
            default: return 'text-text-secondary';
        }
    }
    
    const handleDownload = () => {
        const logContent = logs.map(log => 
            `${new Date(log.timestamp).toISOString()} [${log.level.toUpperCase()}] ${log.source ? `[${log.source}]` : ''} ${log.message}`
        ).join('\n');
        
        const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `orion_vault_logs_${new Date().toISOString().split('T')[0]}.log`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
    
    const handleClear = () => {
        clearLogs();
        showToast(t('log_cleared'), 'success');
    }

    return (
        <div className="space-y-4">
            <div ref={scrollRef} className="h-64 bg-black/20 p-3 rounded-lg overflow-y-auto font-mono text-xs border border-border-color/20 dark:border-white/10">
                {logs.length > 0 ? logs.map((log, index) => (
                    <div key={index} className="flex items-start">
                        <span className="text-gray-500 mr-2 flex-shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        <p className="whitespace-pre-wrap break-words">
                            <span className={clsx("font-bold", getLogLevelClass(log.level))}>
                                [{log.level.toUpperCase()}]
                            </span>
                             {log.source && <span className="text-green-400">[{log.source}]</span>}
                            <span className="text-text-primary ml-1">{log.message}</span>
                        </p>
                    </div>
                )) : <p className="text-text-secondary">{t('no_logs')}</p>}
            </div>
            <div className="flex justify-end space-x-2">
                <button onClick={handleDownload} className="flex items-center space-x-2 text-sm py-2 px-3 bg-black/10 dark:bg-white/10 rounded-lg hover:opacity-80 transition-opacity">
                    <Download size={16}/>
                    <span>{t('download_logs')}</span>
                </button>
                <button onClick={handleClear} className="flex items-center space-x-2 text-sm py-2 px-3 bg-black/10 dark:bg-white/10 text-danger rounded-lg hover:bg-danger/20 transition-colors">
                    <Trash size={16}/>
                     <span>{t('clear_logs')}</span>
                </button>
            </div>
        </div>
    );
};

const GeneralTab: React.FC = () => {
    const { t } = useTranslation();
    const { 
        theme, setTheme, language, setLanguage,
        logoutOnInactive, setLogoutOnInactive,
        inactivityDuration, setInactivityDuration
    } = useSettings();

    const renderThemeOption = (value: 'system' | 'dark' | 'light', icon: React.ReactNode, label: string) => (
         <button
            onClick={() => setTheme(value)}
            className={clsx(
                "relative flex-1 p-2 rounded-lg border-2 transition-all duration-200",
                theme === value ? 'border-accent-start' : 'border-border-color hover:border-border-color/50 dark:border-white/10 dark:hover:border-white/20'
            )}
        >
            <div className="flex flex-col items-center justify-center h-24 bg-black/5 dark:bg-white/5 rounded-md">
                {icon}
                <span className="mt-2 text-sm font-medium text-text-primary">{label}</span>
            </div>
             {theme === value && (
                <div className="absolute top-2 right-2 h-5 w-5 bg-accent-start text-white rounded-full flex items-center justify-center">
                    <Check size={12} />
                </div>
            )}
        </button>
    );

    return (
         <div className="space-y-8">
            <div>
                <h3 className="text-lg font-semibold text-text-primary mb-4">{t('general')}</h3>
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">{t('language')}</label>
                        <select 
                            value={language} 
                            onChange={(e) => setLanguage(e.target.value)} 
                            className="block w-full max-w-xs bg-black/10 dark:bg-white/5 border border-border-color/20 dark:border-white/10 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-accent-start focus:border-transparent"
                        >
                            {languages.map(lang => <option key={lang.code} value={lang.code}>{lang.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">{t('theme')}</label>
                        <div className="flex space-x-4">
                            {renderThemeOption('system', <Laptop size={32} />, t('system'))}
                            {renderThemeOption('dark', <Moon size={32} />, t('dark'))}
                            {renderThemeOption('light', <Sun size={32} />, t('light'))}
                        </div>
                    </div>
                </div>
            </div>

            <div>
                 <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                    <Shield size={20} />
                    {t('security')}
                </h3>
                <div className="space-y-6">
                    <div>
                        <label className="flex items-center justify-between cursor-pointer">
                             <span className="text-sm font-medium text-text-primary">{t('logout_on_inactive')}</span>
                            <input
                                type="checkbox"
                                checked={logoutOnInactive}
                                onChange={(e) => setLogoutOnInactive(e.target.checked)}
                                className="form-checkbox h-5 w-5 rounded bg-black/20 border-border-color/50 dark:border-white/10 text-accent-start focus:ring-accent-start"
                            />
                        </label>
                        <p className="text-xs text-text-secondary mt-1 pr-8">
                            {t('logout_on_inactive_desc')}
                        </p>
                    </div>

                    {logoutOnInactive && (
                        <div className="animate-fade-in-fast">
                            <label htmlFor="inactivity-duration" className="block text-sm font-medium text-text-secondary mb-1">{t('inactivity_duration')}</label>
                            <select 
                                id="inactivity-duration"
                                value={inactivityDuration} 
                                onChange={(e) => setInactivityDuration(Number(e.target.value))} 
                                className="block w-full max-w-xs bg-black/10 dark:bg-white/5 border border-border-color/20 dark:border-white/10 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-accent-start focus:border-transparent"
                            >
                                {inactivityDurations.map(d => 
                                    <option key={d.value} value={d.value}>
                                        {t('minutes', { count: d.value })}
                                    </option>
                                )}
                            </select>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const DevModeTab: React.FC = () => {
    const { t } = useTranslation();

    return (
        <div className="space-y-8">
            <div>
                <h3 className="text-lg font-semibold text-text-primary mb-4">{t('app_logs')}</h3>
                <LogViewer />
            </div>
        </div>
    );
};


const SettingsModal: React.FC<{ isOpen: boolean, onClose: () => void, onImportComplete?: () => void }> = ({ isOpen, onClose, onImportComplete }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<TabName>('general');
    
    const { i18n } = useTranslation();
    inactivityDurations.forEach(d => {
        d.label = i18n.t('minutes', { count: d.value });
    });
    
    if (!isOpen) return null;

    const tabs: { name: TabName, label: string; icon: React.ReactNode; disabled: boolean }[] = [
        { name: 'general', label: t('general'), icon: <Laptop size={16} />, disabled: false },
        { name: 'import', label: t('import'), icon: <Upload size={16} />, disabled: false },
        { name: 'export', label: t('export'), icon: <Download size={16} />, disabled: false },
        { name: 'dev', label: t('dev_mode'), icon: <Code size={16} />, disabled: false },
    ];
    
    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-xl z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="w-full max-w-3xl rounded-2xl shadow-xl bg-panel/80 dark:bg-panel/60 backdrop-blur-2xl border border-border-color/10 dark:border-white/10 flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 px-6 border-b border-border-color/10 dark:border-white/5 flex justify-between items-center flex-shrink-0">
                    <h2 className="text-xl font-bold text-text-primary">{t('settings')}</h2>
                    <button onClick={onClose} className="p-2 rounded-full text-text-secondary hover:bg-black/10 dark:hover:bg-white/10 hover:text-text-primary transition-colors">
                        <X size={20} />
                    </button>
                </header>
                 <div className="border-b border-border-color/10 dark:border-white/5 px-6 flex space-x-2 sm:space-x-4 overflow-x-auto">
                    {tabs.map(tab => (
                        <TabButton 
                            key={tab.name}
                            name={tab.name}
                            label={tab.label}
                            icon={tab.icon}
                            isActive={activeTab === tab.name}
                            onClick={() => setActiveTab(tab.name)}
                            disabled={tab.disabled}
                        />
                    ))}
                </div>

                <main className="p-6 overflow-y-auto" style={{maxHeight: '70vh'}}>
                    {activeTab === 'general' && <GeneralTab />}
                    {activeTab === 'import' && <ImportTab onClose={onClose} onImportComplete={onImportComplete} />}
                    {activeTab === 'export' && <ExportTab />}
                    {activeTab === 'dev' && <DevModeTab />}
                </main>
                 <footer className="p-4 border-t border-border-color/10 dark:border-white/5 flex justify-end">
                    <button 
                        onClick={onClose} 
                        className="py-2 px-5 accent-gradient text-white rounded-lg hover:opacity-90 transition-opacity font-semibold"
                    >
                        {t('close')}
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default SettingsModal;