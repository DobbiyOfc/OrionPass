import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

const loadingMarkup = (
  <div className="flex items-center justify-center min-h-screen bg-transparent">
      <div className="w-16 h-16 border-4 border-accent-start border-t-transparent rounded-full animate-spin"></div>
  </div>
)

root.render(
  <Suspense fallback={loadingMarkup}>
    <React.StrictMode>
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>
    </React.StrictMode>
  </Suspense>
);