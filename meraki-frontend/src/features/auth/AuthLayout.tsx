import type { ReactNode } from 'react';
import { Building2, ChartColumn, Users } from 'lucide-react';
import { CampusScene } from '@/components/brand/CampusScene';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { useDocumentTitle } from '@/hooks/misc';

export function AuthLayout({ children, title }: { children: ReactNode; title: string }) {
  useDocumentTitle(title);
  return (
    <div className="relative min-h-dvh overflow-hidden bg-ivory">
      <CampusScene className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0 bg-ivory/75 lg:bg-transparent lg:bg-gradient-to-r lg:from-ivory lg:via-ivory/80 lg:via-40% lg:to-transparent lg:to-65%" aria-hidden />
      <div className="relative mx-auto grid min-h-dvh max-w-[1360px] grid-cols-1 lg:grid-cols-[1fr_minmax(420px,500px)] lg:gap-10 lg:px-10">
        <section className="flex flex-col justify-between px-6 pb-6 pt-8 sm:px-10 lg:py-12 lg:pl-4">
          <BrandLogo />
          <div className="mt-10 max-w-lg lg:mt-0">
            <h1 className="font-display text-[34px] font-normal leading-[1.08] tracking-tight text-espresso sm:text-[46px] lg:text-[54px]" style={{ fontVariationSettings: '"SOFT" 60, "WONK" 0' }}>
              Simpler hostel management for brighter days
            </h1>
            <p className="mt-4 max-w-sm text-[17px] leading-relaxed text-bark">Students, rooms and daily operations — all in one calm place.</p>
            <ul className="mt-8 hidden gap-6 sm:flex">
              {[
                { icon: Building2, label: 'Manage properties' },
                { icon: Users, label: 'Keep students aligned' },
                { icon: ChartColumn, label: 'Real-time visibility' },
              ].map(({ icon: Icon, label }) => (
                <li key={label} className="flex max-w-28 flex-col gap-2 text-[13px] leading-snug text-bark">
                  <span className="grid size-11 place-items-center rounded-xl bg-cream/80 text-clay-600 shadow-sm" aria-hidden><Icon className="size-5" /></span>
                  {label}
                </li>
              ))}
            </ul>
          </div>
          <p className="hidden font-display text-lg font-light italic leading-snug text-cream lg:block" style={{ textShadow: '0 1px 12px rgb(59 38 34 / .35)' }}>
            Happier students.<br />Smoother operations.
          </p>
        </section>
        <section className="flex items-start justify-center px-4 pb-10 sm:px-6 lg:items-center lg:py-10">
          <div className="w-full max-w-[480px] rounded-[28px] border border-white/60 bg-cream/88 p-6 shadow-[var(--shadow-lift)] backdrop-blur-md sm:p-9">
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}

export function AuthHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6 text-center">
      <h2 className="font-display text-[30px] font-semibold text-espresso">{title}</h2>
      {subtitle && <p className="mt-1 text-[15px] text-dust">{subtitle}</p>}
    </div>
  );
}
