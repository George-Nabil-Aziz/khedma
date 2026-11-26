import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { useI18n, type TKey } from './lib/i18n'
import { useRoute } from './lib/router'
import { useIdleSignOut } from './lib/idle'
import { keepPushOn } from './lib/push'
import { activeClasses, getState, startStore, useStore } from './lib/store'
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
import { HelpPage, InstallPage, SettingsPage, SettingsTabs } from './pages/SettingsPage'
import { TripPage, TripsPage } from './pages/TripsPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { DaysPage } from './pages/DaysPage'
import { MassNamesPage, MassPage, MassesPage } from './pages/MassPage'
import { MassSharePage } from './pages/MassSharePage'
import { refreshMassAccess, useMassAccess } from './lib/mass'
import { ExportPage } from './pages/ExportPage'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // The session is kept in localStorage, so a signed-in servant can open the app offline.
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) toChildren()
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_OUT') {
        toChildren()
        // Signed out by Supabase itself (the sign-in could not be renewed), not by our own sign-out,
        // which empties the store first: start afresh. Unsent changes stay for the same account.
        if (getState().loaded) location.reload()
      }
      setSession(s)
    })
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

// A refresh stays on the same page; signing in again starts on الأولاد.
function toChildren() {
  history.replaceState(null, '', location.pathname + location.search)
}

function Routes({ email, userId, admin }: { email: string; userId: string; admin: boolean }) {
  const { t, lang } = useI18n()
  const route = useRoute()
  const { classes, lastSyncAt, syncError } = useStore()
  // القداس: admins, and members who joined with a code (hidden until the server says so)
  const massAccess = useMassAccess()
  const mass = admin || massAccess

  // Mounted only once AccountGate let the account in — then start loading / syncing.
  useEffect(() => {
    startStore(userId)
    keepPushOn(lang)
    refreshMassAccess()
  }, [userId])
  // opened after 30 days idle: straight to signing in, never the app first and then out on a tap
  if (useIdleSignOut()) return <div className="h-full" />

  const page = (title: TKey, body: ReactNode) => (
    <Layout email={email} admin={admin} mass={mass} title={t(title)}>
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
  if (route.name === 'install') return settings(<InstallPage />)
  if (route.name === 'help') return settings(<HelpPage admin={admin} />)
  if (route.name === 'notifications') return settings(<NotificationsPage admin={admin} />)
  if (route.name === 'profile') return page('profile', <ProfilePage email={email} admin={admin} />)
  if (admin && route.name === 'users') return page('users', <UsersPage myId={userId} />)
  if (admin && route.name === 'audit') return page('audit', <AuditPage />)
  if (mass && route.name === 'mass-share') return page('mass', <MassSharePage admin={admin} />)
  if (mass && route.name === 'masses') return page('mass', <MassesPage />)
  if (mass && route.name === 'mass-names') return page('mass', <MassNamesPage />)
  if (mass && route.name === 'mass') return page('mass', <MassPage id={route.id} />)
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
    case 'export':
      return page('export', <ExportPage />)
    case 'trip':
      return page('trips', <TripPage id={route.id} />)
    case 'days':
      return settings(<DaysPage />)
    case 'fields':
      // الأعمدة: admins only
      return admin ? settings(<FieldsPage />) : page('children', <ChildrenPage />)
    default:
      return page('children', <ChildrenPage />)
  }
}
