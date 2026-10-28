import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useI18n } from '../lib/i18n'
import { Avatar } from './Avatar'
import { ShieldIcon } from './Icons'

type Servant = { user_id: string; email: string; display_name: string | null; photo: string | null; joined_at: string; is_admin: boolean }

/** The servants of one class, loaded when shown (needs a connection). */
export function ClassServants({ classId }: { classId: string }) {
  const { t, lang } = useI18n()
  const [list, setList] = useState<Servant[] | null>(null)
  const [error, setError] = useState('')
  const [myId, setMyId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data }) => !cancelled && setMyId(data.session?.user.id ?? null))
    supabase.rpc('class_servants', { p_class: classId }).then(({ data, error }) => {
      if (cancelled) return
      if (error) setError(error.message)
      else setList(data as Servant[])
    })
    return () => {
      cancelled = true
    }
  }, [classId])

  const date = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { dateStyle: 'medium' })

  if (error) return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300" dir="auto">{error}</p>
  if (!list) return <p className="px-1 text-sm text-slate-500">{t('loading')}</p>

  return (
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
      {list.map(s => (
        <li key={s.user_id} className="flex items-center gap-3 px-3 py-2">
          <Avatar photo={s.photo} name={s.display_name || s.email} className="size-9 text-sm" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-semibold">{s.display_name || s.email}</span>
              {s.user_id === myId && <span className="rounded-full bg-slate-100 px-2 text-[10px] font-bold dark:bg-slate-800">{t('you')}</span>}
              {s.is_admin && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-300">
                  <ShieldIcon className="size-3" />
                  {t('admin')}
                </span>
              )}
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
        </li>
      ))}
    </ul>
  )
}
