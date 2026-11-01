import { useEffect, useState } from 'react'
import { useI18n, type TKey } from '../lib/i18n'
import { go } from '../lib/router'
import { useInstall } from '../lib/install'
import { useStore } from '../lib/store'
import {
  DEFAULT_REMINDERS,
  WHENS,
  currentSubscription,
  disablePush,
  enablePush,
  loadReminders,
  pushSupported,
  saveReminders,
  testPush,
  type Reminder,
  type When,
} from '../lib/push'
import { CloudOffIcon, PlusIcon, TrashIcon } from '../components/Icons'

const WHEN_LABEL: Record<When, TKey> = {
  friday_before: 'remindFridayBefore',
  week_before: 'remindWeekBefore',
  two_days_before: 'remindTwoDaysBefore',
  day_before: 'remindDayBefore',
  same_day: 'remindSameDay',
}

const MAX = 10

const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`)

const input =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800'
const card = 'space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900'

/**
 * الإعدادات → التنبيهات: birthday reminders. Turned on per device; when they come (how many
 * times, which days, what time) is mine, the same on all my devices.
 */
export function NotificationsPage() {
  const { t, lang } = useI18n()
  const { online } = useStore()
  // "8 ص" / "9 م" — the hour the way people say it
  const hourFmt = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', { hour: 'numeric', hour12: true, timeZone: 'UTC' })
  const hourLabel = (h: string) => hourFmt.format(new Date(`2000-01-01T${h}Z`))
  // null = still loading; the saved reminders, or the defaults for someone who never saved any
  const [reminders, setReminders] = useState<Reminder[] | null>(null)
  const [hasSaved, setHasSaved] = useState(false)
  const [changed, setChanged] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!online || reminders) return
    loadReminders()
      .then(r => {
        setHasSaved(!!r)
        setReminders(r ?? DEFAULT_REMINDERS)
      })
      .catch(e => setError(e.message))
  }, [online, reminders])

  function change(next: Reminder[]) {
    setReminders(next)
    setChanged(true)
    setSaved(false)
  }

  async function save(list = reminders) {
    if (!list) return
    setBusy(true)
    setError('')
    const err = await saveReminders(list, lang)
    setBusy(false)
    if (err) return setError(err)
    setHasSaved(true)
    setChanged(false)
    setSaved(true)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {!online && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <CloudOffIcon className="size-4 shrink-0" />
          {t('needsOnline')}
        </div>
      )}

      {/* turning it on once also saves the default times, or the server would have nothing to send */}
      <ThisDevice onEnabled={() => !hasSaved && reminders && save(reminders)} />

      <section className={card}>
        <div>
          <h2 className="font-bold">{t('remindersTitle')}</h2>
          <p className="mt-1 text-sm text-slate-500">{t('remindersHelp')}</p>
        </div>

        {reminders === null ? (
          <p className="text-sm text-slate-500">{online ? t('loading') : '—'}</p>
        ) : (
          <>
            {reminders.length === 0 && <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:bg-slate-800/60">{t('noReminders')}</p>}
            <ul className="space-y-2">
              {reminders.map((r, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-indigo-50 text-sm font-bold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">{i + 1}</span>
                  <select
                    value={r.when}
                    onChange={e => change(reminders.map((x, j) => (j === i ? { ...x, when: e.target.value as When } : x)))}
                    className={`${input} min-w-0 flex-1`}
                    aria-label={t('remindWhen')}
                  >
                    {WHENS.map(w => (
                      <option key={w} value={w}>
                        {t(WHEN_LABEL[w])}
                      </option>
                    ))}
                  </select>
                  {/* whole hours only: the server checks once an hour, on the hour */}
                  <select
                    value={r.time.slice(0, 2) + ':00'}
                    onChange={e => change(reminders.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))}
                    className={`${input} w-36`}
                    aria-label={t('remindTime')}
                  >
                    {HOURS.map(h => (
                      <option key={h} value={h}>
                        {hourLabel(h)}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => change(reminders.filter((_, j) => j !== i))}
                    title={t('removeReminder')}
                    aria-label={t('removeReminder')}
                    className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                  >
                    <TrashIcon />
                  </button>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => change([...reminders, { when: 'day_before', time: '20:00' }])}
                disabled={reminders.length >= MAX}
                className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <PlusIcon />
                {t('addReminder')}
              </button>
              <span className="flex-1" />
              {saved && <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{t('saved')}</span>}
              <button
                onClick={() => save()}
                disabled={!online || busy || (!changed && hasSaved)}
                className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {t('save')}
              </button>
            </div>
          </>
        )}

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
      </section>
    </div>
  )
}

/** On / off on this phone or computer, and a test. */
function ThisDevice({ onEnabled }: { onEnabled: () => void }) {
  const { t, lang } = useI18n()
  const { online } = useStore()
  const { installed, isIOS } = useInstall()
  // null = checking
  const [on, setOn] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null)
  const supported = pushSupported()
  const denied = supported && Notification.permission === 'denied'

  useEffect(() => {
    if (!supported) return
    currentSubscription()
      .then(s => setOn(!!s))
      .catch(() => setOn(false))
  }, [supported])

  async function enable() {
    setBusy(true)
    setNote(null)
    const err = await enablePush().catch((e: Error) => e.message)
    setBusy(false)
    if (err === 'denied') return setNote({ text: t('notifDenied'), ok: false })
    if (err === 'noWorker') return setNote({ text: t('notifNoWorker'), ok: false })
    if (err) return setNote({ text: err, ok: false })
    setOn(true)
    onEnabled()
  }

  async function disable() {
    setBusy(true)
    await disablePush()
    setBusy(false)
    setOn(false)
    setNote(null)
  }

  async function test() {
    setBusy(true)
    const r = await testPush(lang)
    setBusy(false)
    setNote('error' in r ? { text: r.error, ok: false } : { text: t('notifTestSent').replace('{n}', String(r.sent)), ok: r.sent > 0 })
  }

  const btn = 'rounded-lg px-4 py-2 font-semibold disabled:opacity-50'

  return (
    <section className={card}>
      <div>
        <h2 className="font-bold">{t('notifThisDevice')}</h2>
        <p className="mt-1 text-sm text-slate-500">{t('notifHelp')}</p>
      </div>

      {!supported ? (
        isIOS && !installed ? (
          // iPhone: only the installed app can get notifications
          <div className="space-y-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
            <p>{t('notifIosInstall')}</p>
            <button onClick={() => go('/install')} className="font-semibold underline">
              {t('installApp')}
            </button>
          </div>
        ) : (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">{t('notifUnsupported')}</p>
        )
      ) : denied ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">{t('notifDenied')}</p>
      ) : on ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex-1 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{t('notifOn')}</span>
          <button onClick={test} disabled={busy || !online} className={`${btn} border border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-500/30 dark:text-indigo-300 dark:hover:bg-indigo-500/10`}>
            {t('notifTest')}
          </button>
          <button onClick={disable} disabled={busy} className={`${btn} border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800`}>
            {t('notifTurnOff')}
          </button>
        </div>
      ) : (
        <button onClick={enable} disabled={busy || !online || on === null} className={`${btn} w-full bg-indigo-600 py-3 text-white hover:bg-indigo-700 sm:w-auto`}>
          {t('notifTurnOn')}
        </button>
      )}

      {note && (
        <p className={`rounded-lg px-3 py-2 text-sm ${note.ok ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'}`}>
          {note.text}
        </p>
      )}
    </section>
  )
}
