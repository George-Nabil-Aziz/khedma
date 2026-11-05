import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useI18n, type TKey } from '../lib/i18n'
import { activeClasses, classRows, getState, saveSheetInfo, useStore } from '../lib/store'
import { supabase, type SheetInfo } from '../lib/supabase'
import { attendanceSheet, childrenSheet, classMonths, sheetHeader } from '../lib/sheet'
import { CalendarCheckIcon, CheckIcon, DownloadIcon, FileTextIcon, SheetIcon, UsersIcon } from '../components/Icons'

const input =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800'

const FIELDS: { key: keyof SheetInfo; label: TKey }[] = [
  { key: 'title', label: 'sheetTitle' },
  { key: 'servants', label: 'sheetServants' },
  { key: 'grade', label: 'sheetGrade' },
  { key: 'head', label: 'sheetHead' },
  { key: 'assistant', label: 'sheetAssistant' },
  { key: 'area', label: 'sheetArea' },
]

type Table = 'children' | 'attendance'

/**
 * التصدير: pick a class, a table (كشف الأولاد / كشف المتابعة), then PDF or Excel. Works offline —
 * everything is already on this device; only saving بيانات الكشف needs a connection.
 */
export function ExportPage() {
  const { t } = useI18n()
  const store = useStore()
  const classes = activeClasses(store.classes)
  const [classId, setClassId] = useState(store.currentClass ?? classes[0]?.id ?? '')
  const c = classes.find(x => x.id === classId) ?? classes[0]
  const [table, setTable] = useState<Table>('children')
  const [month, setMonth] = useState('') // '' = the whole year
  const months = useMemo(() => (c ? classMonths(c) : []), [c, store.yearEndWeeks])

  // بيانات الكشف as typed here; starts from what the class has saved
  const saved = c?.sheet_info ?? {}
  const [info, setInfo] = useState<SheetInfo>(saved)
  const [servants, setServants] = useState('')
  useEffect(() => {
    setInfo(c?.sheet_info ?? {})
    setMonth('')
    setServants('')
    if (!c) return
    // the class's servants, for الخادم when nothing else was typed (needs a connection)
    let live = true
    supabase.rpc('class_servants', { p_class: c.id }).then(({ data }) => {
      if (live && data) setServants((data as { display_name: string | null; email: string }[]).map(s => s.display_name || s.email.split('@')[0]).join(' - '))
    })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c?.id])

  const changed = FIELDS.some(f => (info[f.key] ?? '').trim() !== (saved[f.key] ?? '').trim())
  const [saving, setSaving] = useState(false)
  const [savedNote, setSavedNote] = useState(false)
  const [error, setError] = useState('')
  async function save() {
    if (!c) return
    setSaving(true)
    setError('')
    const clean = Object.fromEntries(FIELDS.map(f => [f.key, (info[f.key] ?? '').trim()]).filter(([, v]) => v)) as SheetInfo
    const r = await saveSheetInfo(c.id, clean)
    setSaving(false)
    if (!r.ok) setError(r.error)
    else {
      setSavedNote(true)
      setTimeout(() => setSavedNote(false), 2000)
    }
  }

  const [busy, setBusy] = useState<'pdf' | 'excel' | null>(null)
  async function run(format: 'pdf' | 'excel') {
    if (!c) return
    setBusy(format)
    setError('')
    try {
      const header = sheetHeader(c, info, servants)
      const sheet = table === 'children' ? childrenSheet(c, header) : attendanceSheet(c, header, month || null)
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

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Step n={1} title={t('classLabel')}>
        <select className={input} value={c.id} onChange={e => setClassId(e.target.value)}>
          {classes.map(x => (
            <option key={x.id} value={x.id}>
              {x.is_default ? '⭐ ' : ''}
              {x.name} — {x.service_year}
            </option>
          ))}
        </select>
      </Step>

      <Step n={2} title={t('exportWhichTable')}>
        <div className="grid gap-2 sm:grid-cols-2">
          <Choice on={table === 'children'} onClick={() => setTable('children')} icon={<UsersIcon />} title={t('exportChildren')} hint={t('exportChildrenHint')} />
          <Choice on={table === 'attendance'} onClick={() => setTable('attendance')} icon={<CalendarCheckIcon />} title={t('exportAttendance')} hint={t('exportAttendanceHint')} />
        </div>
        {table === 'attendance' && (
          <label className="mt-3 block space-y-1">
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{t('exportPeriod')}</span>
            <select className={input} value={month} onChange={e => setMonth(e.target.value)}>
              <option value="">
                {t('wholeYear')} ({c.service_year})
              </option>
              {months.map(m => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </Step>

      <Step n={3} title={t('sheetInfo')}>
        <p className="mb-3 text-sm text-slate-500">{t('sheetInfoHint')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map(f => (
            <label key={f.key} className="block space-y-1">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{t(f.label)}</span>
              <input
                className={input}
                value={info[f.key] ?? ''}
                placeholder={f.key === 'title' ? c.name : f.key === 'servants' ? servants : ''}
                onChange={e => setInfo({ ...info, [f.key]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            onClick={save}
            disabled={!changed || saving || !store.online}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {t('save')}
          </button>
          {savedNote && <span className="text-sm font-semibold text-emerald-600">{t('saved')}</span>}
          {!store.online && changed && <span className="text-sm text-amber-600">{t('sheetInfoOffline')}</span>}
        </div>
      </Step>

      <Step n={4} title={t('exportAs')}>
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
