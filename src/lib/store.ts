import { useSyncExternalStore } from 'react'
import { clear, get, setMany } from 'idb-keyval'
import { CORE_FIELDS, TEXT_FIELDS, supabase, type Child, type ChildInput, type ClassInfo, type CustomField, type FieldType, type Profile } from './supabase'
import { load, save } from './storage'
import { iso, setYearEndWeeks } from './serviceYear'
import { resetTrips } from './trips'

/*
 * Offline-first store.
 * - `rows` is the last copy pulled from Supabase, kept in IndexedDB so the list works offline.
 * - Every add/edit goes into `outbox` first, then sync() pushes it when the device is online.
 * - An edit carries the row as it was when the edit started (`base`). If someone else changed
 *   the same field on the server meanwhile, the edit moves to `conflicts` for the user to decide.
 * - Edits are compared field by field on a "flat" view of the child: built-in columns by name,
 *   custom columns as "x:<key>" (they live inside the `extra` jsonb column).
 */

export type Flat = Record<string, unknown>

export type InsertOp = { kind: 'insert'; client_id: string; class_id: string; data: ChildInput; queued_at: string; error?: string }
export type UpdateOp = { kind: 'update'; client_id: string; base: Child; changes: Flat; queued_at: string; error?: string }
export type Op = InsertOp | UpdateOp

export type Conflict = {
  client_id: string
  base: Child
  changes: Flat
  server: Child | null // null = deleted on the server
  fields: string[]
}

type State = {
  rows: Child[]
  fields: CustomField[]
  classes: ClassInfo[]
  /** My name and photo (shown in the sidebar). */
  profile: Profile | null
  /** The class shown on screen (chosen per device). */
  currentClass: string | null
  outbox: Op[]
  conflicts: Conflict[]
  lastSyncAt: string | null
  syncing: boolean
  online: boolean
  loaded: boolean
  syncError: string | null
  /** A class was just opened and its first sync has not finished yet. */
  classLoading: boolean
  /** متابعة ticks from the server, keyed by attKey(child, date, kind). */
  attendance: Record<string, boolean>
  /** متابعة ticks made on this device and not sent yet. */
  attOutbox: AttOp[]
  attError: string | null
  /** Fridays marked as communion / club days, keyed by dayKey(class, date, kind). */
  dayMarks: Record<string, boolean>
  /** Communion / club marks made on this device and not sent yet. */
  dayOutbox: DayOp[]
  /** Fridays added to (or taken off) the end of every service year — set by an admin. */
  yearEndWeeks: number
}

/** Two ticks per child per Friday: الحضور (attendance) and الافتقاد (visit). */
export type FollowUpKind = 'attendance' | 'visit'

export type AttOp = { child: string; date: string; kind: FollowUpKind; checked: boolean; queued_at: string }

export const attKey = (child: string, date: string, kind: FollowUpKind) => `${child}|${date}|${kind}`

let state: State = {
  rows: [],
  fields: [],
  classes: [],
  profile: null,
  currentClass: load('class') || null,
  outbox: [],
  conflicts: [],
  lastSyncAt: null,
  syncing: false,
  online: navigator.onLine,
  loaded: false,
  syncError: null,
  classLoading: false,
  attendance: {},
  attOutbox: [],
  attError: null,
  dayMarks: {},
  dayOutbox: [],
  yearEndWeeks: 0,
}

const listeners = new Set<() => void>()

function set(patch: Partial<State>, persist = true) {
  state = { ...state, ...patch }
  listeners.forEach(l => l())
  if (persist) {
    setMany([
      ['rows', state.rows],
      ['fields', state.fields],
      ['classes', state.classes],
      ['profile', state.profile],
      ['outbox', state.outbox],
      ['conflicts', state.conflicts],
      ['lastSyncAt', state.lastSyncAt],
      ['followUp', state.attendance],
      ['attOutbox', state.attOutbox],
      ['dayMarks', state.dayMarks],
      ['dayOutbox', state.dayOutbox],
      ['yearEndWeeks', state.yearEndWeeks],
    ]).catch(() => {})
  }
}

