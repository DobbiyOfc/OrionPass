
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Lock, User, MoreHorizontal, Globe, KeySquare } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { LoginItem } from '../types';

const AutofillPopup: React.FC<{
    items: LoginItem[];
    onSelect: (item: LoginItem) => void;
    onClose: () => void;
    onManage: () => void;
    onDoNotSuggest: () => void;
    siteUrl: string;
}> = ({ items, onSelect, onClose, onManage, onDoNotSuggest, siteUrl }) => {
    const { t } = useTranslation();

    const handleSelect = (item: LoginItem) => {
        onSelect(item);
        onClose();
    };

    return (
        <div className="absolute top-full mt-1 w-full bg-panel rounded-lg shadow-2xl border border-border-color z-10 animate-fade-in-fast p-1">
            {items.length > 0 ? (
                <>
                    <div className="px-2 pt-1 pb-0.5">
                        <h3 className="text-xs font-semibold text-text-secondary">{t('sign_in_as')}</h3>
                    </div>
                    <ul className="max-h-48 overflow-y-auto">
                        {items.map(item => (
                            <li key={item.UUID_Identifier}>
                                <button
                                    onClick={() => handleSelect(item)}
                                    className="w-full flex items-center p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-left"
                                >
                                    <div className="p-1.5 bg-black/10 dark:bg-white/10 rounded-full mr-2">
                                        <User size={14} className="text-text-secondary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-text-primary truncate">{item.title}</p>
                                        <p className="text-xs text-text-secondary truncate">{item.username}</p>
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                </>
            ) : (
                <div className="p-3 text-center">
                    <p className="text-sm text-text-primary font-medium">{t('no_logins_found')}</p>
                    <p className="text-xs text-text-secondary mt-1">{t('no_logins_for_site', { site: siteUrl || t('this_site') })}</p>
                </div>
            )}
             <div className="border-t border-border-color/10 dark:border-white/5 mt-1 pt-1">
                 <ul className="text-sm text-text-secondary">
                     <li>
                        <button onClick={onDoNotSuggest} className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5">
                            {t('do_not_suggest_on_this_site')}
                        </button>
                     </li>
                     <li>
                        <button onClick={onManage} className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5">
                            <MoreHorizontal size={16} />
                            {t('manage_passwords')}
                        </button>
                    </li>
                 </ul>
            </div>
        </div>
    );
};


const LoginPreview: React.FC = () => {
    const { t } = useTranslation();
    const { getDecryptedItems } = useAuth();
    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [siteUrl, setSiteUrl] = useState('github.com');
    const [activeField, setActiveField] = useState<'email' | 'password' | null>(null);
    const [isPopupOpen, setIsPopupOpen] = useState(false);
    const [loginItems, setLoginItems] = useState<LoginItem[]>([]);
    
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchLogins = async () => {
            try {
                const allItems = await getDecryptedItems();
                const logins = allItems.filter(item => item.type === 'login') as LoginItem[];
                setLoginItems(logins);
            } catch (error) {
                console.error("Failed to fetch login items for preview:", error);
            }
        };
        fetchLogins();
    }, [getDecryptedItems]);

    const filteredLoginItems = useMemo(() => {
        if (!siteUrl.trim()) return [];

        let domainToMatch: string;
        try {
            const urlObj = new URL(siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`);
            domainToMatch = urlObj.hostname.replace(/^www\./, '');
        } catch (e) {
            domainToMatch = siteUrl.replace(/^www\./, '').split('/')[0];
        }
        
        if (!domainToMatch) return [];

        return loginItems.filter(item => {
            if (!item.url) return false;
            try {
                const itemUrlObj = new URL(item.url.startsWith('http') ? item.url : `https://${item.url}`);
                const itemDomain = itemUrlObj.hostname.replace(/^www\./, '');
                // Strict match: exact domain or a subdomain
                return itemDomain === domainToMatch || itemDomain.endsWith(`.${domainToMatch}`);
            } catch {
                return item.url.includes(domainToMatch);
            }
        });
    }, [loginItems, siteUrl]);

    const handleSelect = (item: LoginItem) => {
        setEmail(item.username || '');
        setPassword(item.password || '');
        closePopup();
    };
    
    const handleDoNotSuggest = () => {
        console.log(`Simulating "Do not suggest on this site" for site: ${siteUrl}`);
        closePopup();
    };
    
    const handleManagePasswords = () => {
        console.log('Simulating "Manage Passwords" action.');
        closePopup();
    };

    const handleFocus = (field: 'email' | 'password') => {
        setActiveField(field);
        // Abre automaticamente o pop-up se houver itens correspondentes
        if (filteredLoginItems.length > 0) {
            setIsPopupOpen(true);
        }
    };
    
    const handleKeyIconClick = (event: React.MouseEvent) => {
        event.stopPropagation();
        setIsPopupOpen((prev) => !prev);
    };

    const closePopup = () => {
        setIsPopupOpen(false);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
             if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                closePopup();
                setActiveField(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <div ref={containerRef}>
            <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
                <div>
                    <label htmlFor="preview-site" className="text-sm font-medium text-text-secondary">{t('website')}</label>
                    <div className="relative mt-1">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary pointer-events-none" />
                        <input
                            id="preview-site"
                            type="text"
                            value={siteUrl}
                            onChange={(e) => setSiteUrl(e.target.value)}
                            onFocus={() => { closePopup(); setActiveField(null); }}
                            className="w-full pl-10 pr-3 py-2 bg-background border border-border-color/20 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent-start focus:border-transparent placeholder-text-secondary"
                            placeholder={t('site_url_placeholder')}
                            autoComplete="off" 
                        />
                    </div>
                </div>
                <div className="relative">
                    <label htmlFor="preview-email" className="text-sm font-medium text-text-secondary">{t('email_address')}</label>
                    <div className="relative mt-1">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary pointer-events-none" />
                        <input
                            id="preview-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onFocus={() => handleFocus('email')}
                            className="w-full pl-10 pr-10 py-2 bg-background border border-border-color/20 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent-start focus:border-transparent placeholder-text-secondary"
                            placeholder={t('email_placeholder')}
                            autoComplete="off" 
                        />
                        {activeField === 'email' && (
                             <button
                                type="button"
                                onClick={handleKeyIconClick}
                                className="absolute inset-y-0 right-0 px-3 flex items-center text-text-secondary hover:text-accent-start transition-colors"
                                aria-label="Toggle autofill suggestions"
                            >
                                <KeySquare size={18} />
                            </button>
                        )}
                    </div>
                    {isPopupOpen && activeField === 'email' && (
                        <AutofillPopup
                            items={filteredLoginItems}
                            onSelect={handleSelect}
                            onClose={closePopup}
                            siteUrl={siteUrl}
                            onDoNotSuggest={handleDoNotSuggest}
                            onManage={handleManagePasswords}
                        />
                    )}
                </div>
                <div className="relative">
                    <label htmlFor="preview-password" className="text-sm font-medium text-text-secondary">{t('password')}</label>
                    <div className="relative mt-1">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary pointer-events-none" />
                        <input
                            id="preview-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onFocus={() => handleFocus('password')}
                            className="w-full pl-10 pr-10 py-2 bg-background border border-border-color/20 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent-start focus:border-transparent placeholder-text-secondary"
                            placeholder={t('master_password_placeholder')}
                            autoComplete="off"
                        />
                         {activeField === 'password' && (
                             <button
                                type="button"
                                onClick={handleKeyIconClick}
                                className="absolute inset-y-0 right-0 px-3 flex items-center text-text-secondary hover:text-accent-start transition-colors"
                                aria-label="Toggle autofill suggestions"
                            >
                                <KeySquare size={18} />
                            </button>
                        )}
                    </div>
                    {isPopupOpen && activeField === 'password' && (
                         <AutofillPopup
                            items={filteredLoginItems}
                            onSelect={handleSelect}
                            onClose={closePopup}
                            siteUrl={siteUrl}
                            onDoNotSuggest={handleDoNotSuggest}
                            onManage={handleManagePasswords}
                        />
                    )}
                </div>
                 <button type="submit" className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white accent-gradient opacity-70 cursor-not-allowed">
                    {t('access')}
                </button>
            </form>
        </div>
    );
};

export default LoginPreview;