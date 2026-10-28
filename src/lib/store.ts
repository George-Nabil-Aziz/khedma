import { useSyncExternalStore } from 'react'
import { clear, get, setMany } from 'idb-keyval'
import { CORE_FIELDS, TEXT_FIELDS, supabase, type Child, type ChildInput, type CustomField, type FieldType } from './supabase'

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

export type InsertOp = { kind: 'insert'; client_id: string; data: ChildInput; queued_at: string; error?: string }
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
  outbox: Op[]
  conflicts: Conflict[]
  lastSyncAt: string | null
  syncing: boolean
  online: boolean
  loaded: boolean
  syncError: string | null
  /** الافتقاد from the server, keyed by attKey(child, date). */
  attendance: Record<string, boolean>
  /** الافتقاد ticks made on this device and not sent yet. */
  attOutbox: AttOp[]
  attError: string | null
}

export type AttOp = { child: string; date: string; present: boolean; queued_at: string }

export const attKey = (child: string, date: string) => `${child}|${date}`

let state: State = {
  rows: [],
  fields: [],
  outbox: [],
  conflicts: [],
  lastSyncAt: null,
  syncing: false,
  online: navigator.onLine,
  loaded: false,
  syncError: null,
  attendance: {},
  attOutbox: [],
  attError: null,
}

const listeners = new Set<() => void>()

function set(patch: Partial<State>, persist = true) {
  state = { ...state, ...patch }
  listeners.forEach(l => l())
  if (persist) {
    setMany([
      ['rows', state.rows],
      ['fields', state.fields],
      ['outbox', state.outbox],
      ['conflicts', state.conflicts],
      ['lastSyncAt', state.lastSyncAt],
      ['attendance', state.attendance],
      ['attOutbox', state.attOutbox],
    ]).catch(() => {})
  }
}

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
  return { ...row, phones: Array.isArray(row.phones) ? row.phones : [], primary_contact: row.primary_contact ?? null, extra: row.extra ?? {} }
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
  const out = { full_name: input.full_name, phones: input.phones ?? [], primary_contact: input.primary_contact ?? null, extra: input.extra ?? {} } as ChildInput
  for (const f of TEXT_FIELDS) out[f] = input[f] ?? null
  return out
}

// ---- lifecycle -------------------------------------------------------------

let started = false

export async function startStore() {
  if (started) return
  started = true
  const [rows, fields, outbox, conflicts, lastSyncAt, attendance, attOutbox] = await Promise.all([
    get<Child[]>('rows'),
    get<CustomField[]>('fields'),
    get<Op[]>('outbox'),
    get<Conflict[]>('conflicts'),
    get<string>('lastSyncAt'),
    get<Record<string, boolean>>('attendance'),
    get<AttOp[]>('attOutbox'),
  ]).catch(() => [] as undefined[])
  set(
    {
      rows: (rows ?? []).map(normalize),
      fields: fields ?? [],
      outbox: outbox ?? [],
      conflicts: conflicts ?? [],
      lastSyncAt: lastSyncAt ?? null,
      attendance: attendance ?? {},
      attOutbox: attOutbox ?? [],
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
  set({ rows: [], fields: [], outbox: [], conflicts: [], lastSyncAt: null, syncError: null, attendance: {}, attOutbox: [], attError: null }, false)
}

// ---- الافتقاد ----------------------------------------------------------------

/** Server value with this device's unsent ticks on top. */
export function isPresent(s: State, child: string, date: string): boolean {
  for (let i = s.attOutbox.length - 1; i >= 0; i--) {
    const o = s.attOutbox[i]
    if (o.child === child && o.date === date) return o.present
  }
  return s.attendance[attKey(child, date)] ?? false
}

/** Tick / untick a child for a Friday. Works offline; the last tick wins. */
export function toggleAttendance(child: string, date: string) {
  const present = !isPresent(state, child, date)
  const attOutbox = state.attOutbox.filter(o => !(o.child === child && o.date === date))
  attOutbox.push({ child, date, present, queued_at: new Date().toISOString() })
  set({ attOutbox })
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
      byId.set(op.client_id, { ...normalize(op.data), id: 0, client_id: op.client_id, created_at: op.queued_at, updated_at: op.queued_at, status })
    } else {
      const row = byId.get(op.client_id) ?? { ...normalize(op.base), status }
      byId.set(op.client_id, { ...applyFlat(row, op.changes), status })
    }
  }
  for (const c of s.conflicts) {
    const row = byId.get(c.client_id)
    if (row) row.status = 'conflict'
  }
  return [...byId.values()]
}