/** The store outside React. */
export const getState = () => state

export function useStore() {
  return useSyncExternalStore(
    l => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

// ---- flat view -------------------------------------------------------------

export const X = 'x:'

/** Fills defaults so rows cached by an older version (or before the SQL migration) still work. */
function normalize<T extends ChildInput>(row: T): T {
  return { ...row, phones: Array.isArray(row.phones) ? row.phones : [], primary_contacts: Array.isArray(row.primary_contacts) ? row.primary_contacts : [], photo: row.photo ?? null, other_address: row.other_address ?? null, position: row.position ?? null, extra: row.extra ?? {} }
}

function toFlat(c: ChildInput): Flat {
  const out: Flat = {}
  for (const f of CORE_FIELDS) out[f] = c[f] ?? null
  for (const [k, v] of Object.entries(c.extra ?? {})) out[X + k] = v ?? null
  return out
}

export function flatGet(c: ChildInput, key: string): unknown {
  return key.startsWith(X) ? (c.extra?.[key.slice(X.length)] ?? null) : ((c as unknown as Flat)[key] ?? null)
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

function diff(from: ChildInput, to: ChildInput): Flat {
  const a = toFlat(from)
  const b = toFlat(to)
  const out: Flat = {}
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (!same(a[k], b[k])) out[k] = b[k] ?? null
  return out
}

function applyFlat<T extends ChildInput>(row: T, changes: Flat): T {
  const next = { ...row, extra: { ...(row.extra ?? {}) } }
  for (const [k, v] of Object.entries(changes)) {
    if (k.startsWith(X)) next.extra[k.slice(X.length)] = v
    else (next as unknown as Flat)[k] = v
  }
  return next
}

function pick(input: ChildInput): ChildInput {
  const out = { full_name: input.full_name, phones: input.phones ?? [], primary_contacts: input.primary_contacts ?? [], photo: input.photo ?? null, other_address: input.other_address ?? null, position: input.position ?? null, extra: input.extra ?? {} } as ChildInput
  for (const f of TEXT_FIELDS) out[f] = input[f] ?? null
  return out
}

// ---- lifecycle -------------------------------------------------------------

let started = false

export async function startStore(userId: string) {
  if (started) return
  started = true
  if ((await get<string>('owner').catch(() => undefined)) !== userId) {
    await clear().catch(() => {})
    save('class', '')
    state = { ...state, currentClass: null }
    await setMany([['owner', userId]]).catch(() => {})
  }
  const [rows, fields, outbox, conflicts, lastSyncAt, attendance, attOutbox, classes, profile, dayMarks, dayOutbox, yearEndWeeks] = await Promise.all([
    get<Child[]>('rows'),
    get<CustomField[]>('fields'),
    get<Op[]>('outbox'),
    get<Conflict[]>('conflicts'),
    get<string>('lastSyncAt'),
    get<Record<string, boolean>>('followUp'),
    get<AttOp[]>('attOutbox'),
    get<ClassInfo[]>('classes'),
    get<Profile>('profile'),
    get<Record<string, boolean>>('dayMarks'),
    get<DayOp[]>('dayOutbox'),
    get<number>('yearEndWeeks'),
  ]).catch(() => [] as undefined[])
  set(
    {
      rows: (rows ?? []).map(normalize),
      fields: fields ?? [],
      outbox: outbox ?? [],
      conflicts: conflicts ?? [],
      lastSyncAt: lastSyncAt ?? null,
      attendance: attendance ?? {},
      attOutbox: (attOutbox ?? []).filter(o => o.kind), // drop ticks queued by an older version
      classes: classes ?? [],
      dayMarks: dayMarks ?? {},
      // marks queued by an older version were communion-only: { communion } instead of { kind, on }
      dayOutbox: (dayOutbox ?? []).map(o => (o.kind ? o : { ...o, kind: 'communion' as const, on: (o as unknown as { communion: boolean }).communion })),
      profile: profile ?? null,
      yearEndWeeks: setWeeks(yearEndWeeks ?? 0),
      loaded: true,
    },
    false,
  )

  window.addEventListener('online', () => {
    set({ online: true }, false)
    sync()
  })
  window.addEventListener('offline', () => set({ online: false }, false))
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && sync())
  setInterval(sync, 60_000)
  sync()
}

/** Wipes every local copy of the children data (used on sign-out). */
export async function resetStore() {
  await clear().catch(() => {})
  save('class', '')
  save('lastActive', '') // the idle sign-out clock (idle.ts) starts again at the next sign-in
  resetTrips()
  openedDefault = false // the next user to sign in gets their own ⭐ class
  set(
    { rows: [], fields: [], classes: [], profile: null, currentClass: null, outbox: [], conflicts: [], lastSyncAt: null, syncError: null, classLoading: false, attendance: {}, attOutbox: [], attError: null, dayMarks: {}, dayOutbox: [], yearEndWeeks: setWeeks(0) },
    false,
  )
}

// ---- my profile -------------------------------------------------------------

async function myId() {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

async function pullProfile() {
  const id = await myId()
  if (!id) return
  const { data, error } = await supabase.from('profiles').select('display_name,photo').eq('user_id', id).maybeSingle()
  if (error) throw isNetworkError(error.message) ? new Offline() : new Error(error.message)
  set({ profile: (data as Profile | null) ?? { display_name: null, photo: null } })
}

/** Name and photo; needs a connection. */
export async function saveProfile(profile: Profile): Promise<string | null> {
  const id = await myId()
  if (!id) return 'not signed in'
  const { error } = await supabase.from('profiles').upsert({ user_id: id, ...profile })
  if (error) return error.message
  set({ profile })
  return null
}

export async function changePassword(password: string): Promise<string | null> {
  const { error } = await supabase.auth.updateUser({ password })
  return error?.message ?? null
}

// ---- الإعدادات ----------------------------------------------------------------

/** serviceYear.ts reads the offset directly, so it is set there before the store re-renders. */
function setWeeks(n: number) {
  setYearEndWeeks(n)
  return n
}

async function pullSettings() {
  const { data, error } = await supabase.from('settings').select('value').eq('key', 'year_end_weeks').maybeSingle()
  if (error) {
    if (isNetworkError(error.message)) throw new Offline()
    return // the settings table is not there yet (014 not run) — keep the default
  }
  set({ yearEndWeeks: setWeeks(Number(data?.value ?? 0)) })
}

/** Admins only; needs a connection. */
export async function saveYearEndWeeks(weeks: number): Promise<string | null> {
  const { error } = await supabase.rpc('set_year_end_weeks', { p_weeks: weeks })
  if (error) return error.message
  set({ yearEndWeeks: setWeeks(weeks) })
  return null
}

// ---- فصول --------------------------------------------------------------------

export function setCurrentClass(id: string | null) {
  const changed = id !== state.currentClass
  save('class', id ?? '')
  set({ currentClass: id, classLoading: changed && !!id }, false)
  if (changed && id) sync() // fetch the newest data of the class just opened
}

/** Custom columns of the class on screen. */
export const classFields = (s: State) => s.fields.filter(f => f.class_id === s.currentClass)

// The ⭐ class opens by itself once per app start; after that the user's own choice sticks.
let openedDefault = false

/** Classes I can open — not the ones I left (those stay listed for a week so I can rejoin). */
export const activeClasses = (classes: ClassInfo[]) => classes.filter(c => !c.left_at)

async function pullClasses() {
  const { data, error } = await supabase.rpc('my_classes')
  if (error) throw isNetworkError(error.message) ? new Offline() : new Error(error.message)
  const classes = data as ClassInfo[]
  set({ classes })
  const open = activeClasses(classes) // a class I left can't be opened
  const starred = open.find(c => c.is_default)
  if (!openedDefault && starred) setCurrentClass(starred.id)
  else if (!open.some(c => c.id === state.currentClass)) setCurrentClass((starred ?? open.find(c => c.is_member) ?? open[0])?.id ?? null)
  openedDefault = true
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string }

export async function createClass(name: string, year: string): Promise<Result<string>> {
  const { data, error } = await supabase.rpc('create_class', { p_name: name, p_year: year })
  if (error) return { ok: false, error: error.message }
  setCurrentClass(data as string)
  await sync()
  return { ok: true, value: data as string }
}

export async function renameClass(id: string, name: string): Promise<Result<null>> {
  const { error } = await supabase.from('classes').update({ name }).eq('id', id)
  if (error) return { ok: false, error: error.message }
  await sync()
  return { ok: true, value: null }
}

/** ⭐ this year's class (opens automatically), or null to clear. */
export async function setDefaultClass(id: string | null): Promise<Result<null>> {
  const { error } = await supabase.rpc('set_default_class', { p_class: id })
  if (error) return { ok: false, error: error.message }
  await sync()
  return { ok: true, value: null }
}

/** A one-time 6-digit code for the class on screen, valid 15 minutes. */
export async function createInvite(): Promise<Result<{ code: string; expires_at: string }>> {
  const { data, error } = await supabase.rpc('create_invite', { p_class: state.currentClass })
  if (error) return { ok: false, error: error.message }
  return { ok: true, value: (data as { code: string; expires_at: string }[])[0] }
}

export async function joinClass(code: string): Promise<Result<string>> {
  const { data, error } = await supabase.rpc('join_class', { p_code: code })
  if (error) return { ok: false, error: error.message }
  const r = data as { class_id?: string; error?: 'invalid' | 'too_many' }
  if (!r.class_id) return { ok: false, error: r.error ?? 'invalid' }
  setCurrentClass(r.class_id)
  await sync()
  return { ok: true, value: r.class_id }
}

export async function leaveClass(id: string): Promise<Result<null>> {
  const { error } = await supabase.rpc('leave_class', { p_class: id })
  if (error) return { ok: false, error: error.message }
  if (state.currentClass === id) setCurrentClass(null)
  await sync()
  return { ok: true, value: null }
}

/** Admins only: delete a whole class and everything in it. */
export async function deleteClass(id: string): Promise<Result<null>> {
  const { error } = await supabase.rpc('delete_class', { p_class: id })
  if (error) return { ok: false, error: error.message }
  if (state.currentClass === id) setCurrentClass(null)
  await sync()
  return { ok: true, value: null }
}

/** Back into a class I left less than 7 days ago. */
export async function rejoinClass(id: string): Promise<Result<null>> {
  const { data, error } = await supabase.rpc('rejoin_class', { p_class: id })
  if (error) return { ok: false, error: error.message }
  if (data !== true) return { ok: false, error: 'too_late' }
  setCurrentClass(id)
  await sync()
  return { ok: true, value: null }
}

// ---- متابعة -----------------------------------------------------------------

const sameTick = (o: AttOp, child: string, date: string, kind: FollowUpKind) => o.child === child && o.date === date && o.kind === kind

/** Server value with this device's unsent ticks on top. */
export function isChecked(s: State, child: string, date: string, kind: FollowUpKind): boolean {
  for (let i = s.attOutbox.length - 1; i >= 0; i--) {
    const o = s.attOutbox[i]
    if (sameTick(o, child, date, kind)) return o.checked
  }
  return s.attendance[attKey(child, date, kind)] ?? false
}

/** Tick / untick الحضور or الافتقاد for a child on a Friday. Works offline; the last tick wins. */
export function toggleFollowUp(child: string, date: string, kind: FollowUpKind) {
  const checked = !isChecked(state, child, date, kind)
  const attOutbox = state.attOutbox.filter(o => !sameTick(o, child, date, kind))
  attOutbox.push({ child, date, kind, checked, queued_at: new Date().toISOString() })
  set({ attOutbox })
  scheduleSync()
}

// ---- يوم تناول / نادي — a Friday marked for the whole class ------------------

/** A Friday can be a communion day (تناول), a club day (نادي), or both. */
export type DayKind = 'communion' | 'club'
export const DAY_KINDS: DayKind[] = ['communion', 'club']

export type DayOp = { classId: string; date: string; kind: DayKind; on: boolean; queued_at: string }

export const dayKey = (classId: string, date: string, kind: DayKind) => `${classId}|${date}|${kind}`

function dayMark(s: State, classId: string, date: string, kind: DayKind): boolean {
  for (let i = s.dayOutbox.length - 1; i >= 0; i--) {
    const o = s.dayOutbox[i]
    if (o.classId === classId && o.date === date && o.kind === kind) return o.on
  }
  return s.dayMarks[dayKey(classId, date, kind)] ?? false
}

/** Is this Friday of the class on screen marked as `kind`? */
export function isDay(s: State, date: string, kind: DayKind): boolean {
  return !!s.currentClass && dayMark(s, s.currentClass, date, kind)
}

/** Mark / unmark a Friday of the class on screen as a communion or club day. Works offline. */
export function toggleDay(date: string, kind: DayKind) {
  const classId = state.currentClass
  if (!classId) return
  const on = !isDay(state, date, kind)
  const dayOutbox = state.dayOutbox.filter(o => !(o.classId === classId && o.date === date && o.kind === kind))
  dayOutbox.push({ classId, date, kind, on, queued_at: new Date().toISOString() })
  set({ dayOutbox })
  scheduleSync()
}

// Ticking many boxes quickly should send one request, not one per click.
let syncTimer: ReturnType<typeof setTimeout> | undefined
function scheduleSync() {
  clearTimeout(syncTimer)
  syncTimer = setTimeout(sync, 1500)
}

// ---- reading ---------------------------------------------------------------

export type RowStatus = 'synced' | 'pending' | 'conflict' | 'error'
export type ViewRow = Child & { status: RowStatus }

/** Server rows with local, not-yet-synced changes applied on top. */
export function viewRows(s: State): ViewRow[] {
  const byId = new Map<string, ViewRow>(s.rows.map(r => [r.client_id, { ...normalize(r), status: 'synced' }]))
  for (const op of s.outbox) {
    const status: RowStatus = op.error ? 'error' : 'pending'
    if (op.kind === 'insert') {
      byId.set(op.client_id, {
        ...normalize(op.data),
        id: 0,
        client_id: op.client_id,
        class_id: op.class_id,
        created_at: op.queued_at,
        updated_at: op.queued_at,
        status,
      })
    } else {
      const row = byId.get(op.client_id) ?? { ...normalize(op.base), status }
      byId.set(op.client_id, { ...applyFlat(row, op.changes), status })
    }
  }
  for (const c of s.conflicts) {
    const row = byId.get(c.client_id)
    if (row) row.status = 'conflict'
  }
  return [...byId.values()].filter(r => r.class_id === s.currentClass)
}

/**
 * True while the children of the class on screen may still be on their way: nothing is shown
 * yet, and either nothing was ever synced or the class was just opened and its first sync is
 * still running. Not the sync every minute — an empty class would flash "loading" each time.
 * Offline there is nothing to wait for.
 */
export function childrenLoading(s: State, count: number): boolean {
  // a sync that failed (shown on the Sync page) must not leave "loading" up for good
  return !s.loaded || (count === 0 && s.online && !s.syncError && (!s.lastSyncAt || s.classLoading))
}

export function findRow(s: State, clientId: string) {
  return viewRows(s).find(r => r.client_id === clientId)
}

// ---- writing children ------------------------------------------------------

/** Save a new child (clientId = null) or an edit. Works offline. */
/**
 * Children still in the class first, then — in the same order — those who left it. Tables
 * draw a line between the two groups.
 */
export function stillInClassFirst<T extends ChildInput>(rows: T[]): T[] {
  return [...rows.filter(r => !r.moved_out_on), ...rows.filter(r => r.moved_out_on)]
}

/**
 * ترتيبي: move list[i] one place up (-1) or down (+1), swapping with its neighbour. `list` is
 * the whole class in the order on screen. The first move numbers everyone in that order;
 * after that a move only changes the two children involved. Works offline like any edit.
 */
export function moveChild(list: Child[], i: number, dir: -1 | 1) {
  const j = i + dir
  if (j < 0 || j >= list.length) return
  const numbered = list.every(r => r.position != null) && new Set(list.map(r => r.position)).size === list.length
  const pos = new Map(list.map((r, k) => [r.client_id, numbered ? r.position! : (k + 1) * 10]))
  const a = list[i].client_id
  const b = list[j].client_id
  const pa = pos.get(a)!
  pos.set(a, pos.get(b)!)
  pos.set(b, pa)
  for (const r of list) {
    const p = pos.get(r.client_id)!
    if (p === r.position) continue
    const row = findRow(state, r.client_id)
    if (row) saveChild(r.client_id, { ...row, position: p })
  }
}

/** The child left the class (today), or came back (null). Works offline like any edit. */
export function setMovedOut(clientId: string, movedOut: boolean) {
  const row = findRow(state, clientId)
  if (!row) return
  saveChild(clientId, movedOut ? { ...row, moved_out_on: iso(new Date()) } : { ...row, moved_out_on: null, moved_to_church: null, moved_to_servant: null })
}

export function saveChild(clientId: string | null, input: ChildInput) {
  const data = pick(input)
  const now = new Date().toISOString()
  let outbox = [...state.outbox]

  if (!clientId) {
    if (!state.currentClass) return
    outbox.push({ kind: 'insert', client_id: crypto.randomUUID(), class_id: state.currentClass, data, queued_at: now })
  } else {
    const i = outbox.findIndex(o => o.client_id === clientId)
    const existing = outbox[i]
    if (existing?.kind === 'insert') {
      outbox[i] = { ...existing, data, error: undefined }
    } else if (existing?.kind === 'update') {
      const changes = diff(normalize(existing.base), data)
      if (Object.keys(changes).length) outbox[i] = { ...existing, changes, error: undefined }
      else outbox = outbox.filter((_, j) => j !== i)
    } else {
      const base = state.rows.find(r => r.client_id === clientId)
      if (!base) return
      const changes = diff(normalize(base), data)
      if (!Object.keys(changes).length) return
      outbox.push({ kind: 'update', client_id: clientId, base, changes, queued_at: now })
    }
  }
  set({ outbox })
  sync()
}

export function discardOp(clientId: string) {
  set({ outbox: state.outbox.filter(o => o.client_id !== clientId) })
}

export function retryOp(clientId: string) {
  set({ outbox: state.outbox.map(o => (o.client_id === clientId ? { ...o, error: undefined } : o)) })
  sync()
}

export function resolveConflict(clientId: string, keep: 'mine' | 'server') {
  const c = state.conflicts.find(x => x.client_id === clientId)
  if (!c) return
  const conflicts = state.conflicts.filter(x => x.client_id !== clientId)
  if (keep === 'server' || !c.server) {
    set({ conflicts })
    return
  }
  // Re-apply my changes on top of the server's current version.
  const op: UpdateOp = { kind: 'update', client_id: clientId, base: c.server, changes: c.changes, queued_at: new Date().toISOString() }
  set({ conflicts, outbox: [...state.outbox, op] })
  sync()
}

// ---- custom columns (need a connection) ------------------------------------

async function pullFields() {
  const { data, error } = await supabase.from('custom_fields').select('key,label,type,position,class_id').order('position').order('created_at')
  if (error) throw isNetworkError(error.message) ? new Offline() : new Error(error.message)
  set({ fields: data as CustomField[] })
}

export async function addField(label: string, type: FieldType): Promise<string | null> {
  const key = 'f_' + crypto.randomUUID().slice(0, 8)
  const position = Math.max(0, ...state.fields.map(f => f.position)) + 1
  const { error } = await supabase.from('custom_fields').insert({ key, label, type, position, class_id: state.currentClass })
  if (error) return error.message
  await pullFields().catch(() => {})
  return null
}

export async function renameField(key: string, label: string): Promise<string | null> {
  const { error } = await supabase.from('custom_fields').update({ label }).eq('key', key)
  if (error) return error.message
  await pullFields().catch(() => {})
  return null
}

/** Admins only: removes the column AND the values typed into it, for every child of the class. */
export async function deleteField(key: string): Promise<string | null> {
  const { error } = await supabase.rpc('delete_custom_field', { p_key: key })
  if (error) return error.message
  await sync()
  return null
}

// ---- sync ------------------------------------------------------------------

function isNetworkError(message: string) {
  return !navigator.onLine || /fetch|network|timeout|load failed/i.test(message)
}

class Offline extends Error {}

// A sync asked for while another is running must not be dropped (e.g. right after creating or
// opening a class): it waits for the running one, then runs once more.
let running: Promise<void> | null = null
let again = false

export function sync(): Promise<void> {
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    do {
      again = false
      await syncOnce()
    } while (again)
  })().finally(() => {
    running = null
  })
  return running
}

async function syncOnce() {
  if (!state.loaded) return
  if (!navigator.onLine) {
    set({ online: false }, false)
    return
  }
  set({ syncing: true, online: true, syncError: null }, false)

  try {
    for (const op of [...state.outbox]) {
      if (op.error) continue // waits for the user to retry or discard
      const result = op.kind === 'insert' ? await pushInsert(op) : await pushUpdate(op)
      let outbox = state.outbox.filter(o => o !== op)
      if (result === 'done' && op.kind === 'update') {
        // If the child was edited again while this push was in flight, the newer edit now
        // starts from what we just wrote — otherwise it would look like a conflict with itself.
        outbox = outbox.map(o => (o.client_id === op.client_id && o.kind === 'update' ? { ...o, base: applyFlat(normalize(o.base), op.changes) } : o))
      }
      if (result === 'done') set({ outbox })
      else if ('conflict' in result) set({ outbox, conflicts: [...state.conflicts.filter(c => c.client_id !== op.client_id), result.conflict] })
      else set({ outbox: state.outbox.map(o => (o === op ? { ...o, error: result.error } : o)) })
    }

    await pushAttendance()
    await pushDayMarks()

    await pullClasses()
    await pullProfile()
    await pullSettings()
    await pullFields()
    const children = await fetchAll<Child>((from, to) => supabase.from('children').select('*').order('id').range(from, to))
    const att = await fetchAll<{ child_client_id: string; date: string; kind: FollowUpKind; checked: boolean }>((from, to) =>
      supabase.from('follow_up').select('child_client_id,date,kind,checked').order('child_client_id').order('date').order('kind').range(from, to),
    )
    // '*': still works before 015 adds the club column
    const days = await fetchAll<{ class_id: string; date: string; communion: boolean; club?: boolean }>((from, to) =>
      supabase.from('class_day_marks').select('*').order('class_id').order('date').range(from, to),
    )
    set({
      rows: children.map(normalize),
      attendance: Object.fromEntries(att.map(a => [attKey(a.child_client_id, a.date, a.kind), a.checked])),
      dayMarks: Object.fromEntries(
        days.flatMap(d => [
          [dayKey(d.class_id, d.date, 'communion'), d.communion],
          [dayKey(d.class_id, d.date, 'club'), d.club ?? false],
        ]),
      ),
      lastSyncAt: new Date().toISOString(),
    })
  } catch (e) {
    if (!(e instanceof Offline)) set({ syncError: (e as Error).message }, false)
  } finally {
    set({ syncing: false, classLoading: false }, false)
  }
}

/** Supabase returns at most 1000 rows per request — page through everything. */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>) {
  const size = 1000
  const out: T[] = []
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1)
    if (error) throw isNetworkError(error.message) ? new Offline() : new Error(error.message)
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < size) return out
  }
}

