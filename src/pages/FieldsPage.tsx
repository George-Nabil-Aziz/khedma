import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import type { CustomField, FieldType } from '../lib/supabase'
import { useI18n, type TKey } from '../lib/i18n'
import { addField, approveField, classFields, deleteField, pendingFields, renameField, saveColumnDefaults, useStore, viewRows } from '../lib/store'
import { BUILT_IN, removedColumns, useAllColumns, useColumnDefaultsEditor, type Column } from '../lib/columns'
import { ColumnsList } from '../components/ColumnsMenu'
import { AlertIcon, CheckIcon, ChevronDownIcon, CloudOffIcon, PlusIcon, TrashIcon } from '../components/Icons'
import { confirmDialog } from '../components/ConfirmDialog'

const TYPES: { value: FieldType; key: TKey }[] = [
  { value: 'text', key: 'typeText' },
  { value: 'number', key: 'typeNumber' },
  { value: 'date', key: 'typeDate' },
  { value: 'boolean', key: 'typeBoolean' },
]

const input =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800'

const card = 'space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900'

/**
 * Admins only — الأعمدة: add a column, and every column (no fixed ones but the name) in one list:
 * drag to order, tick what everyone sees by default, rename the class's own columns, delete any.
 * A built-in column deleted here leaves the app but keeps its data, so it can be brought back.
 */
