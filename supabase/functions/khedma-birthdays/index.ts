// Supabase Edge Function: khedma-birthdays
// Sends the birthday reminders each servant picked (الإعدادات → التنبيهات) as push notifications.
//   - pg_cron calls it every hour (027_birthday_cron.sql) with the x-cron-secret header.
//   - The app calls it signed in for { action: 'key' } (the public key, to turn notifications on)
//     and { action: 'test' } (a test notification to my own devices).
//
// Deploy: Supabase Dashboard → Edge Functions → Deploy a new function → Via Editor,
// name it exactly "khedma-birthdays", paste this file, Deploy. Then in its Details turn OFF
// "Verify JWT" (pg_cron has no user token; the function checks the caller itself).
// Secrets (Edge Functions → Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, CRON_SECRET.

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

type When = 'friday_before' | 'week_before' | 'two_days_before' | 'day_before' | 'same_day'
type Reminder = { when: When; time: string }
type Sub = { endpoint: string; user_id: string; p256dh: string; auth: string }
type Kid = { client_id: string; full_name: string; birth_date: string; class_id: string }

// minutes after the chosen time a reminder may still go out: the hourly run that falls inside,
// and the next one too if that run failed (notification_log stops it going out twice)
const WINDOW = 90

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
  db: { schema: 'khedma' },
})

webpush.setVapidDetails('mailto:george.nabil.biy@gmail.com', Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!)

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const secret = Deno.env.get('CRON_SECRET')
  if (secret && req.headers.get('x-cron-secret') === secret) return json(await run())

  // otherwise: a signed-in servant
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const { data: caller } = await db.auth.getUser(token)
  if (!caller.user) return json({ error: 'Not signed in' }, 401)

  const body = await req.json().catch(() => ({}))
  if (body.action === 'key') return json({ key: Deno.env.get('VAPID_PUBLIC_KEY') })
  if (body.action === 'test') {
    const { data } = await db.from('push_subscriptions').select('*').eq('user_id', caller.user.id)
    const subs = (data ?? []) as Sub[]
    const ar = body.lang !== 'en'
    const payload = { title: ar ? '🎂 تجربة' : '🎂 Test', body: ar ? 'التنبيهات شغالة على الجهاز ده' : 'Notifications work on this device', url: '#/' }
    const sent = await Promise.all(subs.map(s => push(s, payload)))
    return json({ devices: subs.length, sent: sent.filter(Boolean).length })
  }
  return json({ error: 'Bad request' }, 400)
})

/** Sends every reminder that is due now. */
async function run() {
  const now = cairoNow()

  const [{ data: settings }, { data: subsData }] = await Promise.all([
    db.from('notification_settings').select('user_id,reminders,lang'),
    db.from('push_subscriptions').select('*'),
  ])
  const subsOf = new Map<string, Sub[]>()
  for (const s of (subsData ?? []) as Sub[]) subsOf.set(s.user_id, [...(subsOf.get(s.user_id) ?? []), s])

  // who has something due right now, and for which birthdays
  type Due = { user: string; lang: string; reminder: When; day: string; birthdays: string[] }
  const due: Due[] = []
  for (const s of settings ?? []) {
    if (!subsOf.has(s.user_id)) continue
    for (const r of (s.reminders ?? []) as Reminder[]) {
      const day = dueDay(r, now)
      if (day) due.push({ user: s.user_id, lang: s.lang, reminder: r.when, day, birthdays: targets(r.when, day) })
    }
  }
  if (!due.length) return { sent: 0 }

  // the children of the classes these servants are in (not the ones who left the class)
  const users = [...new Set(due.map(d => d.user))]
  const { data: members } = await db.from('class_members').select('class_id,user_id').in('user_id', users).is('left_at', null)
  const classesOf = new Map<string, Set<string>>()
  for (const m of members ?? []) classesOf.set(m.user_id, (classesOf.get(m.user_id) ?? new Set()).add(m.class_id))
  const classIds = [...new Set((members ?? []).map(m => m.class_id))]
  if (!classIds.length) return { sent: 0 }
  const { data: kidsData } = await db
    .from('children')
    .select('client_id,full_name,birth_date,class_id')
    .in('class_id', classIds)
    .is('moved_out_on', null)
    .not('birth_date', 'is', null)
  const kids = (kidsData ?? []) as Kid[]

  let sent = 0
  for (const d of due) {
    const mine = classesOf.get(d.user)
    const matches = kids
      .filter(k => mine?.has(k.class_id))
      .flatMap(k => {
        const birthday = d.birthdays.find(b => sameBirthday(k.birth_date, b))
        return birthday ? [{ kid: k, birthday }] : []
      })
    if (!matches.length) continue

    // remember what goes out first, so a slow or repeated run never sends it twice
    const { data: fresh } = await db
      .from('notification_log')
      .upsert(
        matches.map(m => ({ user_id: d.user, child_client_id: m.kid.client_id, reminder: d.reminder, birthday: m.birthday })),
        { onConflict: 'user_id,child_client_id,reminder,birthday', ignoreDuplicates: true },
      )
      .select('child_client_id')
    const freshIds = new Set((fresh ?? []).map(f => f.child_client_id))
    const toSend = matches.filter(m => freshIds.has(m.kid.client_id))
    if (!toSend.length) continue

    const payload = message(toSend, d.day, d.lang)
    for (const s of subsOf.get(d.user) ?? []) if (await push(s, payload)) sent++
  }
  return { sent }
}

