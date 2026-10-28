import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useI18n } from '../lib/i18n'
import { sync } from '../lib/store'
import { Avatar } from './Avatar'
import { confirmDialog } from './ConfirmDialog'
import { XIcon } from './Icons'

// Roles are not shown here — only who "you" are.
type Servant = { user_id: string; email: string; display_name: string | null; photo: string | null; joined_at: string }
type Account = { id: string; email: string; display_name: string | null }

/**
 * The servants of one class, loaded when shown (needs a connection).
 * An admin can also take anyone out of the class, or add any Khedma account to it.
 */
export function ClassServants({ classId, className, admin }: { classId: string; className: string; admin: boolean }) {
  const { t, lang } = useI18n()
  const [list, setList] = useState<Servant[] | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [myId, setMyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('class_servants', { p_class: classId })
    if (error) setError(error.message)
    else setList(data as Servant[])
  }, [classId])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setMyId(data.session?.user.id ?? null))
    load()
    // The admin's "add" list: every Khedma account (the database only answers admins).
    if (admin) supabase.rpc('admin_list_users').then(({ data }) => data && setAccounts(data as Account[]))
  }, [load, admin])

  async function change(action: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true)
    setError('')
    const { error } = await action()
    if (error) setError(error.message)
    await load()
    sync() // my own class list may have changed
    setBusy(false)
  }

  async function remove(s: Servant) {
    const who = s.display_name || s.email
    const ok = await confirmDialog({
      title: t('removeFromClass'),
      message: t('removeServantConfirm').replace('{name}', who).replace('{class}', className),
      confirmLabel: t('removeFromClass'),
      danger: true,
    })
    if (ok) change(() => supabase.from('class_members').delete().eq('class_id', classId).eq('user_id', s.user_id))
  }

  // upsert: also brings back someone who had left this class
  const add = (userId: string) => change(() => supabase.from('class_members').upsert({ class_id: classId, user_id: userId, left_at: null }))

  const date = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { dateStyle: 'medium' })

  if (!list) {
    if (error) return <ErrorText>{error}</ErrorText>
    return <p className="px-1 text-sm text-slate-500">{t('loading')}</p>
  }

  const notInClass = accounts.filter(a => !list.some(s => s.user_id === a.id))

  return (
    <div className="space-y-2">
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
        {list.map(s => (
          <li key={s.user_id} className="flex items-center gap-3 px-3 py-2">
            <Avatar photo={s.photo} name={s.display_name || s.email} className="size-9 text-sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-semibold">{s.display_name || s.email}</span>
                {s.user_id === myId && <span className="rounded-full bg-slate-100 px-2 text-[10px] font-bold dark:bg-slate-800">{t('you')}</span>}
              </div>
              {s.display_name && (
                <div className="truncate text-xs text-slate-500" dir="ltr">
                  {s.email}
                </div>
              )}
            </div>
            <span className="shrink-0 text-xs text-slate-400">
              {t('joinedOn')} {date.format(new Date(s.joined_at))}
            </span>
            {admin && (
              <button
                onClick={() => remove(s)}
                disabled={busy}
                title={t('removeFromClass')}
                aria-label={`${t('removeFromClass')}: ${s.display_name || s.email}`}
                className="grid size-8 shrink-0 place-items-center rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-500/10"
              >
                <XIcon />
              </button>
            )}
          </li>
        ))}
        {list.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">{t('noServants')}</li>}
      </ul>

      {admin && notInClass.length > 0 && (
        <select
          value=""
          disabled={busy}
          onChange={e => e.target.value && add(e.target.value)}
          className="w-full rounded-lg border border-dashed border-indigo-300 bg-white px-3 py-2 text-sm font-semibold text-indigo-700 outline-none focus:border-indigo-500 dark:border-indigo-500/40 dark:bg-slate-900 dark:text-indigo-300"
        >
          <option value="">{t('addServantToClass')}</option>
          {notInClass.map(a => (
            <option key={a.id} value={a.id}>
              {a.display_name ? `${a.display_name} — ${a.email}` : a.email}
            </option>
          ))}
        </select>
      )}

      {error && <ErrorText>{error}</ErrorText>}
    </div>
  )
}

function ErrorText({ children }: { children: string }) {
  return (
    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300" dir="auto">
      {children}
    </p>
  )
}
