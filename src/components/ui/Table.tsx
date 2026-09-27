import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes, HTMLAttributes } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from './Button'

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('scrollbar-thin overflow-x-auto', className)}>
      <table className="w-full min-w-full border-separate border-spacing-0 text-sm">{children}</table>
    </div>
  )
}

export function Th({ children, className, sort, onSort, ...rest }: ThHTMLAttributes<HTMLTableCellElement> & { sort?: 'asc' | 'desc' | null; onSort?: () => void }) {
  return (
    <th className={cn('sticky top-0 border-b border-slate-200 bg-slate-50/80 px-4 py-2.5 text-left text-xs font-medium whitespace-nowrap text-slate-500 first:pl-5 last:pr-5', className)} {...rest}>
      {onSort ? (
        <button onClick={onSort} className="inline-flex items-center gap-1 hover:text-slate-800">
          {children}
          {sort === 'asc' ? <ArrowUp size={12} /> : sort === 'desc' ? <ArrowDown size={12} /> : <ChevronsUpDown size={12} className="opacity-50" />}
        </button>
      ) : (
        children
      )}
    </th>
  )
}

export function Tr({ children, className, onClick, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr onClick={onClick} className={cn('group transition-colors', onClick && 'cursor-pointer hover:bg-slate-50/80', className)} {...rest}>
      {children}
    </tr>
  )
}

export function Td({ children, className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('border-b border-slate-100 px-4 py-3 align-middle text-slate-700 first:pl-5 last:pr-5 group-last:border-b-0', className)} {...rest}>
      {children}
    </td>
  )
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-[13px] text-slate-500">
      <span className="tabular">
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" icon={ChevronLeft} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page" />
        <span className="px-2 tabular">
          {page} / {pages}
        </span>
        <Button size="sm" variant="ghost" icon={ChevronRight} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page" />
      </div>
    </div>
  )
}