export function findRow(s: State, clientId: string) {
  return viewRows(s).find(r => r.client_id === clientId)
}

// ---- writing children ------------------------------------------------------

/** Save a new child (clientId = null) or an edit. Works offline. */
export function saveChild(clientId: string | null, input: ChildInput) {
  const data = pick(input)
  const now = new Date().toISOString()
  let outbox = [...state.outbox]

  if (!clientId) {
    outbox.push({ kind: 'insert', client_id: crypto.randomUUID(), data, queued_at: now })
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
  const { data, error } = await supabase.from('custom_fields').select('key,label,type,position').order('position').order('created_at')
  if (error) throw isNetworkError(error.message) ? new Offline() : new Error(error.message)
  set({ fields: data as CustomField[] })
}

export async function addField(label: string, type: FieldType): Promise<string | null> {
  const key = 'f_' + crypto.randomUUID().slice(0, 8)
  const position = Math.max(0, ...state.fields.map(f => f.position)) + 1
  const { error } = await supabase.from('custom_fields').insert({ key, label, type, position })
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

/** Removes the column definition. The values already typed stay inside `extra`, hidden. */
export async function deleteField(key: string): Promise<string | null> {
  const { error } = await supabase.from('custom_fields').delete().eq('key', key)
  if (error) return error.message
  await pullFields().catch(() => {})
  return null
}

// ---- sync ------------------------------------------------------------------

function isNetworkError(message: string) {
  return !navigator.onLine || /fetch|network|timeout|load failed/i.test(message)
}

class Offline extends Error {}

export async function sync() {
  if (state.syncing || !state.loaded) return
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

    await pullFields()
    const children = await fetchAll<Child>((from, to) => supabase.from('children').select('*').order('id').range(from, to))
    const att = await fetchAll<{ child_client_id: string; date: string; present: boolean }>((from, to) =>
      supabase.from('attendance').select('child_client_id,date,present').order('child_client_id').order('date').range(from, to),
    )
    set({
      rows: children.map(normalize),
      attendance: Object.fromEntries(att.map(a => [attKey(a.child_client_id, a.date), a.present])),
      lastSyncAt: new Date().toISOString(),
    })
  } catch (e) {
    if (!(e instanceof Offline)) set({ syncError: (e as Error).message }, false)
  } finally {
    set({ syncing: false }, false)
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

async function pushAttendance() {
  // A tick on a child whose own insert is still failing would be rejected — keep it for later.
  const batch = state.attOutbox.filter(o => !state.outbox.some(op => op.kind === 'insert' && op.client_id === o.child))
  if (!batch.length) return
  const { error } = await supabase
    .from('attendance')
    .upsert(batch.map(o => ({ child_client_id: o.child, date: o.date, present: o.present })), { onConflict: 'child_client_id,date' })
  if (error) {
    if (isNetworkError(error.message)) throw new Offline()
    set({ attError: error.message }, false)
    return
  }
  // Only drop what was sent — ticks made during the request stay queued.
  const attendance = { ...state.attendance }
  for (const o of batch) attendance[attKey(o.child, o.date)] = o.present
  set({ attOutbox: state.attOutbox.filter(o => !batch.includes(o)), attendance, attError: null })
}

type PushResult = 'done' | { conflict: Conflict } | { error: string }

async function pushInsert(op: InsertOp): Promise<PushResult> {
  // Upsert on client_id: if a previous attempt already reached the server, this just rewrites
  // the same child (with its latest local data) instead of adding it twice.
  const { error } = await supabase.from('children').upsert({ ...pick(op.data), client_id: op.client_id }, { onConflict: 'client_id' })
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
