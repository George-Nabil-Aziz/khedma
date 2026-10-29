import { useEffect } from 'react'
import { supabase } from './supabase'
import { load, save } from './storage'
import { getState, resetStore, sync, useStore } from './store'

/*
 * Sign out after 3 hours with no activity. The last activity time sits in localStorage, so it is
 * shared by every open tab and still counts when the app was closed: opening it the next day
 * signs out straight away.
 * Changes not sent yet would be wiped by signing out, so in that case it tries to send them
 * first, and waits (checking again later) while they still can't go — e.g. offline.
 */

const LIMIT = 3 * 60 * 60 * 1000
const LAST_ACTIVE = 'lastActive' // cleared by resetStore()
const EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const

const lastActive = () => Number(load(LAST_ACTIVE)) || 0
const expired = () => Date.now() - lastActive() >= LIMIT

let lastWrite = 0
function touch() {
  // the first click after the 3 hours must not count as activity — it signs out instead
  if (expired()) return void check()
  const now = Date.now()
  if (now - lastWrite < 30_000) return // one write per 30 s is plenty
  lastWrite = now
  save(LAST_ACTIVE, String(now))
}

let signingOut = false
async function check() {
  if (signingOut || !expired()) return
  signingOut = true
  try {
    await sync()
    const s = getState()
    if (s.outbox.length || s.attOutbox.length || s.dayOutbox.length) return
    await supabase.rpc('log_event', { p_action: 'logout' }).then(
      () => {},
      () => {},
    )
    await resetStore()
    await supabase.auth.signOut()
  } finally {
    signingOut = false
  }
}

/** Mounted while signed in. Starts counting once the local data is loaded (it holds the unsent changes). */
export function useIdleSignOut() {
  const { loaded } = useStore()

  useEffect(() => {
    if (!loaded) return
    if (!lastActive()) save(LAST_ACTIVE, String(Date.now())) // just signed in
    check()
    const onVisible = () => document.visibilityState === 'visible' && check()
    EVENTS.forEach(e => window.addEventListener(e, touch, { passive: true }))
    document.addEventListener('visibilitychange', onVisible)
    const timer = setInterval(check, 60_000)
    return () => {
      EVENTS.forEach(e => window.removeEventListener(e, touch))
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(timer)
    }
  }, [loaded])
}
