import { useState, type FormEvent, type MouseEvent, type ReactNode } from 'react'
import { OWNERS, TEXT_FIELDS, type ChildInput, type CustomField, type Owner, type Phone, type TextField } from '../lib/supabase'
import { useI18n, type TKey } from '../lib/i18n'
import { go } from '../lib/router'
import { classFields, findRow, saveChild, useStore } from '../lib/store'
import { SIDES } from '../lib/columns'
import { PhotoPicker } from '../components/Avatar'
import { OWNER_LABEL, OWNER_PHONES_LABEL } from '../lib/phones'
import { ArrowBackIcon, PlusIcon, StarIcon, StarOutlineIcon, TrashIcon, WhatsAppIcon } from '../components/Icons'

type FormField = 'full_name' | TextField
type Texts = Record<FormField, string>

const EMPTY_TEXTS = Object.fromEntries(['full_name', ...TEXT_FIELDS].map(f => [f, ''])) as Texts

export function ChildFormPage({ clientId }: { clientId: string | null }) {
  const { t } = useI18n()
  const store = useStore()
  const existing = clientId ? findRow(store, clientId) : null

  if (clientId && !existing) return <Notice>{store.loaded ? t('notFound') : t('loading')}</Notice>
  if (existing?.status === 'conflict')
    return (
      <Notice>
        {t('inConflict')}
        <button onClick={() => go('/sync')} className="mt-4 block w-full rounded-lg bg-indigo-600 py-2 font-semibold text-white">
          {t('sync')}
        </button>
      </Notice>
    )

  // key: reset the form when switching between children
  return <ChildForm key={clientId ?? 'new'} clientId={clientId} initial={existing ?? null} />
}

