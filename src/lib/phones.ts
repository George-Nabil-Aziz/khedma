import { createContext } from 'react'
import type { Owner } from './supabase'
import type { TKey } from './i18n'

export const OWNER_LABEL: Record<Owner, TKey> = { mother: 'mother', father: 'father', child: 'childOwner' }
export const OWNER_PHONES_LABEL: Record<Owner, TKey> = { mother: 'motherMobile', father: 'fatherMobile', child: 'childMobile' }

const digits = (n: string) => n.replace(/[^\d+]/g, '')

/** Without the invisible direction marks a number copied from WhatsApp or the contacts carries. */
const visible = (n: string) => n.replace(/\p{Cf}/gu, '')

/**
 * A number reduced to its Egyptian digits without the leading 0, so it matches however it was
 * written or saved: "+20 12 12040035", "0020 1212040035", "01212040035", "1212040035",
 * "٠١٢١٢٠٤٠٠٣٥" → "1212040035".
 */
export function phoneKey(n: string) {
  const western = visible(n).replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 0x06f0))
  const international = /^\s*(\+|00)/.test(western)
  let d = western.replace(/\D/g, '')
  if (international) d = d.replace(/^00/, '')
  if ((international || /^201\d{9}$/.test(d)) && d.startsWith('20')) d = d.slice(2)
  return d.replace(/^0/, '')
}

/** True when the text is a phone number (or a piece of one) rather than a name. */
export const looksLikePhone = (q: string) => /^[\s+\-()\d٠-٩۰-۹]+$/.test(visible(q)) && phoneKey(q).length >= 3

/** The number being searched for (as a phoneKey), so the table can mark the one that matched. */
export const SearchedPhone = createContext<string | null>(null)

export function telLink(number: string) {
  return `tel:${digits(number)}`
}

/** wa.me needs the international form: Egyptian 01xxxxxxxxx → 201xxxxxxxxx. */
export function whatsappLink(number: string) {
  let d = digits(number).replace(/^\+/, '').replace(/^00/, '')
  if (/^01\d{9}$/.test(d)) d = '2' + d
  return `https://wa.me/${d}`
}