export function FieldsPage() {
  const { t } = useI18n()
  const store = useStore()
  const { online } = store
  const pending = pendingFields(store)
  const names = useServantNames(pending.length > 0 ? store.currentClass : null)
  const [label, setLabel] = useState('')
  const [type, setType] = useState<FieldType>('text')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run(action: () => Promise<string | null>) {
    setBusy(true)
    setError('')
    const err = await action()
    if (err) setError(err)
    setBusy(false)
    return !err
  }

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!label.trim()) return
    if (await run(() => addField(label.trim(), type))) setLabel('')
  }

  /** How many children of this class have something typed in the column. */
  function filledCount(f: CustomField) {
    return viewRows(store).filter(r => {
      const v = r.extra?.[f.key]
      return v != null && v !== ''
    }).length
  }

  async function removeField(f: CustomField) {
    const n = filledCount(f)
    const message = n
      ? t('deleteFieldWithData').replace('{name}', f.label).replace('{count}', String(n))
      : t('deleteFieldEmpty').replace('{name}', f.label)
    if (await confirmDialog({ title: t('deleteField'), message, confirmLabel: t('deleteField'), danger: true })) run(() => deleteField(f.key))
  }

  /** A built-in column out of the app, or back in — saved at once, for everyone. */
  function setRemoved(id: string, gone: boolean) {
    const now = store.columnDefaults ?? BUILT_IN
    const removed = [...removedColumns(store)].filter(r => r !== id)
    return run(() => saveColumnDefaults({ ...now, removed: gone ? [...removed, id] : removed }))
  }

  async function removeBuiltIn(c: Column) {
    const ok = await confirmDialog({ title: t('deleteField'), message: t('removeBuiltInConfirm').replace('{name}', c.label), confirmLabel: t('deleteField'), danger: true })
    if (ok) setRemoved(c.id, true)
  }

  /** A waiting column: its name to rename in place, who added it, approve and delete. */
  function pendingRow(f: CustomField) {
    return (
      <div key={f.key} className="flex flex-wrap items-center gap-2">
        <input
          className={`${input} min-w-40 flex-1`}
          placeholder={t('phFieldLabel')}
          defaultValue={f.label}
          disabled={!online || busy}
          aria-label={t('fieldLabel')}
          onBlur={e => {
            const v = e.target.value.trim()
            if (v && v !== f.label) run(() => renameField(f.key, v))
            else e.target.value = f.label
          }}
        />
        <span className="shrink-0 whitespace-nowrap rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs dark:bg-slate-800">
          <span className="text-slate-500">{t('fieldType')}: </span>
          <span className="font-semibold">{t(TYPES.find(o => o.value === f.type)?.key ?? 'typeText')}</span>
        </span>
        {f.created_by && names[f.created_by] && (
          <span className="shrink-0 whitespace-nowrap rounded-lg bg-white px-2.5 py-1.5 text-xs dark:bg-slate-800">
            <span className="text-slate-500">{t('addedBy')}: </span>
            <span className="font-semibold">{names[f.created_by]}</span>
          </span>
        )}
        <button
          type="button"
          disabled={!online || busy}
          onClick={() => run(() => approveField(f.key))}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <CheckIcon className="size-4" />
          {t('approveField')}
        </button>
        <button
          type="button"
          disabled={!online || busy}
          onClick={() => removeField(f)}
          title={t('deleteField')}
          aria-label={t('deleteField')}
          className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-500/10"
        >
          <TrashIcon />
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {!online && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <CloudOffIcon className="size-4 shrink-0" />
          {t('onlineOnly')}
        </div>
      )}

      {/* how many columns servants added wait, at the very top — a tap goes down to them */}
      {pending.length > 0 && (
        <button
          type="button"
          onClick={() => document.getElementById('pending-fields')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="flex w-full items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-start text-sm font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/15"
        >
          <AlertIcon className="size-4 shrink-0" />
          <span className="flex-1">{t('pendingFieldsCount').replace('{count}', String(pending.length))}</span>
          <ChevronDownIcon className="size-4 shrink-0" />
        </button>
      )}

      <form onSubmit={add} className={`${card} space-y-4`}>
        <h2 className="flex items-center gap-2 font-bold">
          <PlusIcon className="size-5 text-indigo-600 dark:text-indigo-300" />
          {t('addField')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold">{t('fieldLabel')}</span>
            <input className={input} placeholder={t('phFieldLabel')} value={label} onChange={e => setLabel(e.target.value)} disabled={!online || busy} />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold">{t('fieldType')}</span>
            <select className={input} value={type} onChange={e => setType(e.target.value as FieldType)} disabled={!online || busy}>
              {TYPES.map(o => (
                <option key={o.value} value={o.value}>
                  {t(o.key)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          disabled={!online || busy || !label.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 sm:w-auto"
        >
          <PlusIcon className="size-4" />
          {t('addField')}
        </button>
      </form>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}

      <ColumnsCard busy={busy} onRemoveField={removeField} onRemoveBuiltIn={removeBuiltIn} onRename={(key, v) => run(() => renameField(key, v))} onRestore={id => setRemoved(id, false)} />

      {/* what servants added, seen by nobody else until approved here */}
      {pending.length > 0 && (
        <section id="pending-fields" className="space-y-3 rounded-xl border border-amber-300 bg-amber-50/60 p-4 dark:border-amber-500/40 dark:bg-amber-500/5">
          <div>
            <h2 className="font-bold">
              {t('pendingFieldsTitle')} ({pending.length})
            </h2>
            <p className="mt-1 text-sm text-slate-500">{t('pendingFieldsHelp')}</p>
          </div>
          {pending.map(pendingRow)}
        </section>
      )}
    </div>
  )
}

/**
 * Every column in one list: the order and what is shown by default (a draft until saved), the
 * class's own columns renamed in place, a delete button on each. Then the deleted built-in ones.
 */
function ColumnsCard({
  busy,
  onRemoveField,
  onRemoveBuiltIn,
  onRename,
  onRestore,
}: {
  busy: boolean
  onRemoveField: (f: CustomField) => void
  onRemoveBuiltIn: (c: Column) => void
  onRename: (key: string, label: string) => void
  onRestore: (id: string) => void
}) {
  const { t } = useI18n()
  const store = useStore()
  const { online } = store
  const all = useAllColumns()
  const removed = removedColumns(store)
  const shown = useMemo(() => all.filter(c => !removedColumns({ columnDefaults: store.columnDefaults }).has(c.id)), [all, store.columnDefaults])
  const editor = useColumnDefaultsEditor(shown)
  const fields = classFields(store)
  const fieldOf = (c: Column) => (c.id.startsWith('x:') ? fields.find(f => `x:${f.key}` === c.id) : undefined)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function save() {
    setSaving(true)
    setError('')
    // keep the deleted built-in columns as they are
    const err = await saveColumnDefaults({ ...editor.layout(), removed: [...removed] })
    setSaving(false)
    if (err) return setError(err)
    editor.saved()
    setDone(true)
  }

  const changed = () => setDone(false)

  return (
    <>
      <section className={card}>
        <div>
          <h2 className="font-bold">{t('tableColumnsTitle')}</h2>
          <p className="mt-1 text-sm text-slate-500">{t('tableColumnsHelp')}</p>
        </div>
        <ColumnsList
          ordered={editor.ordered}
          onToggle={id => {
            editor.toggle(id)
            changed()
          }}
          onReorder={(id, overId) => {
            editor.reorder(id, overId)
            changed()
          }}
          label={(c, visible) => {
            const f = fieldOf(c)
            if (!f) return <span className={`truncate ${visible ? '' : 'text-slate-400'}`}>{c.label}</span>
            return (
              <input
                // a new name from the server starts the box afresh
                key={f.label}
                className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 hover:border-slate-300 focus:border-indigo-500 focus:outline-none disabled:opacity-60 dark:hover:border-slate-700"
                defaultValue={f.label}
                disabled={!online || busy}
                aria-label={t('fieldLabel')}
                title={t('renameColumn')}
                onBlur={e => {
                  const v = e.target.value.trim()
                  if (v && v !== f.label) onRename(f.key, v)
                  else e.target.value = f.label
                }}
              />
            )
          }}
          actions={c => {
            const f = fieldOf(c)
            return (
              <button
                type="button"
                disabled={!online || busy}
                onClick={() => (f ? onRemoveField(f) : onRemoveBuiltIn(c))}
                title={t('deleteField')}
                aria-label={`${t('deleteField')}: ${c.label}`}
                className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-500/10"
              >
                <TrashIcon />
              </button>
            )
          }}
        />
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
        <div className="flex items-center justify-end gap-2">
          {done && <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{t('saved')}</span>}
          <button
            onClick={editor.reset}
            disabled={saving || !editor.changed}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {t('cancel')}
          </button>
          <button
            onClick={save}
            disabled={!online || saving || !editor.changed}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {t('save')}
          </button>
        </div>
      </section>

      {/* deleted built-in columns: their data is still there — one tap brings a column back */}
      {removed.size > 0 && (
        <section className={card}>
          <div>
            <h2 className="font-bold">{t('removedColumnsTitle')}</h2>
            <p className="mt-1 text-sm text-slate-500">{t('removedColumnsHelp')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {all
              .filter(c => removed.has(c.id))
              .map(c => (
                <button
                  key={c.id}
                  type="button"
                  disabled={!online || busy}
                  onClick={() => onRestore(c.id)}
                  className="flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-3 py-1 text-sm text-slate-500 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300"
                >
                  <PlusIcon className="size-3.5" />
                  {c.label}
                </button>
              ))}
          </div>
        </section>
      )}
    </>
  )
}

/** The class's servants by id → their name (or email when they set none). Nothing is fetched while classId is null. */
function useServantNames(classId: string | null) {
  const [names, setNames] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!classId) return
    supabase.rpc('class_servants', { p_class: classId }).then(({ data }) => {
      const list = (data ?? []) as { user_id: string; email: string; display_name: string | null }[]
      setNames(Object.fromEntries(list.map(s => [s.user_id, s.display_name || s.email])))
    })
  }, [classId])
  return names
}
