import { useSyncExternalStore } from 'react'
import { supabase } from './supabase'

/*
 * القداس (admins only): the services of a children's mass, who serves each one (a class of
 * servants + one of its children) and the names to pick from. Needs a connection — every change
 * goes straight to Supabase.
 */

// ---- the services (a constant: the DB only keeps who serves what, by key) ---------------------

export type MassItem = {
  key: string
  label: string
  /** two lines (two servant + child pairs) */
  double?: boolean
  /** a name per line of a two-line service (empty = just the number) */
  slotLabels?: string[]
}
export type MassGroup = { key: string; title: string; items: MassItem[] }

export const MASS_GROUPS: MassGroup[] = [
  {
    key: 'hold_lamb',
    title: 'هنمسك ايه : تقديم الحمل',
    items: [
      { key: 'qarura', label: 'القارورة' },
      { key: 'water_jug', label: 'ابريق المياه' },
    ],
  },
  {
    key: 'responses_1',
    title: 'المردات',
    items: [
      { key: 'pray_offerings', label: 'صلوا من أجل هذه القرابين' },
      { key: 'amen_rushumat', label: 'أمين و الرشومات' },
      { key: 'aspatir', label: 'اسباتير' },
      { key: 'ai_ebros_1', label: 'ايه يى ابروس ايفشى 1' },
      { key: 'pros_afxasti', label: 'بروس افكساستى' },
      { key: 'ask_mercy', label: 'اطلبوا لكى يرحمنا الله' },
    ],
  },
  {
    key: 'readings',
    title: 'القراءات',
    items: [
      { key: 'bolos', label: 'قرأة البولس' },
      { key: 'bolos_round', label: 'دورة البولس', double: true, slotLabels: ['الصليب', 'البشارة'] },
      { key: 'catholicon', label: 'الكاثوليكون' },
      { key: 'abraksis', label: 'الابركسيس' },
      { key: 'abraksis_round', label: 'دورة الابركسيس', double: true, slotLabels: ['الصليب', 'البشارة'] },
      { key: 'gospel_prayer', label: 'اوشية الأنجيل' },
      { key: 'gospel', label: 'الأنجيل' },
      { key: 'ensofia', label: 'انصوفيا' },
    ],
  },
  {
    key: 'responses_2',
    title: 'باقى المردات',
    items: [
      { key: 'ai_ebros_2', label: 'ايه يى ابروس ايفشى 2' },
      { key: 'pray_peace', label: 'صلوا من أجل السلام الكامل' },
      { key: 'kiss', label: 'قبلوا بعضكم بعضا' },
      { key: 'sit_stand', label: 'ايها الجلوس قفوا' },
      { key: 'look_east', label: 'و الى الشرق انظروا' },
      { key: 'listen', label: 'ننصت' },
    ],
  },
  {
    key: 'incense',
    title: 'الشورية',
    items: [
      { key: 'incense_incarnation', label: 'تقديم الشريا وتجسد و تأنس' },
      { key: 'incense_foundation', label: 'تقديم الشريا فى صلوات التأسيس' },
    ],
  },
  {
    key: 'responses_3',
    title: 'باقى المردات',
    items: [
      { key: 'bow_to_god', label: 'اسجدوا لله بخوف' },
      { key: 'listen_amen', label: 'ننصت أمين' },
      { key: 'offerings_prayer', label: 'اوشية القرابين' },
    ],
  },
  {
    key: 'hold_readers',
    title: 'هنمسك ايه: فى القارئون',
    items: [{ key: 'incense_tray', label: 'يمسك درج البخور فى القارئون' }],
  },
  {
    key: 'responses_4',
    title: 'باقى المردات',
    items: [
      { key: 'readers', label: 'القارئون' },
      { key: 'amen_amen', label: 'أمين أمين صلوا' },
      { key: 'taski_falas', label: 'طاسكي فالاس' },
      { key: 'abros_khomin', label: 'أبروس خومين' },
      { key: 'truly_done', label: 'خلصت حقا' },
      { key: 'confession', label: 'الاعتراف' },
    ],
  },
]

// ---- Coptic date ------------------------------------------------------------------------------

export const COPTIC_MONTHS = ['توت', 'بابه', 'هاتور', 'كيهك', 'طوبة', 'أمشير', 'برمهات', 'برمودة', 'بشنس', 'بؤونة', 'أبيب', 'مسرى', 'نسئ']

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0

/** "2026-12-04" → "25 هاتور 1743" (the Coptic year is the Gregorian one − 283 from 1 توت on, − 284 before it). 1 توت is 11 September, or 12 September when the next Gregorian year is a leap year. */
export function copticDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const day = Date.UTC(y, m - 1, d)
  const newYear = (year: number) => Date.UTC(year, 8, isLeap(year + 1) ? 12 : 11)
  const afterNewYear = day >= newYear(y)
  const start = afterNewYear ? newYear(y) : newYear(y - 1)
  const n = Math.round((day - start) / 86400000)
  return `${(n % 30) + 1} ${COPTIC_MONTHS[Math.floor(n / 30)]} ${afterNewYear ? y - 283 : y - 284}`
}

