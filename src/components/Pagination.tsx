import { useState } from 'react'
import { useI18n } from '../lib/i18n'
import { load, save } from '../lib/storage'
import { ChevronDownIcon } from './Icons'

export const PAGE_SIZES = [5, 10, 15, 20] as const
const DEFAULT_SIZE = 20

/** Rows-per-page choice, remembered on this device per table (`key`). */
export function usePageSize(key: string) {
  const [size, setSize] = useState<number>(() => {
    const n = Number(load(`pageSize:${key}`))
    return (PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_SIZE
  })
  return [
    size,
    (n: number) => {
      setSize(n)
      save(`pageSize:${key}`, String(n))
    },
  ] as const
}

/** "1–20 of 45", rows-per-page select and page buttons. */
export function Pagination({
  page,
  size,
  total,
  onPage,
  onSize,
}: {
  page: number
  size: number
  total: number
  onPage: (p: number) => void
  onSize: (n: number) => void
}) {
  const { t } = useI18n()
  const pages = Math.max(1, Math.ceil(total / size))
  const from = total === 0 ? 0 : (page - 1) * size + 1
  const to = Math.min(page * size, total)

  // Show the first, last, and two pages either side of the current one.
  const numbers: (number | '…')[] = []
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) numbers.push(p)
    else if (numbers[numbers.length - 1] !== '…') numbers.push('…')
  }

  const btn = 'grid h-8 min-w-8 place-items-center rounded-lg px-2 text-sm font-semibold disabled:opacity-30'

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <label className="flex items-center gap-2 text-slate-500">
        {t('rowsPerPage')}
        <select
          value={size}
          onChange={e => onSize(Number(e.target.value))}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-800 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        >
          {PAGE_SIZES.map(n => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      <span className="text-slate-500">{t('showingRange').replace('{from}', String(from)).replace('{to}', String(to)).replace('{total}', String(total))}</span>

      {pages > 1 && (
        <nav className="ms-auto flex items-center gap-1" aria-label={t('pages')}>
          <button onClick={() => onPage(page - 1)} disabled={page === 1} className={`${btn} hover:bg-slate-100 dark:hover:bg-slate-800`} aria-label={t('previousPage')}>
            <ChevronDownIcon className="size-4 rotate-90 rtl:-rotate-90" />
          </button>
          {numbers.map((n, i) =>
            n === '…' ? (
              <span key={`gap${i}`} className="px-1 text-slate-400">
                …
              </span>
            ) : (
              <button
                key={n}
                onClick={() => onPage(n)}
                aria-current={n === page ? 'page' : undefined}
                className={`${btn} ${n === page ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                {n}
              </button>
            ),
          )}
          <button onClick={() => onPage(page + 1)} disabled={page === pages} className={`${btn} hover:bg-slate-100 dark:hover:bg-slate-800`} aria-label={t('nextPage')}>
            <ChevronDownIcon className="size-4 -rotate-90 rtl:rotate-90" />
          </button>
        </nav>
      )}
    </div>
  )
}
