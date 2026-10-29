import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useI18n } from '../lib/i18n'
import { PasswordInput } from '../components/PasswordInput'
import { confirmDialog } from '../components/ConfirmDialog'
import { sync, useStore } from '../lib/store'
import { CloudOffIcon, PencilIcon, PlusIcon, ShieldIcon, SyncIcon, TrashIcon, XIcon } from '../components/Icons'

type User = { id: string; email: string; display_name: string | null; created_at: string; last_sign_in_at: string | null; is_admin: boolean; shared: boolean; class_ids: string[] }

const input =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800'

/** Account changes go through the khedma-admin-users Edge Function — the browser never holds the service key. */
async function callAdmin(body: Record<string, unknown>): Promise<string | null> {
  const { error } = await supabase.functions.invoke('khedma-admin-users', { body })
  if (!error) return null
  if (error instanceof FunctionsHttpError) {
    try {
      return ((await error.context.json()) as { error?: string }).error ?? error.message
    } catch {
      return error.message
    }
  }
  return error.message
}

export function UsersPage({ myId }: { myId: string }) {
  const { t, lang } = useI18n()
  const { online, classes } = useStore()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('admin_list_users')
    if (error) setError(error.message)
    else setUsers(data as User[])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (online) load()
  }, [online, load])

  async function run(action: () => Promise<string | null>) {
    setError('')
    const err = await action()
    if (err) setError(/Failed to send|not found|404/i.test(err) ? `${t('functionMissing')} (${err})` : err)
    await load()
    sync()
    return !err
  }

  const addToClass = (userId: string, classId: string) =>
    // upsert: also brings back someone who had left this class
    run(async () => (await supabase.from('class_members').upsert({ class_id: classId, user_id: userId, left_at: null })).error?.message ?? null)
  const removeFromClass = (userId: string, classId: string) =>
    run(async () => (await supabase.from('class_members').delete().eq('class_id', classId).eq('user_id', userId)).error?.message ?? null)

  const className = (id: string) => classes.find(c => c.id === id)?.name ?? id.slice(0, 8)
  const time = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {!online && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <CloudOffIcon className="size-4 shrink-0" />
          {t('needsOnline')}
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300" dir="auto">
          {error}
        </p>
      )}

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <h2 className="flex-1 font-bold">
            {t('users')} <span className="text-slate-400">({users.length})</span>
          </h2>
          <button
            onClick={load}
            disabled={!online || loading}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <SyncIcon className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </button>
        </div>

        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {users.map(u => (
            <li key={u.id} className="space-y-2 py-3">
              {editing === u.id ? (
                <EditUser
                  user={u}
                  isMe={u.id === myId}
                  onCancel={() => setEditing(null)}
                  onSave={async body => {
                    if (await run(() => callAdmin({ action: 'update', id: u.id, ...body }))) setEditing(null)
                  }}
                />
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {u.display_name && <span className="font-semibold">{u.display_name}</span>}
                  <span className={u.display_name ? 'text-sm text-slate-500' : 'font-semibold'} dir="ltr">
                    {u.email}
                  </span>
                  {u.is_admin && (
                    <span className="flex items-center gap-1 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">
                      <ShieldIcon className="size-3" />
                      {t('admin')}
                    </span>
                  )}
                  {u.id === myId && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold dark:bg-slate-800">{t('you')}</span>}
                  {u.shared && (
                    <span title={t('sharedAccountHelp')} className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                      {t('sharedAccount')}
                    </span>
                  )}
                  <span className="ms-auto text-xs text-slate-500">
                    {t('lastSignIn')}: {u.last_sign_in_at ? time.format(new Date(u.last_sign_in_at)) : t('neverSignedIn')}
                  </span>
                  <button
                    onClick={() => setEditing(u.id)}
                    disabled={!online}
                    title={t('editUser')}
                    aria-label={t('editUser')}
                    className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"
                  >
                    <PencilIcon />
                  </button>
                  {u.id !== myId && !u.shared && (
                    <button
                      onClick={async () => {
                        const ok = await confirmDialog({ title: t('deleteUser'), message: t('deleteUserConfirm').replace('{email}', u.email), confirmLabel: t('deleteUser'), danger: true })
                        if (ok) run(() => callAdmin({ action: 'delete', id: u.id }))
                      }}
                      disabled={!online}
                      title={t('deleteUser')}
                      aria-label={t('deleteUser')}
                      className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-500/10"
                    >
                      <TrashIcon />
                    </button>
                  )}
                </div>
              )}

              {/* classes this user can see */}
              <div className="flex flex-wrap items-center gap-2">
                {u.class_ids.map(id => (
                  <span key={id} className="flex items-center gap-1 rounded-full bg-indigo-50 py-0.5 ps-3 pe-1 text-sm text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-200">
                    {className(id)}
                    <button
                      onClick={() => removeFromClass(u.id, id)}
                      disabled={!online}
                      title={t('removeFromClass')}
                      aria-label={t('removeFromClass')}
                      className="grid size-5 place-items-center rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-500/30"
                    >
                      <XIcon className="size-3" />
                    </button>
                  </span>
                ))}
                {classes.some(c => !u.class_ids.includes(c.id)) && (
                  <select
                    value=""
                    disabled={!online}
                    onChange={e => e.target.value && addToClass(u.id, e.target.value)}
                    className="rounded-full border border-dashed border-slate-300 bg-transparent px-3 py-0.5 text-sm text-slate-500 dark:border-slate-600"
                  >
                    <option value="">{t('addToClass')}</option>
                    {classes
                      .filter(c => !u.class_ids.includes(c.id))
                      .map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* adding a user: below the list of users there already are */}
      <CreateUser disabled={!online} onCreate={body => run(() => callAdmin({ action: 'create', ...body }))} />
    </div>
  )
}

function CreateUser({ disabled, onCreate }: { disabled: boolean; onCreate: (b: { name: string; email: string; password: string; admin: boolean }) => Promise<boolean> }) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [admin, setAdmin] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError(t('passwordTooShort'))
    if (password !== repeat) return setError(t('passwordMismatch'))
    setBusy(true)
    if (await onCreate({ name: name.trim(), email, password, admin })) {
      setName('')
      setEmail('')
      setPassword('')
      setRepeat('')
      setAdmin(false)
    }
    setBusy(false)
  }

  const field = (label: string, control: ReactNode) => (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold">{label}</span>
      {control}
    </label>
  )

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="flex items-center gap-2 font-bold">
        <PlusIcon className="size-5 text-indigo-600 dark:text-indigo-300" />
        {t('addUser')}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {field(
          t('name'),
          <input required maxLength={100} autoComplete="off" placeholder={t('phUserName')} className={input} value={name} onChange={e => setName(e.target.value)} disabled={disabled || busy} />,
        )}
        {field(
          t('email'),
          <input type="email" required dir="ltr" autoComplete="off" placeholder="name@example.com" className={input} value={email} onChange={e => setEmail(e.target.value)} disabled={disabled || busy} />,
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {field(
          t('passwordLabel'),
          <PasswordInput
            required
            minLength={8}
            autoComplete="new-password"
            placeholder={t('passwordTooShort')}
            className={input}
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={disabled || busy}
          />,
        )}
        {field(
          t('confirmPassword'),
          <PasswordInput
            required
            autoComplete="new-password"
            placeholder={t('phConfirmPassword')}
            className={input}
            value={repeat}
            onChange={e => setRepeat(e.target.value)}
            disabled={disabled || busy}
          />,
        )}
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" className="size-4 accent-indigo-600" checked={admin} onChange={e => setAdmin(e.target.checked)} disabled={disabled || busy} />
        {t('makeAdmin')}
      </label>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
      <button
        disabled={disabled || busy}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 sm:w-auto"
      >
        <PlusIcon className="size-4" />
        {t('addUser')}
      </button>
    </form>
  )
}

function EditUser({
  user,
  isMe,
  onSave,
  onCancel,
}: {
  user: User
  isMe: boolean
  onSave: (b: { name?: string; email?: string; password?: string; admin?: boolean }) => Promise<void>
  onCancel: () => void
}) {
  const { t } = useI18n()
  const [name, setName] = useState(user.display_name ?? '')
  const [email, setEmail] = useState(user.email)
  const [password, setPassword] = useState('')
  const [admin, setAdmin] = useState(user.is_admin)
  const [busy, setBusy] = useState(false)

  const changes = {
    name: name.trim() !== (user.display_name ?? '') ? name.trim() : undefined,
    email: email.trim() !== user.email ? email.trim() : undefined,
    password: password || undefined,
    admin: admin !== user.is_admin ? admin : undefined,
  }
  // nothing to save until something is actually changed
  const changed = Object.values(changes).some(v => v !== undefined)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!changed) return
    setBusy(true)
    await onSave(changes)
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_1fr_auto] dark:bg-slate-800/50">
      <input maxLength={100} placeholder={t('phUserName')} className={input} value={name} onChange={e => setName(e.target.value)} disabled={busy} aria-label={t('name')} />
      <input type="email" required dir="ltr" placeholder="name@example.com" className={input} value={email} onChange={e => setEmail(e.target.value)} disabled={busy || user.shared} aria-label={t('email')} />
      <PasswordInput
        minLength={8}
        autoComplete="new-password"
        placeholder={user.shared ? t('sharedAccount') : t('passwordKeep')}
        className={input}
        value={password}
        onChange={e => setPassword(e.target.value)}
        disabled={busy || user.shared}
      />
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" className="size-4 accent-indigo-600" checked={admin} onChange={e => setAdmin(e.target.checked)} disabled={busy || isMe} />
        {t('admin')}
      </label>
      {user.shared && <p className="text-xs text-amber-700 sm:col-span-4 dark:text-amber-300">{t('sharedAccountHelp')}</p>}
      <div className="flex gap-2 sm:col-span-4">
        <button disabled={busy || !changed} className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
          {t('save')}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-1.5 text-sm font-semibold dark:border-slate-700">
          {t('cancel')}
        </button>
      </div>
    </form>
  )
}
