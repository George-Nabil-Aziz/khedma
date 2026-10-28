import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — copy .env.example to .env')
}

// Every query goes to the khedma_2027 schema, never to bishoy_saber_notes or public.
export const supabase = createClient(url, key, {
  db: { schema: 'khedma_2027' },
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
export const CORE_FIELDS = ['full_name', ...TEXT_FIELDS, 'phones', 'primary_contact'] as const
export type CoreField = (typeof CORE_FIELDS)[number]

export type ChildInput = {
  full_name: string
  phones: Phone[]
  primary_contact: Owner | null
  extra: Record<string, unknown>
} & { [K in TextField]: string | null }

export type Child = ChildInput & {
  id: number
  client_id: string
  created_at: string
  updated_at: string
}

export type FieldType = 'text' | 'number' | 'date' | 'boolean'
export type CustomField = { key: string; label: string; type: FieldType; position: number }
