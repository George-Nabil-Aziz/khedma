import { useMemo, useState } from 'react'
import { useI18n, type TKey } from '../lib/i18n'
import { isDay, setDays, useStore, type DayKind } from '../lib/store'
import { currentServiceYear, fridays, iso, serviceYearRange, weekOfMonth } from '../lib/serviceYear'
import { ClassTitle } from '../components/ClassTitle'
import { confirmDialog } from '../components/ConfirmDialog'
import { toast } from '../components/Toast'

const WEEKS: { n: number; label: TKey }[] = [
  { n: 1, label: 'week1' },
  { n: 2, label: 'week2' },
  { n: 3, label: 'week3' },
  { n: 4, label: 'week4' },
  { n: 5, label: 'week5' },
]

// same signs and colours as the attendance grid
const KIND: Record<DayKind, { label: TKey; sign: string; on: string; text: string; apply: TKey; confirm: TKey }> = {
  communion: {
    label: 'communionDay',
    sign: '✝',
    on: 'border-amber-500 bg-amber-100 text-amber-800 dark:border-amber-400 dark:bg-amber-500/20 dark:text-amber-200',
    text: 'text-amber-600 dark:text-amber-300',
    apply: 'daysApplyCommunion',
    confirm: 'daysApplyCommunionConfirm',
  },
  club: {
    label: 'clubDay',
    sign: '⚽',
    on: 'border-sky-500 bg-sky-100 text-sky-800 dark:border-sky-400 dark:bg-sky-500/20 dark:text-sky-200',
    text: 'text-sky-600 dark:text-sky-300',
    apply: 'daysApplyClub',
    confirm: 'daysApplyClubConfirm',
  },
}

const PREVIEW = 8

/**
 * الإعدادات → أيام التناول والنادي, for the class on screen: which Fridays of the month are
 * communion and which club (e.g. club on the 1st and 3rd), applied to the coming Fridays.
 * Each kind on its own, with its own button: applying club never touches communion.
 */
export function DaysPage() {
  const { t } = useI18n()
  const store = useStore()

  // the coming Fridays of the class's own service year (today too, if it is a Friday)
  const year = store.classes.find(c => c.id === store.currentClass)?.service_year ?? currentServiceYear()
  const coming = useMemo(() => {
    const { end } = serviceYearRange(year)
    return fridays(iso(new Date()), end)
    // the end also moves with the admin's year-end setting
  }, [year, store.yearEndWeeks])

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <ClassTitle />
      <p className="text-sm text-slate-500">{t('daysHelp')}</p>
      {coming.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:bg-slate-800/60">{t('daysYearOver')}</p>
      ) : (
        (['communion', 'club'] as DayKind[]).map(kind => <KindCard key={kind} kind={kind} coming={coming} />)
      )}
    </div>
  )
}

function KindCard({ kind, coming }: { kind: DayKind; coming: Date[] }) {
  const { t, lang } = useI18n()
  const store = useStore()
  const k = KIND[kind]

  // start from what the grid has now: a Friday-of-the-month is ticked when every coming one is marked
  const [picked, setPicked] = useState<number[]>(() =>
    WEEKS.map(w => w.n).filter(n => {
      const days = coming.filter(d => weekOfMonth(d) === n)
      return days.length > 0 && days.every(d => isDay(store, iso(d), kind))
    }),
  )
  const toggle = (n: number) => setPicked(p => (p.includes(n) ? p.filter(x => x !== n) : [...p, n]))

  const fmt = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'long' })

  async function apply() {
    const ok = await confirmDialog({ title: t(k.label), message: t(k.confirm).replace('{from}', fmt.format(coming[0])), confirmLabel: t(k.apply) })
    if (!ok) return
    const week = new Map(coming.map(d => [iso(d), weekOfMonth(d)]))
    setDays(kind, coming.map(iso), date => picked.includes(week.get(date)!))
    toast(t('daysApplied'))
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className={`flex flex-wrap items-center gap-2 font-bold ${k.text}`}>
        <span>{k.sign}</span>
        {t(k.label)}
        <span className="text-sm font-normal text-slate-500">— {t('daysWhich')}</span>
      </h2>

      <div className="flex flex-wrap gap-2">
        {WEEKS.map(w => {
          const on = picked.includes(w.n)
          return (
            <button
              key={w.n}
              role="checkbox"
              aria-checked={on}
              onClick={() => toggle(w.n)}
              className={`rounded-lg border-2 px-3 py-1.5 text-sm font-semibold ${on ? k.on : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300'}`}
            >
              {t(w.label)}
            </button>
          )
        })}
      </div>

      {/* what the next Fridays will look like with this choice */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-500">{t('daysNext')}</h3>
        <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {coming.slice(0, PREVIEW).map(d => (
            <li key={iso(d)} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-sm dark:bg-slate-800/60">
              <span>{fmt.format(d)}</span>
              {picked.includes(weekOfMonth(d)) && <span className={k.text}>{k.sign}</span>}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex justify-end">
        <button onClick={apply} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700">
          {t(k.apply)}
        </button>
      </div>
    </section>
  )
}
