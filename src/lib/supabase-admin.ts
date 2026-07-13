import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client for the admin API routes ONLY. This key bypasses Row
// Level Security, so it must never be imported into a client component.
// The "server-only" import above makes the build fail if that ever happens.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "artworks";

export function getAdminClient() {
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment."
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
