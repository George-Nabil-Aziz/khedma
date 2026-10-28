import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — copy .env.example to .env')
}

// Every query goes to the khedma schema, never to bishoy_saber_notes or public.
export const supabase = createClient(url, key, {
  db: { schema: 'khedma' },
})

export const OWNERS = ['mother', 'father', 'child'] as const
export type Owner = (typeof OWNERS)[number]

export type Phone = { owner: Owner; number: string; whatsapp: boolean }

// Plain text columns the form edits.
export const TEXT_FIELDS = [
  'house_number',
  'street',
  'branch_of_street',
  'landmark',
  'floor',
  'side',
  'apartment',
  'birth_date',
  'deacon',
  'notes',
  'national_id',
] as const
export type TextField = (typeof TEXT_FIELDS)[number]

// Every built-in column the app can change (custom columns live inside `extra`).
export const CORE_FIELDS = ['full_name', ...TEXT_FIELDS, 'phones', 'primary_contacts', 'photo'] as const
export type CoreField = (typeof CORE_FIELDS)[number]

export type ChildInput = {
  full_name: string
  phones: Phone[]
  /** Who the family is usually reached through — one or more of mother / father / child. */
  primary_contacts: Owner[]
  /** Small JPEG thumbnail as a data: URL, or null. */
  photo: string | null
  extra: Record<string, unknown>
} & { [K in TextField]: string | null }

export type Child = ChildInput & {
  id: number
  client_id: string
  class_id: string
  created_at: string
  updated_at: string
}

export type FieldType = 'text' | 'number' | 'date' | 'boolean'
export type CustomField = { key: string; label: string; type: FieldType; position: number; class_id: string }

/** A فصل. Every child belongs to one; servants see only the classes they are members of. */
// left_at: I left this class (within the last 7 days) — shown greyed out with a "rejoin" button.
export type ClassInfo = { id: string; name: string; service_year: string; is_default: boolean; is_member: boolean; left_at: string | null }

/** A servant's own profile: the name and photo shown in the sidebar. */
export type Profile = { display_name: string | null; photo: string | null }
