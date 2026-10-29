import type { ReactNode } from 'react'
import { useI18n } from '../lib/i18n'
import { go } from '../lib/router'
import { findRow, setMovedOut, useStore } from '../lib/store'
import { formatAddress, useColumns } from '../lib/columns'
import { Avatar } from '../components/Avatar'
import { AlertIcon, ArrowBackIcon, DoorIcon, PencilIcon } from '../components/Icons'
import { confirmDialog } from '../components/ConfirmDialog'

/**
 * A child's data, read only — what a tap on a name opens. Every column of the table is listed
 * (empty ones as —, so missing data shows), with a button to the edit form.
 */
export function ChildViewPage({ clientId }: { clientId: string }) {
  const { t, lang } = useI18n()
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
        {!child.moved_out_on && (
          <button
            onClick={async () => {
              const ok = await confirmDialog({ title: t('markMovedOut'), message: t('markMovedOutConfirm').replace('{name}', child.full_name), confirmLabel: t('markMovedOut'), danger: true })
              if (ok) setMovedOut(clientId, true)
            }}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <DoorIcon />
            {t('markMovedOut')}
          </button>
        )}
        <button
          onClick={() => go(`/child/${clientId}/edit`)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          <PencilIcon />
          {t('edit')}
        </button>
      </section>

      {/* left the class: say since when, with a way back */}
      {child.moved_out_on && (
        <div className="space-y-2 rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
          <div className="flex flex-wrap items-center gap-3">
            <DoorIcon className="size-5 text-slate-500" />
            <span className="flex-1 font-semibold">
              {t('movedOutBanner').replace('{date}', new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { dateStyle: 'long' }).format(new Date(child.moved_out_on + 'T00:00')))}
            </span>
            <button
              onClick={async () => {
                const ok = await confirmDialog({ title: t('movedBack'), message: t('movedBackConfirm').replace('{name}', child.full_name), confirmLabel: t('movedBack') })
                if (ok) setMovedOut(clientId, false)
              }}
              className="rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-500/40 dark:bg-slate-900 dark:text-indigo-300"
            >
              {t('movedBack')}
            </button>
          </div>
          {/* where they went — optional, filled in from the edit form */}
          {child.moved_to_church || child.moved_to_servant ? (
            <dl className="grid gap-2 ps-8 text-sm sm:grid-cols-2">
              {child.moved_to_church && (
                <div>
                  <dt className="text-xs font-semibold text-slate-500">{t('movedToChurch')}</dt>
                  <dd className="font-semibold">{child.moved_to_church}</dd>
                </div>
              )}
              {child.moved_to_servant && (
                <div>
                  <dt className="text-xs font-semibold text-slate-500">{t('movedToServant')}</dt>
                  <dd className="font-semibold">{child.moved_to_servant}</dd>
                </div>
              )}
            </dl>
          ) : (
            <button onClick={() => go(`/child/${clientId}/edit`)} className="ms-8 text-sm font-semibold text-indigo-700 hover:underline dark:text-indigo-300">
              + {t('addMovedOutDetails')}
            </button>
          )}
        </div>
      )}

      <dl className="grid gap-x-6 gap-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-900">
        {columns.flatMap(c => {
          const item = (key: string, label: ReactNode, value: ReactNode) => {
            const empty = value == null || value === '' || value === false
            return (
              <div key={key} className="min-w-0 border-b border-slate-100 pb-3 last:border-0 dark:border-slate-800">
                <dt className="text-xs font-semibold text-slate-500">{label}</dt>
                <dd className="mt-1 break-words font-semibold">{empty ? <span className="text-slate-300 dark:text-slate-600">—</span> : value}</dd>
              </div>
            )
          }
          // a child with two homes: the usual one (named, e.g. بيت بابا وماما) and the other right after it
          if (c.id === 'address' && child.other_address) {
            const other = child.other_address
            const named = (name: string | null | undefined, fallback: string) => (name?.trim() ? `${fallback} — ${name.trim()}` : fallback)
            return [
              item('address', named(child.address_label, c.label), c.render(child)),
              item('other_address', named(other.label, t('otherAddress')), formatAddress(other, t, lang)),
            ]
          }
          return [item(c.id, c.label, c.render(child))]
        })}
      </dl>
    </div>
  )
}
