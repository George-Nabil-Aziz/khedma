import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useI18n } from '../lib/i18n'
import { useStore } from '../lib/store'
import { ShieldIcon } from './Icons'

/** Shown only while nobody is admin yet: the first person to press it becomes the admin. */
export function FirstAdminBanner() {
  const { t } = useI18n()
  const { online } = useStore()
  const [noAdmin, setNoAdmin] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!online) return
    supabase.rpc('has_admin').then(({ data, error }) => {
      if (!error) setNoAdmin(data === false)
    })
  }, [online])

  async function claim() {
    setBusy(true)
    setError('')
    const { data, error } = await supabase.rpc('claim_first_admin')
    if (error) setError(error.message)
    else if (data === true) {
      // The role lives in the sign-in token, so fetch a fresh one — the admin pages then appear.
      await supabase.auth.refreshSession()
      setNoAdmin(false)
    } else setNoAdmin(false) // someone else was faster
    setBusy(false)
  }

  if (!noAdmin) return null

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-100">
      <ShieldIcon className="size-5 shrink-0" />
      <span className="flex-1">{t('noAdminYet')}</span>
      <button onClick={claim} disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-1.5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
        {t('makeMeAdmin')}
      </button>
      {error && (
        <p className="w-full text-red-700 dark:text-red-300" dir="auto">
          {error}
        </p>
      )}
    </div>
  )
}
