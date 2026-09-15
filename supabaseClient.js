// src/supabaseClient.js
//
// ВАЖНО: тук се ползва анонимният ("anon" / "publishable") ключ, НЕ service_role!
// Anon ключът е предназначен да стои в публичен frontend код — той има само
// правата, които сме дали чрез "public read" policy-тата в схемата (само четене).
// service_role ключът НИКОГА не бива да е тук — той е само за GitHub бота.

import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