function ChildForm({ clientId, initial }: { clientId: string | null; initial: ChildInput | null }) {
  const { t } = useI18n()
  const store = useStore()
  const { online } = store
  const fields = classFields(store)
  const [texts, setTexts] = useState<Texts>(() =>
    initial ? (Object.fromEntries(Object.keys(EMPTY_TEXTS).map(f => [f, initial[f as FormField] ?? ''])) as Texts) : EMPTY_TEXTS,
  )
  const [phones, setPhones] = useState<Phone[]>(() => initial?.phones ?? [])
  const [primary, setPrimary] = useState<Owner[]>(() => initial?.primary_contacts ?? [])
  const [extra, setExtra] = useState<Record<string, unknown>>(() => initial?.extra ?? {})
  const [photo, setPhoto] = useState<string | null>(() => initial?.photo ?? null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [savedOffline, setSavedOffline] = useState(false)

  const setText = (f: FormField) => (v: string) => setTexts(prev => ({ ...prev, [f]: v }))

  function validate() {
    const e: Record<string, string> = {}
    if (!texts.full_name.trim()) e.full_name = t('required')
    if (texts.national_id.trim() && !/^\d{14}$/.test(texts.national_id.trim())) e.national_id = t('invalidNationalId')
    phones.forEach((p, i) => {
      if (p.number.trim() && !/^\+?[\d\s-]{6,20}$/.test(p.number.trim())) e[`phone:${i}`] = t('invalidPhone')
    })
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!validate()) return
    const input = {
      ...(Object.fromEntries(Object.entries(texts).map(([f, v]) => [f, v.trim() || null])) as Record<FormField, string | null>),
      phones: phones.map(p => ({ ...p, number: p.number.trim() })).filter(p => p.number),
      primary_contacts: OWNERS.filter(o => primary.includes(o)),
      extra,
      photo,
    } as ChildInput
    saveChild(clientId, input)
    if (online) go('/')
    else {
      setSavedOffline(true)
      setTimeout(() => go('/'), 1200)
    }
  }

  const text = (f: FormField, label: TKey, opts: { type?: string; ltr?: boolean; hint?: TKey; inputMode?: 'numeric' } = {}) => (
    <Field label={t(label)} error={errors[f]} hint={opts.hint && t(opts.hint)}>
      <input
        type={opts.type ?? 'text'}
        onClick={openPicker}
        dir={opts.ltr ? 'ltr' : undefined}
        inputMode={opts.inputMode}
        className={inputClass(!!errors[f])}
        value={texts[f]}
        onChange={e => setText(f)(e.target.value)}
      />
    </Field>
  )

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-5 pb-24">
      <button type="button" onClick={() => go('/')} className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        <ArrowBackIcon className="size-4" />
        {t('children')}
      </button>

      <Section title={t('basicInfo')}>
        <div className="sm:col-span-2">
          <PhotoPicker photo={photo} name={texts.full_name} onChange={setPhoto} />
        </div>
        <div className="sm:col-span-2">{text('full_name', 'name', { hint: 'nameHint' })}</div>
        {text('birth_date', 'birthDate', { type: 'date', ltr: true })}
        {text('national_id', 'nationalId', { ltr: true, inputMode: 'numeric' })}
        {text('deacon', 'deacon')}
      </Section>

      <Section title={t('address')}>
        {text('house_number', 'houseNumber')}
        {text('street', 'street')}
        {text('branch_of_street', 'branchOfStreet')}
        {text('landmark', 'landmark')}
        {text('floor', 'floorLabel')}
        <Field label={t('side')}>
          <select className={inputClass(false)} value={texts.side} onChange={e => setText('side')(e.target.value)}>
            <option value="">—</option>
            {SIDES.map(s => (
              <option key={s.value} value={s.value}>
                {t(s.key)}
              </option>
            ))}
            {texts.side && !SIDES.some(s => s.value === texts.side) && <option value={texts.side}>{texts.side}</option>}
          </select>
        </Field>
        {text('apartment', 'apartmentLabel')}
      </Section>

      <Section title={t('phones')}>
        <div className="space-y-4 sm:col-span-2">
          {OWNERS.map(owner => (
            <PhoneGroup
              key={owner}
              owner={owner}
              phones={phones}
              setPhones={setPhones}
              primary={primary.includes(owner)}
              onPrimary={() => setPrimary(p => (p.includes(owner) ? p.filter(o => o !== owner) : [...p, owner]))}
              errors={errors}
            />
          ))}
        </div>
      </Section>

      {fields.length > 0 && (
        <Section title={t('extraFields')}>
          {fields.map(f => (
            <CustomInput key={f.key} field={f} value={extra[f.key]} onChange={v => setExtra(prev => ({ ...prev, [f.key]: v }))} />
          ))}
        </Section>
      )}

      <Section title={t('notes')}>
        <div className="sm:col-span-2">
          <textarea rows={3} className={inputClass(false)} value={texts.notes} onChange={e => setText('notes')(e.target.value)} />
        </div>
      </Section>

      {/* sticky action bar, easy to reach on a phone */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/90 p-3 backdrop-blur lg:inset-s-64 dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          {savedOffline && <span className="flex-1 text-sm font-semibold text-amber-600 dark:text-amber-300">{t('savedOffline')}</span>}
          <button type="button" onClick={() => go('/')} className="ms-auto rounded-lg border border-slate-200 px-4 py-2 font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
            {t('cancel')}
          </button>
          <button className="rounded-lg bg-indigo-600 px-6 py-2 font-semibold text-white hover:bg-indigo-700">{t('save')}</button>
        </div>
      </div>
    </form>
  )
}