// ---- data -------------------------------------------------------------------------------------

export type MassClass = { id: string; name: string; position: number | null }
export type MassChild = { id: string; class_id: string; name: string; phone: string | null; note: string | null; position: number | null }
export type Mass = { id: string; mass_date: string; notes: string | null }
export type MassAssignment = { mass_id: string; service_key: string; slot: number; class_id: string | null; child_id: string | null }

/**
 * The schedule as shown: the built-in MASS_GROUPS (the source of truth for keys and how many
 * lines a service has) with what the admins edited (037) laid over it — group titles, service names,
 * the labels of two-line services, and the order of the groups and of the services in a group.
 */
type State = {
  masses: Mass[]
  classes: MassClass[]
  children: MassChild[]
  loaded: boolean
  error: string | null
  groups: MassGroup[]
  /** false until the 037 tables were read: then the built-in names are shown and renaming is off */
  servicesReady: boolean
}

const EMPTY: State = { masses: [], classes: [], children: [], loaded: false, error: null, groups: MASS_GROUPS, servicesReady: false }

let state: State = EMPTY
const listeners = new Set<() => void>()

function set(patch: Partial<State>) {
  state = { ...state, ...patch }
  listeners.forEach(l => l())
}

export function useMass() {
  return useSyncExternalStore(
    l => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

const byPosition = <T extends { position: number | null }>(a: T, b: T) => (a.position ?? 1e9) - (b.position ?? 1e9)

export async function loadMass() {
  if (!navigator.onLine) return set({ loaded: true })
  const [masses, classes, children] = await Promise.all([
    supabase.from('masses').select('id,mass_date,notes').order('mass_date', { ascending: false }),
    supabase.from('mass_classes').select('id,name,position'),
    supabase.from('mass_children').select('id,class_id,name,phone,note,position'),
  ])
  const error = masses.error ?? classes.error ?? children.error
  if (error) return set({ loaded: true, error: error.message })
  // the 037 names: missing tables or any failure → the built-in names, silently
  const [g, sv] = await Promise.all([supabase.from('mass_service_groups').select('key,title,position'), supabase.from('mass_services').select('key,name,slot_labels,position')])
  const ready = !g.error && !sv.error
  set({
    groups: ready ? mergeNames(g.data as GroupRow[], sv.data as ServiceRow[]) : MASS_GROUPS,
    servicesReady: ready,
    loaded: true,
    error: null,
    masses: masses.data as Mass[],
    classes: (classes.data as MassClass[]).sort(byPosition),
    children: (children.data as MassChild[]).sort(byPosition),
  })
}

type GroupRow = { key: string; title: string; position: number }
type ServiceRow = { key: string; name: string; slot_labels: string[] | null; position: number }

function mergeNames(gs: GroupRow[], ss: ServiceRow[]): MassGroup[] {
  const grow = new Map(gs.map(g => [g.key, g]))
  const svc = new Map(ss.map(s => [s.key, s]))
  // the saved order (037); a key the DB doesn't have yet keeps its place from the built-in list
  const gpos = (g: MassGroup, i: number) => grow.get(g.key)?.position ?? i + 1
  return MASS_GROUPS.map((g, gi) => ({
    ...g,
    title: grow.get(g.key)?.title.trim() || g.title,
    items: g.items
      .map((it, ii) => {
        const row = svc.get(it.key)
        const item = row ? { ...it, label: row.name.trim() || it.label, slotLabels: it.double ? (row.slot_labels ?? it.slotLabels) : undefined } : it
        return { item, pos: row?.position ?? ii + 1 }
      })
      .sort((x, y) => x.pos - y.pos)
      .map(x => x.item),
    pos: gpos(g, gi),
  }))
    .sort((x, y) => x.pos - y.pos)
    .map(({ pos: _pos, ...g }) => g)
}

/** الخدمات: save a new order — the groups, and the services inside each (they stay in their group). */
export async function saveServiceOrder(groupKeys: string[], itemKeys: Record<string, string[]>): Promise<string | null> {
  const current = state.groups
  const groupRows = groupKeys.map((key, i) => ({ key, title: current.find(g => g.key === key)!.title, position: i + 1 }))
  const serviceRows = groupKeys.flatMap(gk => {
    const g = current.find(x => x.key === gk)!
    return itemKeys[gk].map((key, i) => {
      const it = g.items.find(x => x.key === key)!
      return { key, group_key: gk, name: it.label, slots: it.double ? 2 : 1, slot_labels: it.double ? (it.slotLabels ?? ['', '']) : null, position: i + 1 }
    })
  })
  const g1 = await supabase.from('mass_service_groups').upsert(groupRows, { onConflict: 'key' })
  if (g1.error) return g1.error.message
  const g2 = await supabase.from('mass_services').upsert(serviceRows, { onConflict: 'key' })
  if (g2.error) return g2.error.message
  await loadMass()
  return null
}

/** الخدمات: rename a group (037). Returns the error text, or null. */
export async function renameGroup(key: string, title: string): Promise<string | null> {
  const position = state.groups.findIndex(g => g.key === key) + 1 // the place it has now
  return write(() => supabase.from('mass_service_groups').upsert({ key, title: title.trim(), position }, { onConflict: 'key' }))
}

/** الخدمات: rename a service and (two-line ones) its line labels, '' = just the number. */
export async function renameService(key: string, name: string, slotLabels: string[]): Promise<string | null> {
  const g = state.groups.find(x => x.items.some(i => i.key === key))!
  const it = g.items.find(i => i.key === key)!
  const slots = it.double ? 2 : 1
  const row = { key, group_key: g.key, name: name.trim(), slots, slot_labels: it.double ? slotLabels.slice(0, 2).map(l => l.trim()) : null, position: g.items.indexOf(it) + 1 }
  return write(() => supabase.from('mass_services').upsert(row, { onConflict: 'key' }))
}

/** Runs a write, then pulls everything again. Returns the error text, or null. */
async function write(run: () => PromiseLike<{ error: { message: string } | null }>): Promise<string | null> {
  const { error } = await run()
  if (error) return error.message
  await loadMass()
  return null
}

export async function createMass(date: string): Promise<{ id: string } | { error: string }> {
  const { data, error } = await supabase.from('masses').insert({ mass_date: date }).select('id').single()
  if (error) return { error: error.code === '23505' ? 'duplicate' : error.message }
  await loadMass()
  return { id: data.id as string }
}

export const deleteMass = (id: string) => write(() => supabase.from('masses').delete().eq('id', id))

export async function loadAssignments(massId: string): Promise<MassAssignment[] | string> {
  const { data, error } = await supabase.from('mass_assignments').select('mass_id,service_key,slot,class_id,child_id').eq('mass_id', massId)
  return error ? error.message : (data as MassAssignment[])
}

/** One line of the schedule: its class and child (either may be null). Saved at once. */
export async function saveAssignment(a: MassAssignment): Promise<string | null> {
  const { error } = await supabase.from('mass_assignments').upsert(a, { onConflict: 'mass_id,service_key,slot' })
  return error ? error.message : null
}

const clean = (s: string | null | undefined) => s?.trim() || null

export async function saveClass(id: string | null, name: string): Promise<string | null> {
  const n = name.trim()
  if (id) return write(() => supabase.from('mass_classes').update({ name: n }).eq('id', id))
  const position = Math.max(0, ...state.classes.map(c => c.position ?? 0)) + 1
  return write(() => supabase.from('mass_classes').insert({ name: n, position }))
}

export const deleteClass = (id: string) => write(() => supabase.from('mass_classes').delete().eq('id', id))

export type ChildInput = { name: string; phone: string | null; note: string | null }

export async function saveChild(id: string | null, classId: string, d: ChildInput): Promise<string | null> {
  const row = { name: d.name.trim(), phone: clean(d.phone), note: clean(d.note) }
  if (id) return write(() => supabase.from('mass_children').update({ ...row, class_id: classId }).eq('id', id))
  const position = Math.max(0, ...state.children.filter(c => c.class_id === classId).map(c => c.position ?? 0)) + 1
  return write(() => supabase.from('mass_children').insert({ ...row, class_id: classId, position }))
}

export const deleteChild = (id: string) => write(() => supabase.from('mass_children').delete().eq('id', id))

// ---- who may use القداس: admins and members who joined with a code ------------------------------

let access = false
const accessListeners = new Set<() => void>()

/** True for an admin or a mass member. Hidden (false) until the server says so — and offline. */
export function useMassAccess() {
  return useSyncExternalStore(
    l => {
      accessListeners.add(l)
      return () => accessListeners.delete(l)
    },
    () => access,
  )
}

/** Signing out: the next account starts hidden again. */
export function resetMassAccess() {
  access = false
  state = EMPTY
  accessListeners.forEach(l => l())
  listeners.forEach(l => l())
}

/** Asks the server once (the sidebar item and the routes follow it). */
export async function refreshMassAccess() {
  if (!navigator.onLine) return
  const { data, error } = await supabase.rpc('is_mass_member')
  if (error) return // 036 not run yet, or no connection: stays as it was
  access = data === true
  accessListeners.forEach(l => l())
}

/** A one-time 6-digit code, valid 15 minutes, that gives a colleague the whole section. */
export async function createMassInvite(): Promise<{ ok: true; value: { code: string; expires_at: string } } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc('create_mass_invite')
  if (error) return { ok: false, error: error.message }
  return { ok: true, value: (data as { code: string; expires_at: string }[])[0] }
}

export type MassMember = { user_id: string; email: string; display_name: string | null; joined_at: string }

export async function listMassMembers(): Promise<MassMember[] | string> {
  const { data, error } = await supabase.rpc('admin_list_mass_members')
  return error ? error.message : (data as MassMember[])
}

export async function removeMassMember(userId: string): Promise<string | null> {
  const { error } = await supabase.rpc('remove_mass_member', { p_user: userId })
  return error ? error.message : null
}

/** A member leaves the section (admins have no membership to leave). */
export async function leaveMass(): Promise<string | null> {
  const { error } = await supabase.rpc('leave_mass')
  if (error) return error.message
  await refreshMassAccess()
  return null
}
