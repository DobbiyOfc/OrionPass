



import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { LogProvider, useLog } from './contexts/LogContext';
import AuthScreen from './components/AuthScreen';
import Dashboard from './components/Dashboard';

const ThemedBackground = () => {
    return <div className="aurora-bg" />;
}

const AppContent: React.FC = () => {
    const { session, isInitialized, isLocked } = useAuth();
    
    if (!isInitialized) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-transparent">
                <div className="w-16 h-16 border-4 border-accent-start border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }
    
    return (
        <div className="h-screen w-screen bg-transparent">
            <ThemedBackground />
            {session && !isLocked ? <Dashboard /> : <AuthScreen />}
        </div>
    );
};


const App: React.FC = () => {
    return (
        <SettingsProvider>
            <LogProvider>
                <ToastProvider>
                    <AuthProvider>
                        <AppContent />
                    </AuthProvider>
                </ToastProvider>
            </LogProvider>
        </SettingsProvider>
    );
};

export default App;
