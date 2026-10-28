import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { ChildrenPage } from './pages/ChildrenPage'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!ready) return <div className="h-full bg-slate-50 dark:bg-slate-950" />
  if (!session) return <LoginPage />

  return (
    <Layout email={session.user.email ?? ''}>
      <ChildrenPage />
    </Layout>
  )
}
