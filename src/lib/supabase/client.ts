"use client";

import { createBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@/lib/env/client";

export function createSupabaseBrowserClient() {
  if (!clientEnv.NEXT_PUBLIC_SUPABASE_URL || !clientEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Supabase n'est pas configuré.");
  }
  return createBrowserClient(clientEnv.NEXT_PUBLIC_SUPABASE_URL, clientEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
