import { createClient } from "@supabase/supabase-js";

// Retrieve Supabase credentials from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

// Export the client so it can be reused across the project
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
