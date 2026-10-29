import { useState, type FormEvent } from 'react'
import type { CustomField, FieldType } from '../lib/supabase'
import { useI18n, type TKey } from '../lib/i18n'
import { addField, classFields, deleteField, renameField, saveColumnDefaults, useStore, viewRows } from '../lib/store'
import { useColumnDefaultsEditor, useColumns } from '../lib/columns'
import { ColumnsList } from '../components/ColumnsMenu'
import { CloudOffIcon, LockIcon, PlusIcon, TrashIcon } from '../components/Icons'
import { confirmDialog } from '../components/ConfirmDialog'

const TYPES: { value: FieldType; key: TKey }[] = [
  { value: 'text', key: 'typeText' },
  { value: 'number', key: 'typeNumber' },
  { value: 'date', key: 'typeDate' },
  { value: 'boolean', key: 'typeBoolean' },
]

const BUILT_IN: TKey[] = ['name', 'address', 'landmark', 'birthDate', 'age', 'motherMobile', 'fatherMobile', 'childMobile', 'primaryContact', 'category', 'deacon', 'notes', 'nationalId']

const input =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800'

export function FieldsPage({ admin }: { admin: boolean }) {
  const { t } = useI18n()
  const store = useStore()
  const { online } = store
  const fields = classFields(store)
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

  async function remove(f: CustomField) {
    const n = filledCount(f)
    const message = n
      ? t('deleteFieldWithData').replace('{name}', f.label).replace('{count}', String(n))
      : t('deleteFieldEmpty').replace('{name}', f.label)
    if (await confirmDialog({ title: t('deleteField'), message, confirmLabel: t('deleteField'), danger: true })) run(() => deleteField(f.key))
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {!online && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <CloudOffIcon className="size-4 shrink-0" />
          {t('onlineOnly')}
        </div>
      )}

      {/* add */}
      <form onSubmit={add} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
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
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
      </form>

      {/* custom */}
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-bold">{t('extraFields')}</h2>
        {fields.length === 0 ? (
          <p className="text-sm text-slate-500">{t('noCustomFields')}</p>
        ) : (
          fields.map(f => (
            <div key={f.key} className="flex items-center gap-2">
              <input
                className={input}
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
              {admin && (
                <button
                  type="button"
                  disabled={!online || busy}
                  onClick={() => remove(f)}
                  title={t('deleteField')}
                  aria-label={t('deleteField')}
                  className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-500/10"
                >
                  <TrashIcon />
                </button>
              )}
            </div>
          ))
        )}
        {!admin && fields.length > 0 && <p className="text-xs text-slate-400">{t('deleteFieldAdminOnly')}</p>}
      </section>

      {/* built-in */}
      <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-bold">{t('builtInColumns')}</h2>
        <p className="text-sm text-slate-500">{t('builtInHelp')}</p>
        <div className="flex flex-wrap gap-2">
          {BUILT_IN.map(k => (
            <span key={k} className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm dark:bg-slate-800">
              <LockIcon className="size-3.5 text-slate-400" />
              {t(k)}
            </span>
          ))}
        </div>
      </section>

      {/* admins: the table's default look for everyone */}
      {admin && <ColumnDefaultsCard />}
    </div>
  )
}

/**
 * Admins: the order of the table's columns and which are shown, for everyone. Anyone's
 * "default" in the columns menu goes back to this. A draft until saved.
 */
function ColumnDefaultsCard() {
  const { t } = useI18n()
  const { online } = useStore()
  const editor = useColumnDefaultsEditor(useColumns())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function save() {
    setBusy(true)
    setError('')
    const err = await saveColumnDefaults(editor.layout())
    setBusy(false)
    if (err) return setError(err)
    editor.saved()
    setDone(true)
  }

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h2 className="font-bold">{t('columnDefaultsTitle')}</h2>
        <p className="mt-1 text-sm text-slate-500">{t('columnDefaultsHelp')}</p>
      </div>
      <ColumnsList
        ordered={editor.ordered}
        onToggle={id => {
          editor.toggle(id)
          setDone(false)
        }}
        onReorder={(id, overId) => {
          editor.reorder(id, overId)
          setDone(false)
        }}
      />
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
      <div className="flex items-center justify-end gap-2">
        {done && <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{t('saved')}</span>}
        <button
          onClick={editor.reset}
          disabled={busy || !editor.changed}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {t('cancel')}
        </button>
        <button
          onClick={save}
          disabled={!online || busy || !editor.changed}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {t('save')}
        </button>
      </div>
    </section>
  )
}
