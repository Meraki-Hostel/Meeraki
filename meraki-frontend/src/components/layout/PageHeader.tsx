import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/misc';

export interface Crumb { label: string; to?: string }

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-2">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-dust">
        {items.map((c, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="size-3" aria-hidden />}
            {c.to && i < items.length - 1 ? <Link to={c.to} className="hover:text-espresso hover:underline">{c.label}</Link> : <span aria-current={i === items.length - 1 ? 'page' : undefined}>{c.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageHeader({ title, subtitle, actions, breadcrumbs, docTitle, accent }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; breadcrumbs?: Crumb[]; docTitle?: string; accent?: ReactNode }) {
  useDocumentTitle(docTitle ?? (typeof title === 'string' ? title : 'Meraki'));
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
        <h1 className="flex items-center gap-2 text-[28px] font-semibold leading-tight text-espresso sm:text-[32px]">{title}{accent}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-dust">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
