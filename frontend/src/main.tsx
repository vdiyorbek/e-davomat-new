import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import App from './app/App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Tanlangan til fayli yuklanguncha (odatda bir necha millisoniya) */}
    <Suspense fallback={<div className="paper min-h-svh" aria-busy="true" />}>
      <App />
    </Suspense>
  </StrictMode>,
);
