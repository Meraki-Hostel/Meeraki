import { useLocation } from 'react-router-dom';
import { Compass, ShieldX } from 'lucide-react';
import { roleHome, useSession } from '@/app/providers/SessionProvider';
import { ButtonLink } from '@/components/ui/Button';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { useDocumentTitle } from '@/hooks/misc';

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-ivory px-6 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mb-10 flex justify-center"><BrandLogo /></div>
        {children}
      </div>
    </div>
  );
}

export function UnauthorizedPage() {
  useDocumentTitle('Access restricted');
  const { user } = useSession();
  const attempted = (useLocation().state as { attempted?: string } | null)?.attempted;
  return (
    <Frame>
      <span className="mx-auto mb-5 grid size-16 place-items-center rounded-full bg-brick-wash text-brick" aria-hidden><ShieldX className="size-7" /></span>
      <h1 className="font-display text-3xl font-semibold">This area isn’t part of your role</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-dust">
        {user ? <>You’re signed in as <strong className="text-espresso">{user.name}</strong> ({user.role}). {attempted && <>The page <code className="rounded bg-sand px-1">{attempted}</code> belongs to another role.</>} Switch persona from the account menu to explore it.</>
          : 'Sign in with an account that has access to this page.'}
      </p>
      <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
        {user ? <ButtonLink to={roleHome(user.role)}>Go to my home</ButtonLink> : <ButtonLink to="/login">Sign in</ButtonLink>}
        <ButtonLink to="/help" variant="secondary">Get help</ButtonLink>
      </div>
    </Frame>
  );
}

export function NotFoundPage() {
  useDocumentTitle('Page not found');
  const { user } = useSession();
  const path = useLocation().pathname;
  return (
    <Frame>
      <p className="font-display text-[84px] font-light leading-none text-clay-400" aria-hidden>404</p>
      <span className="sr-only">Error 404</span>
      <h1 className="mt-2 font-display text-3xl font-semibold">We couldn’t find that page</h1>
      <p className="mt-3 text-[15px] text-dust">Nothing lives at <code className="break-all rounded bg-sand px-1">{path}</code>. It may have moved, or the link has a typo.</p>
      <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
        <ButtonLink to={user ? roleHome(user.role) : '/login'} icon={<Compass className="size-4" aria-hidden />}>{user ? 'Back to my home' : 'Go to sign in'}</ButtonLink>
        <ButtonLink to="/help" variant="secondary">Help centre</ButtonLink>
      </div>
    </Frame>
  );
}
