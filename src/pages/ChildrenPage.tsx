import { useMemo, useState } from 'react'
import { useI18n } from '../lib/i18n'
import { go } from '../lib/router'
import { sync, useStore, viewRows, type RowStatus } from '../lib/store'
import { sortRows, useColumnPrefs, useColumns, useSort, type Column } from '../lib/columns'
import {
  AlertIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CloudOffIcon,
  ColumnsIcon,
  LockIcon,
  SortIcon,
  SyncIcon,
  XIcon,
} from '../components/Icons'

export function ChildrenPage() {
  const { t, lang } = useI18n()
  const store = useStore()
  const rows = useMemo(() => viewRows(store), [store])
  const columns = useColumns()
  const prefs = useColumnPrefs(columns)
  const { sort, toggle } = useSort()
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = !q
      ? rows
      : rows.filter(r =>
          [
            r.full_name,
            r.street,
            r.national_id,
            r.notes,
            ...r.phones.map(p => p.number),
            ...Object.values(r.extra ?? {}).map(v => (v == null ? null : String(v))),
          ].some(v => v?.toLowerCase().includes(q)),
        )
    return sortRows(list, columns, sort, lang)
  }, [rows, query, columns, sort, lang])

  const showLoading = !store.loaded || (store.syncing && !store.lastSyncAt && rows.length === 0)
  const colSpan = prefs.visible.length + 2

  return (
    <div className="space-y-4">
      {!store.online && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <CloudOffIcon className="mt-0.5 size-4 shrink-0" />
          {t('offlineNote')}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 sm:max-w-xs dark:border-slate-700 dark:bg-slate-900"
          placeholder={t('search')}
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
          {t('total')}: {filtered.length}
        </span>
        <div className="ms-auto flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <ColumnsIcon />
              {t('columns')}
            </button>
            {menuOpen && <ColumnsMenu prefs={prefs} onClose={() => setMenuOpen(false)} />}
          </div>
          <button
            onClick={sync}
            disabled={!store.online}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <SyncIcon className={`size-4 ${store.syncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t('syncNow')}</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            <tr>
              <th className="px-3 py-3 text-start font-semibold">#</th>
              <SortHeader id="name" label={t('name')} sort={sort} onSort={toggle} />
              {prefs.visible.map(c => (
                <SortHeader key={c.id} id={c.id} label={c.label} sort={sort} onSort={toggle} />
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {showLoading ? (
              <tr>
                <td colSpan={colSpan} className="px-3 py-10 text-center text-slate-500">
                  {t('loading')}
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-3 py-10 text-center text-slate-500">
                  {rows.length ? t('noResults') : t('empty')}
                </td>
              </tr>
            ) : (
              filtered.map((r, i) => (
                <tr key={r.client_id} className="align-top hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                  <td className="min-w-40 px-3 py-2">
                    <button
                      onClick={() => go(`/child/${r.client_id}`)}
                      className="flex items-center gap-2 text-start font-semibold text-indigo-700 hover:underline dark:text-indigo-300"
                    >
                      {r.full_name}
                      <StatusBadge status={r.status} />
                    </button>
                  </td>
                  {prefs.visible.map(c => (
                    <Cell key={c.id} column={c} row={r} />
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Cell({ column, row }: { column: Column; row: Parameters<Column['render']>[0] }) {
  const content = column.render(row)
  const empty = content == null || content === '' || content === false
  return (
    <td className={`px-3 py-2 ${column.nowrap ? 'whitespace-nowrap' : 'min-w-32'}`}>
      {empty ? <span className="text-slate-300 dark:text-slate-600">—</span> : content}
    </td>
  )
}

function SortHeader({ id, label, sort, onSort }: { id: string; label: string; sort: { id: string; dir: 'asc' | 'desc' }; onSort: (id: string) => void }) {
  const active = sort.id === id
  return (
    <th className="whitespace-nowrap px-3 py-3 text-start font-semibold" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
      <button onClick={() => onSort(id)} className={`flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-300 ${active ? 'text-indigo-700 dark:text-indigo-300' : ''}`}>
        {label}
        {active ? sort.dir === 'asc' ? <ChevronUpIcon className="size-3.5" /> : <ChevronDownIcon className="size-3.5" /> : <SortIcon className="size-3.5 opacity-30" />}
      </button>
    </th>
  )
}

function ColumnsMenu({ prefs, onClose }: { prefs: ReturnType<typeof useColumnPrefs>; onClose: () => void }) {
  const { t } = useI18n()
  const iconBtn = 'grid size-7 place-items-center rounded hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800'

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute inset-e-0 top-full z-40 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-bold">{t('showHideColumns')}</span>
          <button onClick={onClose} className={iconBtn} aria-label={t('close')}>
            <XIcon />
          </button>
        </div>

        <div className="max-h-[60vh] space-y-0.5 overflow-y-auto">
          <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-400">
            <LockIcon className="size-4" />
            <span className="flex-1 font-semibold text-slate-700 dark:text-slate-200">{t('name')}</span>
            <span className="text-xs">{t('alwaysShown')}</span>
          </div>
          {prefs.ordered.map(({ column, visible }, i) => (
            <div key={column.id} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800/60">
              <label className="flex flex-1 items-center gap-2 text-sm">
                <input type="checkbox" checked={visible} onChange={() => prefs.toggle(column.id)} className="size-4 accent-indigo-600" />
                <span className={visible ? '' : 'text-slate-400'}>{column.label}</span>
              </label>
              <button className={iconBtn} disabled={i === 0} onClick={() => prefs.move(column.id, -1)} aria-label={t('moveUp')} title={t('moveUp')}>
                <ChevronUpIcon />
              </button>
              <button
                className={iconBtn}
                disabled={i === prefs.ordered.length - 1}
                onClick={() => prefs.move(column.id, 1)}
                aria-label={t('moveDown')}
                title={t('moveDown')}
              >
                <ChevronDownIcon />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={prefs.reset}
          disabled={prefs.isDefault}
          className="mt-3 w-full rounded-lg border border-slate-200 py-2 text-sm font-semibold hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          {t('resetDefault')}
        </button>
      </div>
    </>
  )
}

function StatusBadge({ status }: { status: RowStatus }) {
  const { t } = useI18n()
  if (status === 'synced') return null
  if (status === 'pending') return <span title={t('statusPending')} className="size-2 shrink-0 rounded-full bg-amber-500" />
  return (
    <span title={status === 'conflict' ? t('statusConflict') : t('statusError')} className="text-red-500">
      <AlertIcon />
    </span>
  )
}