function PhoneGroup({
  owner,
  phones,
  setPhones,
  primary,
  onPrimary,
  errors,
}: {
  owner: Owner
  phones: Phone[]
  setPhones: (f: (prev: Phone[]) => Phone[]) => void
  primary: boolean
  onPrimary: () => void
  errors: Record<string, string>
}) {
  const { t } = useI18n()
  // Keep each number's index in the full list so edits and errors line up.
  const mine = phones.map((p, i) => ({ p, i })).filter(x => x.p.owner === owner)
  const update = (i: number, patch: Partial<Phone>) => setPhones(prev => prev.map((p, j) => (j === i ? { ...p, ...patch } : p)))

  return (
    <div className={`rounded-lg border p-3 ${primary ? 'border-amber-300 bg-amber-50/50 dark:border-amber-500/40 dark:bg-amber-500/5' : 'border-slate-200 dark:border-slate-800'}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className="flex-1 text-sm font-bold">{t(OWNER_PHONES_LABEL[owner])}</span>
        <button
          type="button"
          onClick={onPrimary}
          title={t('makePrimary')}
          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
            primary ? 'bg-amber-400 text-amber-950' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          {primary ? <StarIcon className="size-3.5" /> : <StarOutlineIcon className="size-3.5" />}
          {t('primaryContact')}
        </button>
      </div>

      <div className="space-y-2">
        {mine.map(({ p, i }) => (
          <div key={i}>
            <div className="flex items-center gap-2">
              <input
                type="tel"
                dir="ltr"
                inputMode="tel"
                placeholder="01xxxxxxxxx"
                className={inputClass(!!errors[`phone:${i}`])}
                value={p.number}
                onChange={e => update(i, { number: e.target.value })}
              />
              <button
                type="button"
                onClick={() => update(i, { whatsapp: !p.whatsapp })}
                title={t('hasWhatsapp')}
                aria-pressed={p.whatsapp}
                className={`flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-2 text-xs font-semibold ${
                  p.whatsapp
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-slate-300 text-slate-400 hover:text-emerald-600 dark:border-slate-700'
                }`}
              >
                <WhatsAppIcon className="size-4" />
                <span className="hidden sm:inline">WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={() => setPhones(prev => prev.filter((_, j) => j !== i))}
                title={t('removeNumber')}
                aria-label={t('removeNumber')}
                className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
              >
                <TrashIcon />
              </button>
            </div>
            {errors[`phone:${i}`] && <span className="mt-1 block text-xs font-semibold text-red-600 dark:text-red-400">{errors[`phone:${i}`]}</span>}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setPhones(prev => [...prev, { owner, number: '', whatsapp: false }])}
        className="mt-2 flex items-center gap-1 text-sm font-semibold text-indigo-700 hover:underline dark:text-indigo-300"
      >
        <PlusIcon className="size-4" />
        {t('addNumber')} — {t(OWNER_LABEL[owner])}
      </button>
    </div>
  )
}

function CustomInput({ field, value, onChange }: { field: CustomField; value: unknown; onChange: (v: unknown) => void }) {
  const { t } = useI18n()
  if (field.type === 'boolean') {
    return (
      <Field label={field.label}>
        <select
          className={inputClass(false)}
          value={value == null ? '' : value ? 'yes' : 'no'}
          onChange={e => onChange(e.target.value === '' ? null : e.target.value === 'yes')}
        >
          <option value="">—</option>
          <option value="yes">{t('yes')}</option>
          <option value="no">{t('no')}</option>
        </select>
      </Field>
    )
  }
  return (
    <Field label={field.label}>
      <input
        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
        onClick={openPicker}
        dir={field.type === 'text' ? undefined : 'ltr'}
        className={inputClass(false)}
        value={value == null ? '' : String(value)}
        onChange={e => {
          const v = e.target.value
          onChange(v === '' ? null : field.type === 'number' ? Number(v) : v)
        }}
      />
    </Field>
  )
}

/** Date fields: a click anywhere in the box opens the calendar, not only on the small icon. */
function openPicker(e: MouseEvent<HTMLInputElement>) {
  const input = e.currentTarget
  if (input.type !== 'date') return
  try {
    input.showPicker()
  } catch {
    /* older browsers: the default behaviour still works */
  }
}

const inputClass = (invalid: boolean) =>
  `w-full rounded-lg border bg-white px-3 py-2 outline-none focus:ring-2 dark:bg-slate-800 ${
    invalid
      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
      : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/20 dark:border-slate-700'
  }`

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <legend className="px-2 text-sm font-bold text-indigo-700 dark:text-indigo-300">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  )
}

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-semibold">
        {label}
        {hint && <span className="ms-2 text-xs font-normal text-slate-400">({hint})</span>}
      </span>
      {children}
      {error && <span className="block text-xs font-semibold text-red-600 dark:text-red-400">{error}</span>}
    </label>
  )
}

function Notice({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-xl space-y-4 rounded-xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">{children}</div>
}
