// Service-role client for use inside Edge Functions only. This key bypasses
// Row Level Security, which is exactly why it must never be shipped in the
// Flutter app - it lives only in Supabase's function environment
// (SUPABASE_SERVICE_ROLE_KEY is auto-provided to every Edge Function).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export function supabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Verifies the caller's JWT (from the Authorization header) and returns
 * their user id. Every function below calls this first - without a valid
 * session, nothing proceeds.
 */
export async function requireUser(req: Request): Promise<{ userId: string }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new HttpError(401, "Missing Authorization header.");

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "Your session has expired. Please sign in again.");
  return { userId: data.user.id };
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