/** The notification's words: one child, or all of them in one notification. */
function message(list: { kid: Kid; birthday: string }[], today: string, lang: string) {
  const ar = lang !== 'en'
  const first = list[0]
  const when = (b: string) => {
    const days = daysBetween(today, b)
    if (days === 0) return ar ? 'النهارده' : 'today'
    if (days === 1) return ar ? 'بكرة' : 'tomorrow'
    const name = new Intl.DateTimeFormat(ar ? 'ar-EG-u-nu-latn' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(b + 'T00:00Z'))
    return ar ? `يوم ${name}` : `on ${name}`
  }
  const age = (k: Kid, b: string) => Number(b.slice(0, 4)) - Number(k.birth_date.slice(0, 4))
  const line = (m: { kid: Kid; birthday: string }) =>
    ar ? `${m.kid.full_name} — ${when(m.birthday)} (${age(m.kid, m.birthday)} سنة)` : `${m.kid.full_name} — ${when(m.birthday)} (turns ${age(m.kid, m.birthday)})`
  if (list.length === 1)
    return {
      title: ar ? `🎂 عيد ميلاد ${first.kid.full_name}` : `🎂 ${first.kid.full_name}'s birthday`,
      body: line(first),
      url: `#/child/${first.kid.client_id}`,
      tag: `bd-${first.kid.client_id}-${first.birthday}`,
    }
  return {
    title: ar ? `🎂 ${list.length} أعياد ميلاد` : `🎂 ${list.length} birthdays`,
    body: list.map(line).join('\n'),
    url: '#/',
    tag: `bd-${today}-${list.length}`,
  }
}

/** Sends one notification; a device that unsubscribed or is gone is dropped from the list. */
async function push(s: Sub, payload: Record<string, string>) {
  try {
    await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 6 * 60 * 60 })
    return true
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode
    if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
    else console.error('push failed', code, (e as Error).message)
    return false
  }
}

// ---- dates (all in Cairo time) -------------------------------------------------

/** Now in Cairo as { day: 'YYYY-MM-DD', minutes since midnight }. */
function cairoNow() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date())
      .map(x => [x.type, x.value]),
  )
  return { day: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) }
}

const addDays = (day: string, n: number) => {
  const d = new Date(day + 'T00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00Z') - Date.parse(a + 'T00:00Z')) / 86_400_000)
const weekday = (day: string) => new Date(day + 'T00:00Z').getUTCDay() // 5 = Friday

/**
 * The day whose reminder is due now, if any: today when its time passed less than WINDOW minutes
 * ago — or yesterday, for a late-evening time whose window runs past midnight.
 */
function dueDay(r: Reminder, now: { day: string; minutes: number }): string | null {
  const [h, m] = r.time.split(':').map(Number)
  const at = h * 60 + m
  if (isNaN(at)) return null
  if (now.minutes >= at && now.minutes < at + WINDOW) return now.day
  if (now.minutes + 24 * 60 < at + WINDOW) return addDays(now.day, -1)
  return null
}

/** The birthdays a reminder sent on `day` is about. */
function targets(when: When, day: string): string[] {
  switch (when) {
    case 'same_day':
      return [day]
    case 'day_before':
      return [addDays(day, 1)]
    case 'two_days_before':
      return [addDays(day, 2)]
    case 'week_before':
      return [addDays(day, 7)]
    case 'friday_before':
      // on a Friday: every birthday from tomorrow to next Friday (a Friday birthday gets the Friday a week before)
      return weekday(day) === 5 ? [1, 2, 3, 4, 5, 6, 7].map(n => addDays(day, n)) : []
  }
}

/** Born on the same month and day as `day`. 29 February counts as 28 February in other years. */
function sameBirthday(birthDate: string, day: string) {
  const md = birthDate.slice(5, 10)
  if (!/^\d{2}-\d{2}$/.test(md)) return false
  const y = Number(day.slice(0, 4))
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
  return (md === '02-29' && !leap ? '02-28' : md) === day.slice(5, 10)
}
