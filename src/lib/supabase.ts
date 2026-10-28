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

export type Child = {
  id: number
  full_name: string
  house_number: string | null
  street: string | null
  branch_of_street: string | null
  landmark: string | null
  floor: string | null
  side: string | null
  apartment: string | null
  birth_date: string | null
  mother_mobile: string | null
  father_mobile: string | null
  child_mobile: string | null
  deacon: string | null
  notes: string | null
  national_id: string | null
}
