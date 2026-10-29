import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { useI18n, type TKey } from './lib/i18n'
import { useRoute } from './lib/router'
import { useIdleSignOut } from './lib/idle'
import { activeClasses, startStore, useStore } from './lib/store'
import { Layout } from './components/Layout'
import { AccountGate } from './components/AccountGate'
import { LoginPage } from './pages/LoginPage'
import { ChildrenPage } from './pages/ChildrenPage'
import { ChildFormPage } from './pages/ChildFormPage'
import { ChildViewPage } from './pages/ChildViewPage'
import { SyncPage } from './pages/SyncPage'
import { FieldsPage } from './pages/FieldsPage'
import { AttendancePage } from './pages/AttendancePage'
import { AuditPage } from './pages/AuditPage'
import { NoClass, SharePage } from './pages/SharePage'
import { ClassesPage } from './pages/ClassesPage'
import { UsersPage } from './pages/UsersPage'
import { ProfilePage } from './pages/ProfilePage'
import { SettingsPage, SettingsTabs } from './pages/SettingsPage'
import { TripPage, TripsPage } from './pages/TripsPage'

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

  if (!ready) return <div className="h-full" />
  if (!session) return <LoginPage />
  // Only for showing the admin pages — the database itself checks the role before returning data.
  const admin = session.user.app_metadata?.role === 'admin'
  return (
    <AccountGate userId={session.user.id} email={session.user.email ?? ''}>
      <Routes email={session.user.email ?? ''} userId={session.user.id} admin={admin} />
    </AccountGate>
  )
}

function Routes({ email, userId, admin }: { email: string; userId: string; admin: boolean }) {
  const { t } = useI18n()
  const route = useRoute()
  const { classes, lastSyncAt, syncError } = useStore()

  // Mounted only once AccountGate let the account in — then start loading / syncing.
  useEffect(() => {
    startStore(userId)
  }, [userId])
  useIdleSignOut()

  const page = (title: TKey, body: ReactNode) => (
    <Layout email={email} admin={admin} title={t(title)}>
      {body}
    </Layout>
  )

  // الإعدادات: columns, sync and (admins) the service year — three tabs under one bar.
  const settings = (body: ReactNode) =>
    page(
      'settings',
      <>
        <SettingsTabs admin={admin} />
        {body}
      </>,
    )

  // Pages that work without a class; everything else needs one.
  if (route.name === 'share') return page('share', <SharePage />)
  if (route.name === 'sync') return settings(<SyncPage />)
  if (route.name === 'profile') return page('profile', <ProfilePage email={email} admin={admin} />)
  if (admin && route.name === 'users') return page('users', <UsersPage myId={userId} />)
  if (admin && route.name === 'audit') return page('audit', <AuditPage />)
  if (admin && route.name === 'settings') return settings(<SettingsPage />)
  if (route.name === 'classes') return page('classes', <ClassesPage admin={admin} />)
  // No class yet: say so, and offer to create one or join a colleague's with a code.
  if ((lastSyncAt || syncError) && activeClasses(classes).length === 0) return page('classes', <NoClass />)

  switch (route.name) {
    case 'new':
      return page('addChild', <ChildFormPage clientId={null} />)
    case 'child':
      return page('children', <ChildViewPage clientId={route.id} />)
    case 'edit':
      return page('editChild', <ChildFormPage clientId={route.id} />)
    case 'attendance':
      return page('attendance', <AttendancePage />)
    case 'trips':
      return page('trips', <TripsPage />)
    case 'trip':
      return page('trips', <TripPage id={route.id} />)
    case 'fields':
      return settings(<FieldsPage admin={admin} />)
    default:
      return page('children', <ChildrenPage />)
  }
}
