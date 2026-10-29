import { useState, type ReactNode } from 'react'
import { useI18n, type TKey } from '../lib/i18n'
import { go, useRoute, type Path, type Route } from '../lib/router'
import { saveYearEndWeeks, useStore } from '../lib/store'
import { MAX_EXTRA_WEEKS, currentServiceYear, iso, yearEnd } from '../lib/serviceYear'
import { CalendarCheckIcon, CloudOffIcon, PlusIcon } from '../components/Icons'

/**
 * الإعدادات: three tabs, each its own page (#/fields, #/sync, #/settings) under this one bar —
 * columns and sync for everyone, the end of the service year for admins only.
 */
export function SettingsTabs({ admin }: { admin: boolean }) {
  const { t } = useI18n()
  const route = useRoute()
  const { outbox, conflicts, attOutbox, dayOutbox, attError } = useStore()
  const issues = conflicts.length + outbox.filter(o => o.error).length + (attError ? 1 : 0)
  const pending = outbox.length + attOutbox.length + dayOutbox.length

  const tab = (name: Route['name'], path: Path, label: TKey, badge?: ReactNode) => (
    <button
      onClick={() => go(path)}
      aria-current={route.name === name ? 'page' : undefined}
      className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold ${
        route.name === name ? 'border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
      }`}
    >
      {t(label)}
      {badge}
    </button>
  )

  return (
    <nav className="mx-auto mb-5 flex max-w-4xl overflow-x-auto border-b border-slate-200 dark:border-slate-800">
      {tab('fields', '/fields', 'customize')}
      {tab(
        'sync',
        '/sync',
        'sync',
        issues > 0 ? (
          <span className="rounded-full bg-red-500 px-2 text-xs font-bold text-white">{issues}</span>
        ) : pending > 0 ? (
          <span className="rounded-full bg-amber-500 px-2 text-xs font-bold text-white">{pending}</span>
        ) : null,
      )}
      {admin && tab('settings', '/settings', 'yearEndTitle')}
    </nav>
  )
}

/** Admins only: the end of the service year. */
export function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <YearEndSetting />
    </div>
  )
}

/** How many Fridays the service year runs past (or stops before) the first Friday after 6 October. */
function YearEndSetting() {
  const { t, lang } = useI18n()
  const { online, yearEndWeeks } = useStore()
  const [weeks, setWeeks] = useState(yearEndWeeks)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  // the year this change matters for: the one running now
  const year = currentServiceYear()
  const end = yearEnd(Number(year.slice(5)), weeks)
  const date = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(end)

  const label = weeks === 0 ? t('yearEndNormal') : (weeks > 0 ? t('yearEndAdd') : t('yearEndRemove')).replace('{n}', String(Math.abs(weeks)))

  function change(n: number) {
    setWeeks(n)
    setSaved(false)
    setError('')
  }

  async function save() {
    setBusy(true)
    setError('')
    const err = await saveYearEndWeeks(weeks)
    setBusy(false)
    if (err) setError(err)
    else setSaved(true)
  }

  const stepBtn =
    'grid size-10 place-items-center rounded-lg border border-slate-300 text-lg font-bold hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800'

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h2 className="flex items-center gap-2 font-bold">
          <CalendarCheckIcon className="size-5 text-indigo-600 dark:text-indigo-300" />
          {t('yearEndTitle')}
        </h2>
        <p className="mt-1 text-sm text-slate-500">{t('yearEndHelp')}</p>
      </div>

      {!online && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <CloudOffIcon className="size-4 shrink-0" />
          {t('needsOnline')}
        </div>
      )}

      {/* − / + : one Friday at a time, up to 3 either way */}
      <div className="flex items-center justify-center gap-3">
        <button onClick={() => change(weeks - 1)} disabled={busy || weeks <= -MAX_EXTRA_WEEKS} title={t('removeFriday')} aria-label={t('removeFriday')} className={stepBtn}>
          −
        </button>
        <div className="min-w-40 text-center">
          <div className={`text-2xl font-bold ${weeks > 0 ? 'text-emerald-600 dark:text-emerald-400' : weeks < 0 ? 'text-red-600 dark:text-red-400' : ''}`} dir="ltr">
            {weeks > 0 ? `+${weeks}` : weeks}
          </div>
          <div className="text-sm text-slate-500">{label}</div>
        </div>
        <button onClick={() => change(weeks + 1)} disabled={busy || weeks >= MAX_EXTRA_WEEKS} title={t('addFriday')} aria-label={t('addFriday')} className={stepBtn}>
          <PlusIcon className="size-5" />
        </button>
      </div>

      <p className="rounded-lg bg-slate-50 px-3 py-2 text-center text-sm dark:bg-slate-800/60">
        {t('yearEndResult')
          .replace('{year}', year)
          .replace('{date}', date)}{' '}
        <span className="text-slate-400" dir="ltr">
          ({iso(end)})
        </span>
      </p>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}

      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{t('saved')}</span>}
        <button
          onClick={save}
          disabled={!online || busy || weeks === yearEndWeeks}
          className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {t('save')}
        </button>
      </div>
    </section>
  )
}
