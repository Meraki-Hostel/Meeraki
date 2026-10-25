import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ToastProvider, useToast } from './providers/ToastProvider';
import { ConfirmProvider } from './providers/ConfirmProvider';
import { SessionProvider } from './providers/SessionProvider';
import { AppRoutes } from './router';
import { dataRecoveredFromCorruption } from '@/services';

function RecoveryNotice() {
  const toast = useToast();
  useEffect(() => {
    if (dataRecoveredFromCorruption()) toast.info('Saved demo data could not be read, so the original demo data was restored.', 'Demo data reset');
  }, [toast]);
  return null;
}

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <ConfirmProvider>
          <SessionProvider>
            <RecoveryNotice />
            <AppRoutes />
          </SessionProvider>
        </ConfirmProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
