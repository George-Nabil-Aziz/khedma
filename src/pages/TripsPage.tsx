import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useI18n, type TKey } from '../lib/i18n'
import { go } from '../lib/router'
import { useStore, viewRows } from '../lib/store'
import {
  addPayment,
  balance,
  createTrip,
  deletePayment,
  deleteTrip,
  loadTrips,
  setBrothers,
  setGoing,
  updateTrip,
  useTrips,
  type Trip,
  type TripInput,
} from '../lib/trips'
import { iso } from '../lib/serviceYear'
import { ClassTitle } from '../components/ClassTitle'
import { Loading } from '../components/Loading'
import { confirmDialog } from '../components/ConfirmDialog'
import { ArrowBackIcon, BusIcon, CloudOffIcon, PencilIcon, PlusIcon, TrashIcon, XIcon } from '../components/Icons'

const input =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800'

const money = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 })

function useFormat() {
  const { lang } = useI18n()
  const locale = lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB'
  return {
    date: (d: string | null) => (d ? new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d + 'T00:00')) : null),
    short: (d: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(d + 'T00:00')),
    // "14:30:00" → "2:30 م"
    time: (t: string | null) => (t ? new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(new Date(`2000-01-01T${t}`)) : null),
  }
}

function OfflineNote() {
  const { t } = useI18n()
  const { online } = useStore()
  if (online) return null
  return (
    <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      <CloudOffIcon className="size-4 shrink-0" />
      {t('needsOnline')}
    </div>
  )
}

// ---- list ---------------------------------------------------------------------

/** The trips of the class on screen: coming ones first, then past ones. */
export function TripsPage() {
  const { t } = useI18n()
  const { currentClass, online } = useStore()
  const { trips, going, payments, loaded, error } = useTrips()
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    loadTrips()
  }, [currentClass])

  const today = iso(new Date())
  const mine = trips.filter(tr => tr.class_id === currentClass)
  // coming (and undated) trips soonest first; past trips newest first
  const coming = mine.filter(tr => !tr.trip_date || tr.trip_date >= today).sort((a, b) => (a.trip_date ?? '9999').localeCompare(b.trip_date ?? '9999'))
  const past = mine.filter(tr => tr.trip_date && tr.trip_date < today)

  if (!loaded) return <Loading />

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <ClassTitle />
      <OfflineNote />
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}

      {adding ? (
        <TripForm
          title={t('newTrip')}
          onCancel={() => setAdding(false)}
          onSave={async data => {
            const r = await createTrip(currentClass!, data)
            if ('error' in r) return r.error
            go(`/trip/${r.id}`)
            return null
          }}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          disabled={!online || !currentClass}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-300 py-3 font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-500/40 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
        >
          <PlusIcon className="size-5" />
          {t('newTrip')}
        </button>
      )}

      {mine.length === 0 && !adding && (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-slate-500">
          <BusIcon className="size-10 text-slate-300 dark:text-slate-600" />
          <p className="font-semibold">{t('noTrips')}</p>
        </div>
      )}

      {coming.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-sm font-bold text-slate-500">{t('upcomingTrips')}</h2>
          {coming.map(tr => (
            <TripCard key={tr.id} trip={tr} goingCount={going.filter(g => g.trip_id === tr.id).length} collected={sumPaid(payments, tr.id)} />
          ))}
        </section>
      )}
      {past.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-sm font-bold text-slate-500">{t('pastTrips')}</h2>
          {past.map(tr => (
            <TripCard key={tr.id} trip={tr} past goingCount={going.filter(g => g.trip_id === tr.id).length} collected={sumPaid(payments, tr.id)} />
          ))}
        </section>
      )}
    </div>
  )
}

const sumPaid = (payments: { trip_id: string; amount: number }[], tripId: string) => payments.filter(p => p.trip_id === tripId).reduce((s, p) => s + p.amount, 0)

