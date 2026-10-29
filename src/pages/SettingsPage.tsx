import { useState, type ReactNode } from 'react'
import { useI18n, type TKey } from '../lib/i18n'
import { go, useRoute, type Path, type Route } from '../lib/router'
import { useInstall } from '../lib/install'
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
      // a phone: boxes, the open one filled; wider screens: tabs underlined
      className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold sm:justify-start sm:whitespace-nowrap sm:rounded-none sm:border-0 sm:border-b-2 sm:px-4 sm:py-2.5 ${
        route.name === name
          ? 'border-indigo-600 bg-indigo-600 text-white sm:bg-transparent sm:text-indigo-700 dark:sm:border-indigo-400 dark:sm:text-indigo-300'
          : 'border-slate-200 bg-white text-slate-600 hover:text-slate-800 sm:border-transparent sm:bg-transparent sm:text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-slate-200 dark:sm:bg-transparent'
      }`}
    >
      {t(label)}
      {badge}
    </button>
  )

  return (
    <nav className="mx-auto mb-5 grid max-w-4xl grid-cols-2 gap-2 sm:flex sm:gap-0 sm:overflow-x-auto sm:border-b sm:border-slate-200 dark:sm:border-slate-800">
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
      {tab('help', '/help', 'howToUse')}
      {tab('install', '/install', 'installApp')}
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
        {/* the year and the numeric date kept left-to-right and whole, inside the Arabic sentence */}
        {t('yearEndResult')
          .split(/(\{year\}|\{date\})/)
          .map((part, i) =>
            part === '{year}' ? (
              <span key={i} dir="ltr" className="whitespace-nowrap font-semibold">
                {year}
              </span>
            ) : part === '{date}' ? (
              <span key={i} className="font-semibold">
                {date}
              </span>
            ) : (
              part
            ),
          )}{' '}
        <span className="whitespace-nowrap text-slate-400" dir="ltr">
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

/** Install the app on this phone / computer: the browser's own box, or the steps on an iPhone. */
export function InstallPage() {
  const { t } = useI18n()
  const { installed, canPrompt, isIOS, install } = useInstall()

  const steps = (keys: TKey[]) => (
    <ol className="list-inside list-decimal space-y-1.5 text-sm">
      {keys.map(k => (
        <li key={k}>{t(k)}</li>
      ))}
    </ol>
  )

  return (
    <div className="mx-auto max-w-2xl">
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        {/* a phone: the logo above the words, centred, so the words get the full width */}
        <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-start">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="size-14 sm:size-12" />
          <div>
            <h2 className="font-bold">{t('installApp')}</h2>
            <p className="text-sm text-slate-500">{t('installHelp')}</p>
          </div>
        </div>

        {installed ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{t('installDone')}</p>
        ) : canPrompt ? (
          <button onClick={install} className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 sm:w-auto">
            {t('installNow')}
          </button>
        ) : isIOS ? (
          steps(['installIos1', 'installIos2', 'installIos3'])
        ) : (
          // the browser hasn't offered it (yet, or it can't): the menu way
          steps(['installOther1', 'installOther2'])
        )}
      </section>
    </div>
  )
}

/**
 * One hint, a point per line. "الافتقاد: دوسة 📞 تليفون، دوستين 🏠 زيارة، …" → the part before ":"
 * as its title and a bullet per piece between commas; a hint without a title gets a bullet per
 * sentence (its commas belong to the sentence).
 */
function Tip({ text, tone }: { text: string; tone: string }) {
  const colon = text.indexOf(':')
  const hasTitle = colon > 0 && colon < 30
  const title = hasTitle ? text.slice(0, colon).trim() : null
  const points = (hasTitle ? text.slice(colon + 1) : text)
    .split(hasTitle ? /[،,]\s*|\.\s+/ : /\.\s+/)
    .map(p => p.trim().replace(/\.$/, ''))
    .filter(Boolean)
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${tone}`}>
      {title && <div className="mb-1 font-bold">{title}</div>}
      <ul className="list-inside list-disc space-y-1 font-semibold">
        {points.map(p => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </div>
  )
}

const TONE = {
  green: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
  amber: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
  indigo: 'border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200',
  grey: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200',
}

/**
 * How things work — the explanations of every page in one place, each under its page's name
 * (they used to sit on top of the pages). The admins' pages only for admins.
 */
export function HelpPage({ admin }: { admin: boolean }) {
  const { t } = useI18n()
  const section = (title: TKey, tips: [TKey, string][]) => (
    <section className="space-y-2">
      <h2 className="px-1 pt-2 font-bold">{t(title)}</h2>
      {tips.map(([key, tone]) => (
        <Tip key={key} text={t(key)} tone={tone} />
      ))}
    </section>
  )
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {section('attendance', [
        ['visitHint', TONE.green],
        ['communionHint', TONE.amber],
        ['attendanceOrderNote', TONE.grey],
      ])}
      {section('classes', [['classesHelp', TONE.indigo]])}
      {section('share', [
        ['inviteHelp', TONE.indigo],
        ['joinHelp', TONE.indigo],
      ])}
      {section('customize', [['customFieldsHelp', TONE.grey], ...(admin ? ([['columnDefaultsHelp', TONE.grey]] as [TKey, string][]) : [])])}
      {section('installApp', [['installHelp', TONE.green]])}
      {admin && section('users', [['usersHelp', TONE.indigo]])}
      {admin && section('yearEndTitle', [['yearEndHelp', TONE.amber]])}
    </div>
  )
}
