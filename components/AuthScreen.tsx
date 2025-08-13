





import React, { useState } from 'react';
import { Lock, ShieldCheck, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { checkPasswordStrength, PasswordStrength } from '../utils/security';
import { useTranslation } from 'react-i18next';

const PasswordStrengthMeter: React.FC<{ strength: PasswordStrength }> = ({ strength }) => {
    const { t } = useTranslation();
    const { score, feedback } = strength;
    const strengthLevels = [
        { text: t('strength_very_weak'), color: 'bg-red-500' },
        { text: t('strength_weak'), color: 'bg-orange-500' },
        { text: t('strength_fair'), color: 'bg-yellow-500' },
        { text: t('strength_good'), color: 'bg-blue-500' },
        { text: t('strength_strong'), color: 'bg-green-500' },
    ];

    return (
        <div className="space-y-2 pt-2">
            <div className="w-full bg-black/20 rounded-full h-2">
                <div 
                    className={`h-2 rounded-full transition-all duration-300 ${strengthLevels[score]?.color || 'bg-gray-700'}`} 
                    style={{ width: `${(score + 1) * 20}%` }}
                ></div>
            </div>
            <p className={`text-xs text-center font-medium ${strengthLevels[score]?.color?.replace('bg-', 'text-') || 'text-text-secondary'}`}>
                {strengthLevels[score]?.text}
            </p>
            {feedback.warning && <p className="text-xs text-red-400 text-center">{feedback.warning}</p>}
            {feedback.suggestions?.map((suggestion, i) => (
                <p key={i} className="text-xs text-yellow-400 text-center">{suggestion}</p>
            ))}
        </div>
    );
};


const AuthScreen: React.FC = () => {
    const { session, isLocked, login, register, unlock } = useAuth();
    const [isLoginView, setIsLoginView] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>(checkPasswordStrength(''));
    
    const { showToast } = useToast();
    const { t } = useTranslation();

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newPassword = e.target.value;
        setPassword(newPassword);
        if (!isLoginView) {
            setPasswordStrength(checkPasswordStrength(newPassword));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLoading) return;
        setIsLoading(true);

        if (session && isLocked) {
            await unlock(password);
        } else if (isLoginView) {
            await login(email, password);
        } else {
            if (password !== confirmPassword) {
                showToast(t('passwords_do_not_match'), "error");
                setIsLoading(false);
                return;
            }
            if(passwordStrength.score < 3) {
                showToast(t('password_too_weak'), "error");
                setIsLoading(false);
                return;
            }
            const success = await register(email, password);
            if(success) {
                // Switch to login view after successful registration
                setIsLoginView(true);
                setEmail(email);
                setPassword('');
                setConfirmPassword('');
            }
        }
        setIsLoading(false);
    };

    const isUnlockMode = session && isLocked;
    const currentViewEmail = isUnlockMode ? session.email : email;

    return (
        <div className="flex items-center justify-center min-h-screen p-4">
            <div className="w-full max-w-sm p-8 space-y-6 bg-panel/80 dark:bg-panel/50 backdrop-blur-2xl rounded-2xl shadow-2xl border border-border-color/10 dark:border-white/10">
                <div className="text-center">
                    <ShieldCheck className="mx-auto h-12 w-12 accent-gradient-text" />
                    <h1 className="text-3xl font-bold text-text-primary mt-4">{t('vaultsafe')}</h1>
                    <p className="text-text-secondary mt-1">
                        {isUnlockMode ? t('unlock_your_vault') : (isLoginView ? t('access_your_vault') : t('create_secure_vault'))}
                    </p>
                </div>

                <form className="space-y-4" onSubmit={handleSubmit}>
                    <div>
                        <label className="text-sm font-medium text-text-secondary" htmlFor="email">{t('email_address')}</label>
                        <div className="relative mt-1">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
                            <input id="email" type="email" value={currentViewEmail} onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-10 pr-3 py-2 bg-black/20 border border-border-color/20 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent-start focus:border-transparent placeholder-text-secondary"
                                placeholder={t('email_placeholder')} required autoComplete="email" disabled={isUnlockMode} />
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-text-secondary" htmlFor="master-password">{t('master_password')}</label>
                        <div className="relative mt-1">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
                            <input id="master-password" type="password" value={password} onChange={handlePasswordChange}
                                className="w-full pl-10 pr-3 py-2 bg-black/20 border border-border-color/20 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent-start focus:border-transparent placeholder-text-secondary"
                                placeholder={t('master_password_placeholder')} required autoComplete={isLoginView ? "current-password" : "new-password"} autoFocus={isUnlockMode}/>
                        </div>
                    </div>
                    
                    {!isLoginView && !isUnlockMode && (
                        <>
                            <div>
                                <label className="text-sm font-medium text-text-secondary" htmlFor="confirm-password">{t('confirm_password')}</label>
                                <div className="relative mt-1">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
                                    <input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full pl-10 pr-3 py-2 bg-black/20 border border-border-color/20 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent-start focus:border-transparent placeholder-text-secondary"
                                        placeholder={t('confirm_password_placeholder')} required autoComplete="new-password" />
                                </div>
                            </div>
                            <PasswordStrengthMeter strength={passwordStrength} />
                        </>
                    )}

                    <button type="submit" disabled={isLoading}
                        className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white accent-gradient hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-start focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed">
                        {isLoading 
                            ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> 
                            : (isUnlockMode ? t('unlock') : (isLoginView ? t('access') : t('create_vault')))
                        }
                    </button>
                </form>
                
                {!isUnlockMode && (
                    <div className="text-center">
                        <button onClick={() => setIsLoginView(!isLoginView)} className="text-sm text-accent-start hover:text-accent-end transition-colors hover:underline">
                            {isLoginView ? t('no_account') : t('already_have_account')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AuthScreen;