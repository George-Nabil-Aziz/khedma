import type { ReactNode } from 'react'
import type { CoreField, CustomField, Phone } from '../lib/supabase'
import { useI18n, type TKey } from '../lib/i18n'
import { go } from '../lib/router'
import { discardOp, flatGet, resolveConflict, retryOp, sync, useStore, X, type Conflict, type Op } from '../lib/store'
import { OWNER_LABEL } from '../lib/phones'
import { AlertIcon, SyncIcon } from '../components/Icons'

const FIELD_LABEL: Record<CoreField, TKey> = {
  full_name: 'name',
  house_number: 'houseNumber',
  street: 'street',
  branch_of_street: 'branchOfStreet',
  landmark: 'landmark',
  floor: 'floorLabel',
  side: 'side',
  apartment: 'apartmentLabel',
  birth_date: 'birthDate',
  deacon: 'deacon',
  category: 'category',
  notes: 'notes',
  national_id: 'nationalId',
  phones: 'phones',
  primary_contacts: 'primaryContact',
  photo: 'photo',
}

/** Label and display text for a field key of the sync "flat" view (built-in or "x:<custom>"). */
function useFieldText() {
  const { t, lang } = useI18n()
  const { fields } = useStore()

  const custom = (key: string): CustomField | undefined => fields.find(f => X + f.key === key)

  const label = (key: string) =>
    key.startsWith(X) ? (custom(key)?.label ?? key.slice(X.length)) : FIELD_LABEL[key as CoreField] ? t(FIELD_LABEL[key as CoreField]) : key

  const value = (key: string, v: unknown): string => {
    if (v == null || v === '') return '—'
    if (key === 'photo') return '🖼️'
    if (key === 'phones') {
      const list = v as Phone[]
      return list.length ? list.map(p => `${t(OWNER_LABEL[p.owner])}: ${p.number}${p.whatsapp ? ' (WhatsApp)' : ''}`).join(lang === 'ar' ? '، ' : ', ') : '—'
    }
    if (key === 'primary_contacts') return (v as Phone['owner'][]).map(o => t(OWNER_LABEL[o])).join(lang === 'ar' ? '، ' : ', ') || '—'
    if (typeof v === 'boolean') return v ? t('yes') : t('no')
    return String(v)
  }

  return { label, value }
}