async function pushDayMarks() {
  const batch = state.dayOutbox
  if (!batch.length) return
  // One row per class + Friday holding both marks, so each changed day is sent whole.
  const days = [...new Map(batch.map(o => [`${o.classId}|${o.date}`, o])).values()].map(o => ({
    class_id: o.classId,
    date: o.date,
    communion: dayMark(state, o.classId, o.date, 'communion'),
    club: dayMark(state, o.classId, o.date, 'club'),
  }))
  const { error } = await supabase.from('class_day_marks').upsert(days, { onConflict: 'class_id,date' })
  if (error) {
    if (isNetworkError(error.message)) throw new Offline()
    set({ attError: error.message }, false)
    return
  }
  const dayMarks = { ...state.dayMarks }
  for (const o of batch) dayMarks[dayKey(o.classId, o.date, o.kind)] = o.on
  set({ dayOutbox: state.dayOutbox.filter(o => !batch.includes(o)), dayMarks })
}

async function pushAttendance() {
  // A tick on a child whose own insert is still failing would be rejected — keep it for later.
  const batch = state.attOutbox.filter(o => !state.outbox.some(op => op.kind === 'insert' && op.client_id === o.child))
  if (!batch.length) return
  const { error } = await supabase
    .from('follow_up')
    .upsert(batch.map(o => ({ child_client_id: o.child, date: o.date, kind: o.kind, checked: o.checked })), { onConflict: 'child_client_id,date,kind' })
  if (error) {
    if (isNetworkError(error.message)) throw new Offline()
    set({ attError: error.message }, false)
    return
  }
  // Only drop what was sent — ticks made during the request stay queued.
  const attendance = { ...state.attendance }
  for (const o of batch) attendance[attKey(o.child, o.date, o.kind)] = o.checked
  set({ attOutbox: state.attOutbox.filter(o => !batch.includes(o)), attendance, attError: null })
}

