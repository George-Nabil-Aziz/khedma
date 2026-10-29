import { useSyncExternalStore } from 'react'
import { get, setMany } from 'idb-keyval'
import { supabase } from './supabase'

/*
 * الرحلات of my classes. Unlike children, adding and editing needs a connection (each change
 * goes straight to Supabase, then everything is pulled again). The last copy is kept in
 * IndexedDB so trips can still be looked at offline.
 */

export type Trip = {
  id: string
  class_id: string
  name: string
  place: string | null
  /** First day. */
  trip_date: string | null
  /** Last day of a trip of more than one day; null for one day. */
  end_date: string | null
  gather_time: string | null
  gather_place: string | null
  return_time: string | null
  price: number | null
  /** Price for إخوة الرب. */
  brothers_price: number | null
  notes: string | null
  created_at: string
}
export type TripInput = Omit<Trip, 'id' | 'class_id' | 'created_at'>

/** A child going on a trip. */
export type TripChild = { trip_id: string; child_client_id: string; brothers: boolean }
/** One instalment paid by a child. */
export type TripPayment = { id: string; trip_id: string; child_client_id: string; amount: number; paid_on: string }

type TripsState = { trips: Trip[]; going: TripChild[]; payments: TripPayment[]; loading: boolean; loaded: boolean; error: string | null }

let state: TripsState = { trips: [], going: [], payments: [], loading: false, loaded: false, error: null }
const listeners = new Set<() => void>()

function set(patch: Partial<TripsState>) {
  state = { ...state, ...patch }
  listeners.forEach(l => l())
}

export function useTrips() {
  return useSyncExternalStore(
    l => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

/** Cached copy first, then the newest from the server when online. */
export async function loadTrips() {
  if (!state.loaded) {
    const cached = await get<Pick<TripsState, 'trips' | 'going' | 'payments'>>('trips').catch(() => undefined)
    set({ ...(cached ?? {}), loaded: true })
  }
  await refreshTrips()
}

export async function refreshTrips() {
  if (!navigator.onLine) return
  set({ loading: true, error: null })
  const [trips, going, payments] = await Promise.all([
    supabase.from('trips').select('*').order('trip_date', { ascending: false, nullsFirst: true }).order('created_at', { ascending: false }),
    supabase.from('trip_children').select('trip_id,child_client_id,brothers'),
    supabase.from('trip_payments').select('id,trip_id,child_client_id,amount,paid_on').order('paid_on').order('created_at'),
  ])
  const error = trips.error ?? going.error ?? payments.error
  if (error) return set({ loading: false, error: error.message })
  const data = {
    trips: (trips.data as Trip[]).map(t => ({ ...t, price: num(t.price), brothers_price: num(t.brothers_price) })),
    going: going.data as TripChild[],
    payments: (payments.data as TripPayment[]).map(p => ({ ...p, amount: Number(p.amount) })),
  }
  set({ ...data, loading: false })
  setMany([['trips', data]]).catch(() => {})
}

/** Signing out: forget the trips of this account (IndexedDB is cleared by resetStore). */
export function resetTrips() {
  set({ trips: [], going: [], payments: [], loading: false, loaded: false, error: null })
}

// numeric columns come back as strings
const num = (v: unknown) => (v == null || v === '' ? null : Number(v))

type Result = string | null

async function run(change: PromiseLike<{ error: { message: string } | null }>): Promise<Result> {
  const { error } = await change
  if (error) return error.message
  await refreshTrips()
  return null
}

export async function createTrip(classId: string, input: TripInput): Promise<{ id: string } | { error: string }> {
  const { data, error } = await supabase.from('trips').insert({ ...input, class_id: classId }).select('id').single()
  if (error) return { error: error.message }
  await refreshTrips()
  return { id: (data as { id: string }).id }
}

export const updateTrip = (id: string, input: TripInput) => run(supabase.from('trips').update(input).eq('id', id))
export const deleteTrip = (id: string) => run(supabase.from('trips').delete().eq('id', id))

/**
 * Going or not. A child whose الحالة is إخوة الرب starts on the إخوة الرب price (can be changed
 * per trip). Taking a child off the trip also removes what they paid.
 */
export const setGoing = (tripId: string, child: string, going: boolean, brothers = false) =>
  run(
    going
      ? supabase.from('trip_children').upsert({ trip_id: tripId, child_client_id: child, brothers })
      : supabase.from('trip_children').delete().eq('trip_id', tripId).eq('child_client_id', child),
  )

export const setBrothers = (tripId: string, child: string, brothers: boolean) =>
  run(supabase.from('trip_children').update({ brothers }).eq('trip_id', tripId).eq('child_client_id', child))

export const addPayment = (tripId: string, child: string, amount: number) =>
  run(supabase.from('trip_payments').insert({ trip_id: tripId, child_client_id: child, amount }))

export const deletePayment = (id: string) => run(supabase.from('trip_payments').delete().eq('id', id))

/** The trip's last day: end_date, or the one day it takes. */
export const lastDay = (trip: Pick<Trip, 'trip_date' | 'end_date'>) => trip.end_date ?? trip.trip_date

/** How many days the trip takes, counting both ends; null without dates. */
export function tripDays(trip: Pick<Trip, 'trip_date' | 'end_date'>): number | null {
  if (!trip.trip_date) return null
  if (!trip.end_date) return 1
  return Math.round((Date.parse(trip.end_date) - Date.parse(trip.trip_date)) / 86_400_000) + 1
}

/** What a child going on the trip owes, has paid, and still has to pay. */
export function balance(trip: Trip, going: TripChild, payments: TripPayment[]) {
  const due = (going.brothers ? trip.brothers_price : trip.price) ?? 0
  const paid = payments.filter(p => p.trip_id === trip.id && p.child_client_id === going.child_client_id).reduce((s, p) => s + p.amount, 0)
  return { due, paid, left: Math.max(0, due - paid) }
}
