import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../lib/i18n'
import { go } from '../lib/router'
import { sync, useStore, viewRows, type RowStatus } from '../lib/store'
import { ColumnsMenu } from '../components/ColumnsMenu'
import { Pagination, usePageSize } from '../components/Pagination'
import { sortRows, useColumnPrefs, useColumns, useSort, type Column } from '../lib/columns'
import { Avatar } from '../components/Avatar'
import { NoChildren } from '../components/NoChildren'
import { AlertIcon, ChevronDownIcon, ChevronUpIcon, CloudOffIcon, ColumnsIcon, PlusIcon, SortIcon, StarIcon } from '../components/Icons'

export function ChildrenPage() {
  const { t, lang } = useI18n()
  const store = useStore()
  const rows = useMemo(() => viewRows(store), [store])
  const currentClass = store.classes.find(c => c.id === store.currentClass)
  const columns = useColumns()
  const prefs = useColumnPrefs(columns)
  const { sort, toggle } = useSort()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = usePageSize('children')

  // A new sort starts from the first page.
  function sortBy(id: string) {
    toggle(id)
    setPage(1)
  }
  const [menuOpen, setMenuOpen] = useState(false)

  // Opening the page fetches the newest data straight away.
  useEffect(() => {
    sync()
  }, [])

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

  // Back to a page that exists when the search or page size shrinks the list.
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const current = Math.min(page, pages)
  const pageRows = filtered.slice((current - 1) * pageSize, current * pageSize)

  // Empty while a sync is fetching: say "loading", not "no children".
  const showLoading = !store.loaded || (store.syncing && rows.length === 0)
  const colSpan = prefs.visible.length + 2

  const top = (
    <>
      {!store.online && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <CloudOffIcon className="mt-0.5 size-4 shrink-0" />
          {t('offlineNote')}
        </div>
      )}

      {/* the class on screen, in full — the sidebar picker cuts long names short */}
      {currentClass && (
        <h2 className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-xl font-bold">{currentClass.name}</span>
          <span className="flex items-center gap-1.5 text-sm text-slate-500">
            {currentClass.is_default && <StarIcon className="size-4 text-amber-500" />}
            <span dir="ltr">{currentClass.service_year}</span>
          </span>
        </h2>
      )}
    </>
  )

  // A class with no children yet: say so, instead of an empty table.
  if (!showLoading && rows.length === 0)
    return (
      <div className="space-y-4">
        {top}
        <NoChildren />
      </div>
    )

  return (
    <div className="space-y-4">
      {top}

      <div className="flex flex-wrap items-center gap-3">
        <input
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 sm:max-w-xs dark:border-slate-700 dark:bg-slate-900"
          placeholder={t('search')}
          value={query}
          onChange={e => {
            setQuery(e.target.value)
            setPage(1)
          }}
        />
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
          {t('total')}: {filtered.length}
        </span>
        <div className="ms-auto flex items-center gap-2">
          <button
            onClick={() => go('/new')}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            <PlusIcon className="size-4" />
            {t('addChild')}
          </button>
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
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="table-grid w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            <tr>
              <th className="px-3 py-3 text-start font-semibold">#</th>
              <SortHeader id="name" label={t('name')} sort={sort} onSort={sortBy} />
              {prefs.visible.map(c => (
                <SortHeader key={c.id} id={c.id} label={c.label} sort={sort} onSort={sortBy} />
              ))}
            </tr>
          </thead>
          <tbody>
            {showLoading ? (
              <tr>
                <td colSpan={colSpan} className="px-3 py-10 text-center text-slate-500">
                  {t('loading')}
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-3 py-10 text-center text-slate-500">
                  {t('noResults')}
                </td>
              </tr>
            ) : (
              pageRows.map((r, i) => (
                <tr key={r.client_id} className="align-top hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-3 py-2 text-slate-400">{(current - 1) * pageSize + i + 1}</td>
                  <td className="min-w-40 px-3 py-2">
                    <button
                      onClick={() => go(`/child/${r.client_id}`)}
                      className="flex items-center gap-2 text-start font-semibold text-indigo-700 hover:underline dark:text-indigo-300"
                    >
                      {r.photo && <Avatar photo={r.photo} name={r.full_name} />}
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

      {filtered.length > 0 && (
        <Pagination
          page={current}
          size={pageSize}
          total={filtered.length}
          onPage={setPage}
          onSize={n => {
            setPageSize(n)
            setPage(1)
          }}
        />
      )}
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