type PushResult = 'done' | { conflict: Conflict } | { error: string }

async function pushInsert(op: InsertOp): Promise<PushResult> {
  // Upsert on client_id: if a previous attempt already reached the server, this just rewrites
  // the same child (with its latest local data) instead of adding it twice.
  const { error } = await supabase.from('children').upsert({ ...pick(op.data), client_id: op.client_id, class_id: op.class_id }, { onConflict: 'client_id' })
  if (!error) return 'done'
  if (isNetworkError(error.message)) throw new Offline()
  return { error: error.message }
}

async function pushUpdate(op: UpdateOp, attempt = 0): Promise<PushResult> {
  if (attempt > 3) return { error: 'The child keeps changing on the server — try again.' }

  const { data, error } = await supabase.from('children').select('*').eq('client_id', op.client_id).maybeSingle()
  if (error) {
    if (isNetworkError(error.message)) throw new Offline()
    return { error: error.message }
  }
  if (!data) {
    return { conflict: { client_id: op.client_id, base: op.base, changes: op.changes, server: null, fields: Object.keys(op.changes) } }
  }
  const server = normalize(data as Child)
  const base = normalize(op.base)

  // A field conflicts only if the server changed it too, to a different value than mine.
  const fields = Object.keys(op.changes).filter(k => !same(flatGet(server, k), flatGet(base, k)) && !same(flatGet(server, k), op.changes[k]))
  if (fields.length) return { conflict: { client_id: op.client_id, base: op.base, changes: op.changes, server, fields } }

  // Built-in columns are sent as-is; custom columns are merged into the server's current `extra`.
  const payload: Flat = {}
  for (const [k, v] of Object.entries(op.changes)) if (!k.startsWith(X)) payload[k] = v
  if (Object.keys(op.changes).some(k => k.startsWith(X))) payload.extra = applyFlat(server, op.changes).extra

  // Guard on updated_at so an edit landing between our read and write is not overwritten.
  const { data: updated, error: updateError } = await supabase
    .from('children')
    .update(payload)
    .eq('client_id', op.client_id)
    .eq('updated_at', server.updated_at)
    .select('client_id')
  if (updateError) {
    if (isNetworkError(updateError.message)) throw new Offline()
    return { error: updateError.message }
  }
  if (!updated?.length) return pushUpdate(op, attempt + 1) // server moved again — re-check
  return 'done'
}
