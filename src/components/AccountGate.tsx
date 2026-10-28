import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useI18n } from '../lib/i18n'
import { load, save } from '../lib/storage'
import { resetStore } from '../lib/store'
import { HeaderButtons } from './Layout'

/**
 * Sign-in accounts are shared with other apps in this Supabase project. Only accounts on
 * Khedma's own list (khedma_2027.app_users) may use the app; anyone else sees a message.
 * The answer is remembered per account so the app still opens offline.
 */
export function AccountGate({ userId, email, children }: { userId: string; email: string; children: ReactNode }) {
  const { t } = useI18n()
  const key = `appUser:${userId}`
  const [allowed, setAllowed] = useState<boolean | null>(() => (load(key) === '1' ? true : null))

  useEffect(() => {
    let cancelled = false
    supabase.rpc('is_app_user').then(({ data, error }) => {
      if (cancelled) return
      // Offline (or the check is not set up): keep the last answer, or let them in — the
      // database rules still hide every class they are not a member of.
      if (error) return setAllowed(a => a ?? true)
      setAllowed(data === true)
      save(key, data === true ? '1' : '0')
    })
    return () => {
      cancelled = true
    }
  }, [key])

  if (allowed) return <>{children}</>
  if (allowed === null) return <div className="h-full" />

  async function signOut() {
    await resetStore()
    await supabase.auth.signOut()
  }

  return (
    <div className="flex h-full flex-col text-slate-900 dark:text-slate-100">
      <div className="flex justify-end gap-2 p-4">
        <HeaderButtons />
      </div>
      <div className="grid flex-1 place-items-center px-4 pb-8">
        <div className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="mx-auto size-16 drop-shadow" />
          <h1 className="text-lg font-bold">{t('notAppUserTitle')}</h1>
          <p className="text-sm text-slate-500">{t('notAppUserHelp')}</p>
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold dark:bg-slate-800" dir="ltr">
            {email}
          </p>
          <button onClick={signOut} className="w-full rounded-lg bg-indigo-600 py-2 font-semibold text-white hover:bg-indigo-700">
            {t('signOut')}
          </button>
        </div>
      </div>
    </div>
  )
}
