import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Skeleton, EmptyState, ErrorState } from './States';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  align?: 'left' | 'right' | 'center';
  className?: string;
  hideBelow?: 'sm' | 'md' | 'lg';
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onRowClick?: (row: T) => void;
  rowLabel?: (row: T) => string;
  pageSize?: number;
  empty?: ReactNode;
  caption: string;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  selectable?: boolean;
  selected?: Set<string>;
  onSelectedChange?: (s: Set<string>) => void;
  isSelectable?: (row: T) => boolean;
}

const hide = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' };

export function DataTable<T>({ columns, rows, rowKey, loading, error, onRetry, onRowClick, rowLabel, pageSize = 10, empty, caption, initialSort, selectable, selected, onSelectedChange, isSelectable }: Props<T>) {
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!rows) return [];
    const col = columns.find((c) => c.key === sort?.key);
    if (!col?.sortValue || !sort) return rows;
    const get = col.sortValue;
    return [...rows].sort((a, b) => {
      const x = get(a); const y = get(b);
      const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'en', { numeric: true });
      return sort.dir === 'asc' ? r : -r;
    });
  }, [rows, sort, columns]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  useEffect(() => { if (page > pages - 1) setPage(0); }, [pages, page]);
  const visible = sorted.slice(page * pageSize, page * pageSize + pageSize);

  const toggleSort = (key: string) => setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  const selectableRows = visible.filter((r) => !isSelectable || isSelectable(r));
  const allSel = selectable && selectableRows.length > 0 && selectableRows.every((r) => selected?.has(rowKey(r)));
  const toggleAll = () => {
    const n = new Set(selected);
    selectableRows.forEach((r) => (allSel ? n.delete(rowKey(r)) : n.add(rowKey(r))));
    onSelectedChange?.(n);
  };
  const toggleOne = (k: string) => { const n = new Set(selected); if (n.has(k)) n.delete(k); else n.add(k); onSelectedChange?.(n); };

  if (error && !rows) return <ErrorState message={error} onRetry={onRetry} />;

  return (
    <div>
      <div className="scroll-thin relative overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {selectable && (
                <th scope="col" className="w-10 border-b border-line bg-sand/50 px-3 py-2.5 first:rounded-tl-xl">
                  <input type="checkbox" aria-label="Select all rows on this page" checked={!!allSel} onChange={toggleAll} className="accent-clay-600" />
                </th>
              )}
              {columns.map((c) => (
                <th key={c.key} scope="col" aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  className={cn('whitespace-nowrap border-b border-line bg-sand/50 px-3 py-2.5 text-left text-xs font-semibold text-bark first:rounded-tl-xl last:rounded-tr-xl', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center', c.hideBelow && hide[c.hideBelow])}>
                  {c.sortValue ? (
                    <button type="button" onClick={() => toggleSort(c.key)} className={cn('inline-flex items-center gap-1 hover:text-espresso', c.align === 'right' && 'flex-row-reverse')}>
                      {c.header}
                      {sort?.key === c.key ? (sort.dir === 'asc' ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />) : <ArrowUpDown className="size-3 opacity-40" aria-hidden />}
                    </button>
                  ) : c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && !rows ? Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>{(selectable ? [null, ...columns] : columns).map((_, j) => <td key={j} className="border-b border-line/70 px-3 py-3.5"><Skeleton className="h-4 w-full max-w-[140px]" /></td>)}</tr>
            )) : visible.map((r) => {
              const k = rowKey(r);
              const canSel = !isSelectable || isSelectable(r);
              return (
                <tr key={k} onClick={onRowClick ? () => onRowClick(r) : undefined}
                  onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onRowClick(r); } : undefined}
                  tabIndex={onRowClick ? 0 : undefined} aria-label={onRowClick && rowLabel ? rowLabel(r) : undefined}
                  className={cn('transition-colors', onRowClick && 'cursor-pointer hover:bg-white/80 focus-visible:bg-white', selected?.has(k) && 'bg-clay-50/60')}>
                  {selectable && (
                    <td className="border-b border-line/70 px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" aria-label={`Select ${rowLabel?.(r) ?? 'row'}`} disabled={!canSel} checked={selected?.has(k) ?? false} onChange={() => toggleOne(k)} className="accent-clay-600" />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.key} className={cn('border-b border-line/70 px-3 py-3 align-middle text-espresso', c.align === 'right' && 'text-right tabular-nums', c.align === 'center' && 'text-center', c.hideBelow && hide[c.hideBelow], c.className)}>{c.cell(r)}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows && rows.length === 0 && (empty ?? <EmptyState title="Nothing here yet" message="Try clearing filters or adding a new record." />)}
      {rows && rows.length > pageSize && (
        <nav className="flex flex-wrap items-center justify-between gap-2 px-1 pt-3 text-sm text-dust" aria-label="Pagination">
          <span className="tabular-nums">Showing {page * pageSize + 1}–{Math.min(sorted.length, (page + 1) * pageSize)} of {sorted.length}</span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="inline-flex size-8 items-center justify-center rounded-lg border border-line bg-cream disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="size-4" /></button>
            <span className="px-2 tabular-nums" aria-current="page">Page {page + 1} of {pages}</span>
            <button type="button" onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1} className="inline-flex size-8 items-center justify-center rounded-lg border border-line bg-cream disabled:opacity-40" aria-label="Next page"><ChevronRight className="size-4" /></button>
          </div>
        </nav>
      )}
    </div>
  );
}
