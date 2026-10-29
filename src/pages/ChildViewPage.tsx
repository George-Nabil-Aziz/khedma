import { useI18n } from '../lib/i18n'
import { go } from '../lib/router'
import { findRow, useStore } from '../lib/store'
import { useColumns } from '../lib/columns'
import { Avatar } from '../components/Avatar'
import { AlertIcon, ArrowBackIcon, PencilIcon } from '../components/Icons'

/**
 * A child's data, read only — what a tap on a name opens. Every column of the table is listed
 * (empty ones as —, so missing data shows), with a button to the edit form.
 */
export function ChildViewPage({ clientId }: { clientId: string }) {
  const { t } = useI18n()
  const store = useStore()
  const columns = useColumns()
  const child = findRow(store, clientId)

  if (!child)
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
        {store.loaded ? t('notFound') : t('loading')}
      </div>
    )

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-16">
      <button onClick={() => go('/')} className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        <ArrowBackIcon className="size-4" />
        {t('children')}
      </button>

      <section className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <Avatar photo={child.photo} name={child.full_name} className="size-20 text-2xl" />
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold">{child.full_name}</h2>
          {/* not on the server yet, or waiting on a decision */}
          {child.status !== 'synced' && (
            <p className={`mt-1 flex items-center gap-1.5 text-sm font-semibold ${child.status === 'pending' ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
              <AlertIcon className="size-4" />
              {t(child.status === 'pending' ? 'statusPending' : child.status === 'conflict' ? 'statusConflict' : 'statusError')}
            </p>
          )}
        </div>
        <button
          onClick={() => go(`/child/${clientId}/edit`)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          <PencilIcon />
          {t('edit')}
        </button>
      </section>

      <dl className="grid gap-x-6 gap-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-900">
        {columns.map(c => {
          const value = c.render(child)
          const empty = value == null || value === '' || value === false
          return (
            <div key={c.id} className="min-w-0 border-b border-slate-100 pb-3 last:border-0 dark:border-slate-800">
              <dt className="text-xs font-semibold text-slate-500">{c.label}</dt>
              <dd className="mt-1 break-words font-semibold">{empty ? <span className="text-slate-300 dark:text-slate-600">—</span> : value}</dd>
            </div>
          )
        })}
      </dl>
    </div>
  )
}
