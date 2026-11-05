import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useI18n } from '../lib/i18n'
import { classRows, getState, saveExportColumns, useStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { attendanceSheet, childColumns, childrenSheet, classMonths, classQuarters, sheetHeader } from '../lib/sheet'
import { ClassTitle } from '../components/ClassTitle'
import { iso } from '../lib/serviceYear'
import { CalendarCheckIcon, CheckIcon, DownloadIcon, FileTextIcon, SheetIcon, UsersIcon } from '../components/Icons'

const input =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800'

type Table = 'children' | 'attendance'

/**
 * التصدير for the class on screen (picked in the sidebar): a table (كشف الأولاد / كشف المتابعة),
 * then PDF or Excel. Works offline — everything is already on this device. بيانات الكشف are typed
 * with the class (الفصول).
 */
export function ExportPage() {
  const { t } = useI18n()
  const store = useStore()
  const c = store.classes.find(x => x.id === store.currentClass)
  const [table, setTable] = useState<Table>('children')
  // الفترة of كشف المتابعة: the whole year, one of its four quarters, or a month picked from a list
  const [period, setPeriod] = useState<'year' | 'month' | number>('year') // a number = that quarter
  const [month, setMonth] = useState('')
  const months = useMemo(() => (c ? classMonths(c) : []), [c, store.yearEndWeeks])
  const quarters = useMemo(() => (c ? classQuarters(c) : []), [c, store.yearEndWeeks])

  // كشف الأولاد columns: the paper sheet's by default; a change is kept on my account
  const { all: allColumns, defaults } = useMemo(() => childColumns(c?.id ?? ''), [c?.id, store.fields])
  const mine = c ? store.profile?.export_columns?.[c.id] : undefined
  const [picked, setPicked] = useState<string[]>(mine ?? defaults)
  const isDefault = picked.length === defaults.length && defaults.every(id => picked.includes(id))
  const [columnsError, setColumnsError] = useState('')
  async function pick(next: string[]) {
    setPicked(next) // used for this export even if it could not be kept
    if (!c) return
    const same = next.length === defaults.length && defaults.every(id => next.includes(id))
    const err = await saveExportColumns(c.id, same ? null : next)
    setColumnsError(err ? t('exportColumnsNotSaved') : '')
  }
  // my choice arriving from the account (first sync, another device) while the page is open
  useEffect(() => {
    if (mine) setPicked(mine)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(mine)])

  const [servants, setServants] = useState('')
  useEffect(() => {
    setPeriod('year')
    setServants('')
    if (!c) return
    // the month list starts on this month when it is in the class's year
    const list = classMonths(c)
    const now = iso(new Date()).slice(0, 7)
    setMonth(list.find(m => m.value === now)?.value ?? list[0]?.value ?? '')
    setPicked(getState().profile?.export_columns?.[c.id] ?? childColumns(c.id).defaults)
    setColumnsError('')
    // the class's servants, for الخادم and the file name (needs a connection)
    let live = true
    supabase.rpc('class_servants', { p_class: c.id }).then(({ data }) => {
      if (live && data) setServants((data as { display_name: string | null; email: string }[]).map(s => s.display_name || s.email.split('@')[0]).join(' - '))
    })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c?.id])

  const [error, setError] = useState('')
  const [busy, setBusy] = useState<'pdf' | 'excel' | null>(null)
  async function run(format: 'pdf' | 'excel') {
    if (!c) return
    setBusy(format)
    setError('')
    try {
      const header = sheetHeader(c, c.sheet_info ?? {}, servants)
      const chosen =
        period === 'year'
          ? { months: null, label: c.service_year }
          : period === 'month'
            ? { months: [month], label: months.find(m => m.value === month)?.label ?? month }
            : { months: quarters[period].months, label: `${quarters[period].label} (${quarters[period].range})` }
      const sheet = table === 'children' ? childrenSheet(c, header, picked) : attendanceSheet(c, header, chosen)
      if (format === 'excel') await (await import('../lib/exportExcel')).exportExcel(sheet)
      else await (await import('../lib/exportPdf')).exportPdf(sheet)
    } catch (e) {
      setError(`${t('exportFailed')}: ${(e as Error).message}`)
    } finally {
      setBusy(null)
    }
  }

  if (!c) return null
  const empty = classRows(getState(), c.id).length === 0
  const toggle = (id: string) => pick(picked.includes(id) ? picked.filter(x => x !== id) : [...picked, id])
  const chip = (col: { id: string; label: string }) => {
    const on = picked.includes(col.id)
    return (
      <button
        key={col.id}
        onClick={() => toggle(col.id)}
        aria-pressed={on}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${
          on
            ? 'border-indigo-500 bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
            : 'border-slate-300 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
        }`}
      >
        {on && <CheckIcon className="size-3.5" />}
        {col.label}
      </button>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* the class is the one picked in the sidebar */}
      <ClassTitle />

      <Step n={1} title={t('exportWhichTable')}>
        <div className="grid gap-2 sm:grid-cols-2">
          <Choice on={table === 'children'} onClick={() => setTable('children')} icon={<UsersIcon />} title={t('exportChildren')} hint={t('exportChildrenHint')} />
          <Choice on={table === 'attendance'} onClick={() => setTable('attendance')} icon={<CalendarCheckIcon />} title={t('exportAttendance')} hint={t('exportAttendanceHint')} />
        </div>
        {table === 'attendance' && (
          <div className="mt-4 space-y-2">
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{t('exportPeriod')}</span>
            <Period on={period === 'year'} onClick={() => setPeriod('year')} title={t('wholeYear')} sub={c.service_year} />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {quarters.map((q, i) => (
                <Period key={i} on={period === i} onClick={() => setPeriod(i)} title={q.label} sub={q.range} />
              ))}
            </div>
            <Period on={period === 'month'} onClick={() => setPeriod('month')} title={t('oneMonth')} sub={period === 'month' ? undefined : t('oneMonthHint')} />
            {period === 'month' && (
              <select className={input} value={month} onChange={e => setMonth(e.target.value)} aria-label={t('oneMonth')} autoFocus>
                {months.map(m => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </Step>

      {table === 'children' && (
        <Step n={2} title={t('exportColumns')}>
          <p className={`mb-3 rounded-lg px-3 py-2 text-sm ${isDefault ? 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200'}`}>
            {isDefault ? t('exportColumnsDefault') : t('exportColumnsChanged')}
          </p>
          <div className="flex flex-wrap gap-2">{allColumns.map(chip)}</div>
          {!isDefault && (
            <button onClick={() => pick(defaults)} className="mt-4 text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-300">
              {t('exportColumnsReset')}
            </button>
          )}
          {columnsError && <p className="mt-2 text-sm text-amber-600">{columnsError}</p>}
        </Step>
      )}

      <Step n={table === 'children' ? 3 : 2} title={t('exportAs')}>
        {empty ? (
          <p className="text-sm text-slate-500">{t('exportEmpty')}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <FormatButton onClick={() => run('pdf')} busy={busy === 'pdf'} disabled={!!busy} icon={<FileTextIcon />} label="PDF" tone="bg-rose-600 hover:bg-rose-700" />
            <FormatButton onClick={() => run('excel')} busy={busy === 'excel'} disabled={!!busy} icon={<SheetIcon />} label="Excel" tone="bg-emerald-600 hover:bg-emerald-700" />
          </div>
        )}
        {busy && <p className="mt-2 text-sm text-slate-500">{t('exporting')}</p>}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </Step>
    </div>
  )
}

/** One choice of الفترة: a box, filled when chosen. */
function Period({ on, onClick, title, sub }: { on: boolean; onClick: () => void; title: string; sub?: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`w-full rounded-lg border px-3 py-2 text-center ${
        on ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/20 dark:bg-indigo-500/10' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
      }`}
    >
      <span className={`block font-semibold ${on ? 'text-indigo-700 dark:text-indigo-300' : ''}`}>{title}</span>
      {sub && <span className="block text-xs text-slate-500">{sub}</span>}
    </button>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-3 flex items-center gap-2 font-bold">
        <span className="grid size-6 place-items-center rounded-full bg-indigo-600 text-xs text-white">{n}</span>
        {title}
      </h3>
      {children}
    </section>
  )
}

function Choice({ on, onClick, icon, title, hint }: { on: boolean; onClick: () => void; icon: ReactNode; title: string; hint: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`flex items-start gap-3 rounded-lg border p-3 text-start ${
        on ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/20 dark:bg-indigo-500/10' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
      }`}
    >
      <span className={on ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-400'}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="block text-xs text-slate-500">{hint}</span>
      </span>
      {on && <CheckIcon className="size-5 text-indigo-600 dark:text-indigo-300" />}
    </button>
  )
}

function FormatButton({ onClick, busy, disabled, icon, label, tone }: { onClick: () => void; busy: boolean; disabled: boolean; icon: ReactNode; label: string; tone: string }) {
  return (
    <button onClick={onClick} disabled={disabled} className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-bold text-white disabled:opacity-60 ${tone}`}>
      {busy ? <DownloadIcon className="size-5 animate-bounce" /> : icon}
      {label}
    </button>
  )
}