function TripCard({ trip, past, goingCount, collected }: { trip: Trip; past?: boolean; goingCount: number; collected: number }) {
  const { t } = useI18n()
  const f = useFormat()
  return (
    <button
      onClick={() => go(`/trip/${trip.id}`)}
      className={`block w-full space-y-1.5 rounded-xl border border-slate-200 bg-white p-4 text-start hover:border-indigo-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500/40 ${past ? 'opacity-70' : ''}`}
    >
      <div className="flex items-center gap-2">
        <BusIcon className="size-5 shrink-0 text-indigo-600 dark:text-indigo-300" />
        <span className="min-w-0 flex-1 truncate text-lg font-bold">{trip.name}</span>
        {trip.price != null && <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-0.5 text-sm font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">{money(trip.price)} {t('currency')}</span>}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
        {trip.place && <span>📍 {trip.place}</span>}
        {trip.trip_date && <span>📅 {f.date(trip.trip_date)}</span>}
        {(trip.gather_time || trip.gather_place) && (
          <span>
            🚏 {t('gathering')}: {[f.time(trip.gather_time), trip.gather_place].filter(Boolean).join(' — ')}
          </span>
        )}
      </div>
      <div className="flex gap-4 text-xs text-slate-500">
        <span>
          {t('goingCount')}: <b>{goingCount}</b>
        </span>
        <span>
          {t('collected')}: <b>{money(collected)}</b>
        </span>
      </div>
    </button>
  )
}

// ---- form ---------------------------------------------------------------------

const EMPTY: TripInput = { name: '', place: null, trip_date: null, gather_time: null, gather_place: null, return_time: null, price: null, brothers_price: null, notes: null }

function TripForm({ title, initial = EMPTY, onSave, onCancel }: { title: string; initial?: TripInput; onSave: (d: TripInput) => Promise<string | null>; onCancel: () => void }) {
  const { t } = useI18n()
  const { online } = useStore()
  const [d, setD] = useState<TripInput>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const text = (k: keyof TripInput) => ({
    value: d[k] == null ? '' : String(k.endsWith('_time') ? String(d[k]).slice(0, 5) : d[k]),
    onChange: (e: { target: { value: string } }) => {
      const v = e.target.value
      setD(prev => ({ ...prev, [k]: v === '' ? (k === 'name' ? '' : null) : k.endsWith('price') ? Number(v) : v }))
    },
    disabled: busy,
  })
  const changed = JSON.stringify(d) !== JSON.stringify(initial)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const err = await onSave({ ...d, name: d.name.trim() })
    setBusy(false)
    if (err) setError(err)
  }

  const field = (label: TKey, control: ReactNode, wide = false) => (
    <label className={`flex flex-col gap-1.5 ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="text-sm font-semibold">{t(label)}</span>
      {control}
    </label>
  )

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="flex items-center gap-2 font-bold">
        <BusIcon className="size-5 text-indigo-600 dark:text-indigo-300" />
        {title}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {field('tripName', <input required className={input} placeholder={t('phTripName')} {...text('name')} autoFocus />)}
        {field('tripPlace', <input className={input} placeholder={t('phTripPlace')} {...text('place')} />)}
        {field('tripDate', <input type="date" dir="ltr" className={input} {...text('trip_date')} />)}
        {field('gatherPlace', <input className={input} placeholder={t('phGatherPlace')} {...text('gather_place')} />)}
        {field('gatherTime', <input type="time" dir="ltr" className={input} {...text('gather_time')} />)}
        {field('returnTime', <input type="time" dir="ltr" className={input} {...text('return_time')} />)}
        {field('tripPrice', <input type="number" min={0} step="any" dir="ltr" inputMode="decimal" className={input} {...text('price')} />)}
        {field('brothersPrice', <input type="number" min={0} step="any" dir="ltr" inputMode="decimal" className={input} {...text('brothers_price')} />)}
        {field('notes', <textarea rows={2} className={input} {...text('notes')} />, true)}
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
      <div className="flex gap-2">
        <button disabled={!online || busy || !d.name.trim() || !changed} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
          {t('save')}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
          {t('cancel')}
        </button>
      </div>
    </form>
  )
}

// ---- one trip -----------------------------------------------------------------

/** A trip's details, who is going, and what each of them has paid. */
export function TripPage({ id }: { id: string }) {
  const { t } = useI18n()
  const f = useFormat()
  const store = useStore()
  const { trips, going, payments, loaded } = useTrips()
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [onlyGoing, setOnlyGoing] = useState(false)

  useEffect(() => {
    loadTrips()
  }, [])

  const trip = trips.find(tr => tr.id === id)
  // another class picked in the sidebar: this trip isn't its, so back to that class's trips
  useEffect(() => {
    if (trip && store.currentClass && trip.class_id !== store.currentClass) go('/trips')
  }, [trip, store.currentClass])
  const children = useMemo(
    () => (trip ? viewRows(store).filter(r => r.class_id === trip.class_id) : []).sort((a, b) => a.full_name.localeCompare(b.full_name, 'ar')),
    [store, trip],
  )

  if (!loaded) return <Loading />
  if (!trip) return <p className="py-10 text-center text-slate-500">{t('notFound')}</p>

  const goingHere = going.filter(g => g.trip_id === trip.id)
  const totals = goingHere.reduce(
    (s, g) => {
      const b = balance(trip, g, payments)
      return { due: s.due + b.due, paid: s.paid + b.paid, left: s.left + b.left }
    },
    { due: 0, paid: 0, left: 0 },
  )

  async function remove() {
    const ok = await confirmDialog({ title: t('deleteTrip'), message: t('deleteTripConfirm').replace('{name}', trip!.name), confirmLabel: t('deleteTrip'), danger: true, requireText: trip!.name })
    if (!ok) return
    const err = await deleteTrip(trip!.id)
    if (err) setError(err)
    else go('/trips')
  }

  const info = (label: TKey, value: ReactNode) =>
    value ? (
      <div>
        <dt className="text-xs font-semibold text-slate-500">{t(label)}</dt>
        <dd className="font-semibold">{value}</dd>
      </div>
    ) : null

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-16">
      <button onClick={() => go('/trips')} className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        <ArrowBackIcon className="size-4" />
        {t('trips')}
      </button>
      <OfflineNote />
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}

      {editing ? (
        <TripForm
          title={t('editTrip')}
          initial={{
            name: trip.name,
            place: trip.place,
            trip_date: trip.trip_date,
            gather_time: trip.gather_time,
            gather_place: trip.gather_place,
            return_time: trip.return_time,
            price: trip.price,
            brothers_price: trip.brothers_price,
            notes: trip.notes,
          }}
          onCancel={() => setEditing(false)}
          onSave={async data => {
            const err = await updateTrip(trip.id, data)
            if (!err) setEditing(false)
            return err
          }}
        />
      ) : (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <BusIcon className="size-6 shrink-0 text-indigo-600 dark:text-indigo-300" />
            <h2 className="min-w-0 flex-1 text-xl font-bold">{trip.name}</h2>
            <button onClick={() => setEditing(true)} disabled={!store.online} title={t('editTrip')} aria-label={t('editTrip')} className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800">
              <PencilIcon />
            </button>
            <button onClick={remove} disabled={!store.online} title={t('deleteTrip')} aria-label={t('deleteTrip')} className="grid size-9 place-items-center rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-40 dark:hover:bg-red-500/10">
              <TrashIcon />
            </button>
          </div>
          <dl className="grid gap-3 sm:grid-cols-3">
            {info('tripPlace', trip.place)}
            {info('tripDate', f.date(trip.trip_date))}
            {info('gatherPlace', trip.gather_place)}
            {info('gatherTime', f.time(trip.gather_time))}
            {info('returnTime', f.time(trip.return_time))}
            {info('tripPrice', trip.price != null && `${money(trip.price)} ${t('currency')}`)}
            {info('brothersPrice', trip.brothers_price != null && `${money(trip.brothers_price)} ${t('currency')}`)}
          </dl>
          {trip.notes && <p className="whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60">{trip.notes}</p>}
        </section>
      )}

      {/* totals */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label={t('goingCount')} value={String(goingHere.length)} />
        <Stat label={t('totalDue')} value={money(totals.due)} />
        <Stat label={t('collected')} value={money(totals.paid)} tone="text-emerald-600 dark:text-emerald-400" />
        <Stat label={t('remaining')} value={money(totals.left)} tone={totals.left ? 'text-red-600 dark:text-red-400' : ''} />
      </div>

      {/* children */}
      <section className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <h2 className="flex-1 font-bold">{t('tripChildren')}</h2>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
            <input type="checkbox" className="size-4 accent-indigo-600" checked={onlyGoing} onChange={e => setOnlyGoing(e.target.checked)} />
            {t('onlyGoing')}
          </label>
        </div>
        {children.length === 0 && <p className="py-6 text-center text-sm text-slate-500">{t('noChildrenTitle')}</p>}
        <ul className="space-y-2">
          {children
            .filter(c => !onlyGoing || goingHere.some(g => g.child_client_id === c.client_id))
            .map(c => (
              <ChildRow key={c.client_id} trip={trip} childId={c.client_id} name={c.full_name} brothers={c.category === 'brothers'} onError={setError} />
            ))}
        </ul>
      </section>
    </div>
  )
}

function Stat({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className={`text-lg font-bold ${tone}`} dir="ltr">
        {value}
      </div>
    </div>
  )
}

/** One child: going or not, إخوة الرب, the instalments paid, and a box to add one. */
function ChildRow({ trip, childId, name, brothers, onError }: { trip: Trip; childId: string; name: string; brothers: boolean; onError: (e: string) => void }) {
  const { t } = useI18n()
  const f = useFormat()
  const { online } = useStore()
  const { going, payments } = useTrips()
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)

  const g = going.find(x => x.trip_id === trip.id && x.child_client_id === childId)
  const mine = payments.filter(p => p.trip_id === trip.id && p.child_client_id === childId)
  const b = g ? balance(trip, g, payments) : null

  async function act(change: () => Promise<string | null>) {
    setBusy(true)
    const err = await change()
    setBusy(false)
    if (err) onError(err)
    return !err
  }

  async function toggleGoing() {
    if (g && mine.length) {
      const ok = await confirmDialog({ title: t('notGoing'), message: t('notGoingConfirm').replace('{name}', name), confirmLabel: t('notGoing'), danger: true })
      if (!ok) return
    }
    // الحالة إخوة الرب → starts on the إخوة الرب price
    act(() => setGoing(trip.id, childId, !g, brothers))
  }

  async function pay(e: FormEvent) {
    e.preventDefault()
    const n = Number(amount)
    if (!(n > 0)) return
    if (await act(() => addPayment(trip.id, childId, n))) setAmount('')
  }

  const status = !b ? null : b.due > 0 && b.left === 0 ? 'paid' : b.paid > 0 ? 'partial' : 'unpaid'

  return (
    <li className={`space-y-2 rounded-xl border bg-white p-3 dark:bg-slate-900 ${g ? 'border-indigo-200 dark:border-indigo-500/30' : 'border-slate-200 dark:border-slate-800'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-2">
          <input type="checkbox" className="size-5 accent-indigo-600" checked={!!g} onChange={toggleGoing} disabled={!online || busy} aria-label={`${name} — ${t('going')}`} />
          <span className={`truncate font-semibold ${g ? '' : 'text-slate-500'}`}>{name}</span>
        </label>
        {g && (
          <>
            <button
              onClick={() => act(() => setBrothers(trip.id, childId, !g.brothers))}
              disabled={!online || busy}
              aria-pressed={g.brothers}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold disabled:opacity-50 ${
                g.brothers ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300' : 'border-slate-200 text-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800'
              }`}
            >
              {t('brothers')}
            </button>
            {status === 'paid' && <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">✅ {t('paidAll')}</span>}
            {status === 'partial' && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                {t('leftToPay')}: {money(b!.left)}
              </span>
            )}
            {status === 'unpaid' && b!.due > 0 && <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700 dark:bg-red-500/15 dark:text-red-300">{t('notPaid')}</span>}
          </>
        )}
      </div>

      {g && (
        <div className="flex flex-wrap items-center gap-2 ps-7">
          {/* the instalments so far */}
          {mine.map(p => (
            <span key={p.id} className="flex items-center gap-1 rounded-full bg-emerald-50 py-0.5 ps-2.5 pe-1 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
              <b dir="ltr">{money(p.amount)}</b>
              <span className="text-xs opacity-70">{f.short(p.paid_on)}</span>
              <button
                onClick={async () => {
                  const ok = await confirmDialog({ title: t('deletePayment'), message: t('deletePaymentConfirm').replace('{amount}', money(p.amount)).replace('{name}', name), confirmLabel: t('deletePayment'), danger: true })
                  if (ok) act(() => deletePayment(p.id))
                }}
                disabled={!online || busy}
                title={t('deletePayment')}
                aria-label={t('deletePayment')}
                className="grid size-5 place-items-center rounded-full hover:bg-emerald-200 disabled:opacity-40 dark:hover:bg-emerald-500/30"
              >
                <XIcon className="size-3" />
              </button>
            </span>
          ))}
          <form onSubmit={pay} className="flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              step="any"
              dir="ltr"
              inputMode="decimal"
              placeholder={t('amount')}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              disabled={!online || busy}
              aria-label={`${name} — ${t('amount')}`}
              className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800"
            />
            <button disabled={!online || busy || !(Number(amount) > 0)} className="rounded-lg bg-emerald-600 px-3 py-1 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
              {t('addPayment')}
            </button>
          </form>
        </div>
      )}
    </li>
  )
}
