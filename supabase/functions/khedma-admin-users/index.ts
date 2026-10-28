// Supabase Edge Function: khedma-admin-users
// Lets an admin create, edit and delete accounts. Runs on Supabase's servers, so the
// service-role key (SUPABASE_SERVICE_ROLE_KEY, provided automatically) never reaches the browser.
//
// Deploy: Supabase Dashboard → Edge Functions → Deploy a new function → Via Editor,
// name it exactly "khedma-admin-users", paste this file, Deploy.

import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  // Who is calling? Only admins get past this point.
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const { data: caller } = await admin.auth.getUser(token)
  if (caller.user?.app_metadata?.role !== 'admin') return json({ error: 'Admins only' }, 403)

  let body: { action?: string; id?: string; email?: string; password?: string; admin?: boolean }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Bad request' }, 400)
  }

  const audit = (action: string, id: string, data: Record<string, unknown>) =>
    admin
      .schema('khedma')
      .from('audit_log')
      .insert({ user_id: caller.user!.id, user_email: caller.user!.email, action, table_name: 'users', record_id: id, new_data: data })

  // Accounts are shared with bishoy-saber-notes in this Supabase project. Never delete such an
  // account or change its email / password from here — that would break the other app.
  const isShared = async (id: string) => {
    const { data, error } = await admin.schema('khedma').rpc('is_shared_account', { p_user: id })
    return error ? true : data === true // unsure → treat as shared, i.e. refuse
  }
  const SHARED = 'This account is also used by another app in this project — it cannot be deleted or have its email / password changed here.'

  switch (body.action) {
    case 'create': {
      if (!body.email || !body.password) return json({ error: 'Email and password are required' }, 400)
      const { data, error } = await admin.auth.admin.createUser({
        email: body.email.trim(),
        password: body.password,
        email_confirm: true,
        app_metadata: body.admin ? { role: 'admin' } : {},
        user_metadata: { app: 'khedma_2027' }, // puts it on Khedma's list of accounts
      })
      if (error) return json({ error: error.message }, 400)
      await admin.schema('khedma').from('app_users').upsert({ user_id: data.user.id })
      await audit('user_create', data.user.id, { email: data.user.email, admin: !!body.admin })
      return json({ id: data.user.id })
    }

    case 'update': {
      if (!body.id) return json({ error: 'id is required' }, 400)
      if (body.id === caller.user!.id && body.admin === false) return json({ error: 'You cannot remove your own admin role' }, 400)
      if ((body.email || body.password) && (await isShared(body.id))) return json({ error: SHARED }, 403)
      const changes: Record<string, unknown> = {}
      if (body.email) changes.email = body.email.trim()
      if (body.password) changes.password = body.password
      if (typeof body.admin === 'boolean') changes.app_metadata = { role: body.admin ? 'admin' : null }
      const { error } = await admin.auth.admin.updateUserById(body.id, changes)
      if (error) return json({ error: error.message }, 400)
      // Never log the password itself.
      await audit('user_update', body.id, { email: body.email, admin: body.admin, password_changed: !!body.password })
      return json({ ok: true })
    }

    case 'delete': {
      if (!body.id) return json({ error: 'id is required' }, 400)
      if (body.id === caller.user!.id) return json({ error: 'You cannot delete your own account' }, 400)
      if (await isShared(body.id)) return json({ error: SHARED }, 403)
      const { error } = await admin.auth.admin.deleteUser(body.id)
      if (error) return json({ error: error.message }, 400)
      await audit('user_delete', body.id, {})
      return json({ ok: true })
    }

    default:
      return json({ error: 'Unknown action' }, 400)
  }
})
