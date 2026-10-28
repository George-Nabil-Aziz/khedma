import type { Owner } from './supabase'
import type { TKey } from './i18n'

export const OWNER_LABEL: Record<Owner, TKey> = { mother: 'mother', father: 'father', child: 'childOwner' }
export const OWNER_PHONES_LABEL: Record<Owner, TKey> = { mother: 'motherMobile', father: 'fatherMobile', child: 'childMobile' }

const digits = (n: string) => n.replace(/[^\d+]/g, '')

export function telLink(number: string) {
  return `tel:${digits(number)}`
}

/** wa.me needs the international form: Egyptian 01xxxxxxxxx → 201xxxxxxxxx. */
export function whatsappLink(number: string) {
  let d = digits(number).replace(/^\+/, '').replace(/^00/, '')
  if (/^01\d{9}$/.test(d)) d = '2' + d
  return `https://wa.me/${d}`
}