export function SyncPage() {
  const { t, lang } = useI18n()
  const { online, syncing, lastSyncAt, outbox, conflicts, syncError, attOutbox, attError } = useStore()

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* status card */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <span className="relative flex size-3">
          <span className={`absolute inline-flex size-full animate-ping rounded-full opacity-75 ${online ? 'bg-emerald-500' : 'bg-red-500'}`} />
          <span className={`relative inline-flex size-3 rounded-full ${online ? 'bg-emerald-500' : 'bg-red-500'}`} />
        </span>
        <div className="flex-1">
          <div className="font-bold">{syncing ? t('syncing') : online ? t('online') : t('offline')}</div>
          <div className="text-sm text-slate-500">
            {t('lastSync')}: {lastSyncAt ? new Date(lastSyncAt).toLocaleString(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB') : t('never')}
          </div>
        </div>
        <button
          onClick={sync}
          disabled={!online || syncing}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <SyncIcon className={`size-4 ${syncing ? 'animate-spin' : ''}`} />
          {t('syncNow')}
        </button>
        {syncError && (
          <p className="w-full rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {t('syncFailed')}: {syncError}
          </p>
        )}
      </div>

      {/* conflicts */}
      <Section title={t('conflicts')} count={conflicts.length} tone="red">
        {conflicts.length === 0 ? <Empty>{t('noConflicts')}</Empty> : conflicts.map(c => <ConflictCard key={c.client_id} c={c} />)}
      </Section>

      {/* pending */}
      <Section title={t('pendingChanges')} count={outbox.length + attOutbox.length} tone="amber">
        {outbox.length === 0 && attOutbox.length === 0 ? (
          <Empty>{t('noPending')}</Empty>
        ) : (
          outbox.map(op => <OpRow key={op.client_id + op.queued_at} op={op} />)
        )}
        {attOutbox.length > 0 && (
          <div className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
            <span className="font-semibold">{attOutbox.length}</span> {t('attPending')}
          </div>
        )}
        {attError && (
          <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            <AlertIcon className="mt-0.5 size-4 shrink-0" />
            <span dir="auto">{attError}</span>
          </p>
        )}
      </Section>
    </div>
  )
}

function ConflictCard({ c }: { c: Conflict }) {
  const { t } = useI18n()
  const { label, value } = useFieldText()
  const name = (c.changes.full_name as string | undefined) ?? c.base.full_name

  return (
    <div className="space-y-3 rounded-lg border border-red-200 p-3 dark:border-red-500/30">
      <div className="font-bold">{name}</div>
      <p className="text-sm text-slate-500">{c.server ? t('conflictHelp') : t('deletedOnServer')}</p>
      {c.server && (
        <div className="overflow-x-auto">
          <table className="table-grid w-full text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1 text-start font-semibold">{t('field')}</th>
                <th className="py-1 text-start font-semibold">{t('mine')}</th>
                <th className="py-1 text-start font-semibold">{t('theirs')}</th>
              </tr>
            </thead>
            <tbody>
              {c.fields.map(f => (
                <tr key={f} className="border-t border-slate-100 align-top dark:border-slate-800">
                  <td className="py-1.5 pe-3 font-semibold">{label(f)}</td>
                  <td className="py-1.5 pe-3 text-indigo-700 dark:text-indigo-300">{value(f, c.changes[f])}</td>
                  <td className="py-1.5 text-slate-700 dark:text-slate-300">{c.server ? value(f, flatGet(c.server, f)) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {c.server && (
          <button onClick={() => resolveConflict(c.client_id, 'mine')} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white">
            {t('keepMine')}
          </button>
        )}
        <button onClick={() => resolveConflict(c.client_id, 'server')} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold dark:border-slate-700">
          {c.server ? t('keepTheirs') : t('discard')}
        </button>
      </div>
    </div>
  )
}

function OpRow({ op }: { op: Op }) {
  const { t, lang } = useI18n()
  const { label } = useFieldText()
  const name = op.kind === 'insert' ? op.data.full_name : ((op.changes.full_name as string | undefined) ?? op.base.full_name)

  return (
    <div className={`space-y-2 rounded-lg border p-3 ${op.error ? 'border-red-200 dark:border-red-500/30' : 'border-slate-200 dark:border-slate-800'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold dark:bg-slate-800">{op.kind === 'insert' ? t('newChild') : t('changed')}</span>
        <span className="flex-1 font-semibold">{name}</span>
        <button onClick={() => go(`/child/${op.client_id}/edit`)} className="text-sm font-semibold text-indigo-700 hover:underline dark:text-indigo-300">
          {t('edit')}
        </button>
      </div>
      {op.kind === 'update' && <div className="text-xs text-slate-500">{Object.keys(op.changes).map(label).join(lang === 'ar' ? '، ' : ', ')}</div>}
      {op.error && (
        <div className="space-y-2">
          <p className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
            <AlertIcon className="mt-0.5 size-4 shrink-0" />
            <span dir="auto">{op.error}</span>
          </p>
          <div className="flex gap-2">
            <button onClick={() => retryOp(op.client_id)} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white">
              {t('retry')}
            </button>
            <button onClick={() => discardOp(op.client_id)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold dark:border-slate-700">
              {t('discard')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ title, count, tone, children }: { title: string; count: number; tone: 'red' | 'amber'; children: ReactNode }) {
  const badge = tone === 'red' ? 'bg-red-500' : 'bg-amber-500'
  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="flex items-center gap-2 font-bold">
        {title}
        {count > 0 && <span className={`rounded-full px-2 text-xs font-bold text-white ${badge}`}>{count}</span>}
      </h2>
      {children}
    </section>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-slate-500">{children}</p>
}
