import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from './providers/ToastProvider';
import { ConfirmProvider } from './providers/ConfirmProvider';
import { SessionProvider } from './providers/SessionProvider';
import { AppRoutes } from './router';
import { configError } from '@/services';
import { BrandLogo } from '@/components/brand/BrandLogo';

/** Shown instead of the app when it was built without an API to talk to. Never falls back to demo data. */
function ConfigMissing({ reason }: { reason: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-ivory px-6">
      <main role="alert" className="max-w-md text-center">
        <div className="mb-6 flex justify-center"><BrandLogo /></div>
        <h1 className="font-display text-2xl font-semibold text-espresso">This app isn't configured</h1>
        <p className="mt-3 text-sm text-bark">{reason}</p>
        <p className="mt-2 text-sm text-dust">Set it to the StayPookie API (for example <code>https://api.example.com/api/v1</code>) and rebuild. The demo prototype is a separate app.</p>
      </main>
    </div>
  );
}

export function App() {
  if (configError) return <ConfigMissing reason={configError} />;
  return (
    <BrowserRouter>
      <ToastProvider>
        <ConfirmProvider>
          <SessionProvider>
            <AppRoutes />
          </SessionProvider>
        </ConfirmProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
