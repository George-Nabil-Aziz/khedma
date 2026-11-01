import { supabase } from './supabase'

/*
 * Birthday notifications on this device. The browser gives a "subscription" (where to send to);
 * it is saved in push_subscriptions, and the khedma-birthdays Edge Function sends the reminders
 * picked in الإعدادات → التنبيهات (notification_settings) to every device of mine.
 * iPhone: only inside the installed app (iOS 16.4+), not in Safari itself.
 */

const FN = 'khedma-birthdays'

export type When = 'friday_before' | 'week_before' | 'two_days_before' | 'day_before' | 'same_day'
export type Reminder = { when: When; time: string }

export const WHENS: When[] = ['friday_before', 'week_before', 'two_days_before', 'day_before', 'same_day']

/** What a servant gets until they change it: the Friday before, the night before, the morning of. */
export const DEFAULT_REMINDERS: Reminder[] = [
  { when: 'friday_before', time: '10:00' },
  { when: 'day_before', time: '21:00' },
  { when: 'same_day', time: '08:00' },
]

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

/** The app's service worker — none while developing locally (npm run dev), hence the time limit. */
async function worker(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>(r => setTimeout(() => r(null), 4000))])
}

export async function currentSubscription() {
  const reg = await worker()
  return reg ? reg.pushManager.getSubscription() : null
}

const b64ToBytes = (b64: string) => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(s, c => c.charCodeAt(0))
}

async function saveSubscription(sub: PushSubscription) {
  const j = sub.toJSON()
  const { data } = await supabase.auth.getSession()
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ endpoint: sub.endpoint, user_id: data.session?.user.id, p256dh: j.keys?.p256dh, auth: j.keys?.auth }, { onConflict: 'endpoint' })
  return error?.message ?? null
}

/** Turns notifications on here. Returns an error key / message, or null when done. */
export async function enablePush(): Promise<'denied' | 'noWorker' | string | null> {
  if ((await Notification.requestPermission()) !== 'granted') return 'denied'
  const reg = await worker()
  if (!reg) return 'noWorker'
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    const { data, error } = await supabase.functions.invoke(FN, { body: { action: 'key' } })
    if (error || !data?.key) return error?.message ?? 'No key'
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(data.key) })
  }
  return saveSubscription(sub)
}

/** Stops notifications on this device (used on sign-out too, so the next person doesn't get mine). */
export async function disablePush() {
  const sub = await currentSubscription().catch(() => null)
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint).then(
    () => {},
    () => {},
  )
  await sub.unsubscribe().catch(() => {})
}

/** A test notification to all my devices. */
export async function testPush(lang: string) {
  const { data, error } = await supabase.functions.invoke(FN, { body: { action: 'test', lang } })
  return error ? { error: error.message } : (data as { devices: number; sent: number })
}

export async function loadReminders(): Promise<Reminder[] | null> {
  const { data: s } = await supabase.auth.getSession()
  const { data, error } = await supabase.from('notification_settings').select('reminders').eq('user_id', s.session?.user.id ?? '').maybeSingle()
  if (error) throw new Error(error.message)
  return (data?.reminders as Reminder[] | undefined) ?? null
}

export async function saveReminders(reminders: Reminder[], lang: string) {
  const { data } = await supabase.auth.getSession()
  const { error } = await supabase.from('notification_settings').upsert({ user_id: data.session?.user.id, reminders, lang }, { onConflict: 'user_id' })
  return error?.message ?? null
}
