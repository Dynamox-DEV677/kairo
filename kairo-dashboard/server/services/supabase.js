/**
 * Supabase Client — singleton for the entire backend
 *
 * Two clients:
 *  supabase        — anon key (respects RLS, used for user-scoped ops)
 *  supabaseAdmin   — service role key (bypasses RLS, used for admin ops)
 */
import { createClient } from '@supabase/supabase-js'

// Support both SUPABASE_URL and VITE_SUPABASE_URL (whichever is set)
const SUPABASE_URL  = process.env.SUPABASE_URL      || process.env.VITE_SUPABASE_URL
const ANON_KEY      = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY

// True only when real credentials are present (not placeholders)
export const SUPABASE_CONFIGURED =
  !!SUPABASE_URL &&
  !!ANON_KEY &&
  !SUPABASE_URL.includes('placeholder')

if (!SUPABASE_CONFIGURED) {
  console.warn('⚠️  SUPABASE_URL / SUPABASE_ANON_KEY not set — v4 multi-tenant routes will return 503.')
  console.warn('   Copy .env.example → .env and fill in your Supabase project credentials.')
}

/**
 * Express middleware — returns 503 immediately if Supabase is not configured.
 * Apply at the top of any router that talks to Supabase.
 */
export function requireSupabase(req, res, next) {
  if (!SUPABASE_CONFIGURED) {
    return res.status(503).json({
      error: 'Supabase is not configured on this server.',
      hint:  'Add SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY to your .env file.',
      docs:  'https://app.supabase.com → Project Settings → API',
    })
  }
  next()
}

// Public client — honours RLS
export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  ANON_KEY     || 'placeholder',
  { auth: { persistSession: false } }
)

// Admin client — bypasses RLS (use only in trusted server code)
export const supabaseAdmin = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SERVICE_KEY  || ANON_KEY || 'placeholder',
  { auth: { persistSession: false, autoRefreshToken: false } }
)

/**
 * Create a Supabase client that acts as an authenticated user.
 * Pass the JWT from the Authorization header.
 */
export function supabaseForUser(jwt) {
  return createClient(
    SUPABASE_URL || 'https://placeholder.supabase.co',
    ANON_KEY     || 'placeholder',
    {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    }
  )
}
