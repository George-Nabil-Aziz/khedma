import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { useI18n, type TKey } from './lib/i18n'
import { useRoute } from './lib/router'
import { startStore } from './lib/store'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { ChildrenPage } from './pages/ChildrenPage'
import { ChildFormPage } from './pages/ChildFormPage'
import { SyncPage } from './pages/SyncPage'
import { FieldsPage } from './pages/FieldsPage'
import { AttendancePage } from './pages/AttendancePage'
import { AuditPage } from './pages/AuditPage'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // The session is kept in localStorage, so a signed-in servant can open the app offline.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) startStore()
  }, [session])

  if (!ready) return <div className="h-full bg-slate-50 dark:bg-slate-950" />
  if (!session) return <LoginPage />
  // Only for showing the admin pages — the database itself checks the role before returning data.
  const admin = session.user.app_metadata?.role === 'admin'
  return <Routes email={session.user.email ?? ''} admin={admin} />
}

function Routes({ email, admin }: { email: string; admin: boolean }) {
  const { t } = useI18n()
  const route = useRoute()

  const page = (title: TKey, body: ReactNode) => (
    <Layout email={email} admin={admin} title={t(title)}>
      {body}
    </Layout>
  )

  switch (route.name) {
    case 'new':
      return page('addChild', <ChildFormPage clientId={null} />)
    case 'edit':
      return page('editChild', <ChildFormPage clientId={route.id} />)
    case 'attendance':
      return page('attendance', <AttendancePage />)
    case 'fields':
      return page('customize', <FieldsPage />)
    case 'sync':
      return page('sync', <SyncPage />)
    case 'audit':
      return admin ? page('audit', <AuditPage />) : page('children', <ChildrenPage />)
    default:
      return page('children', <ChildrenPage />)
  }
}
