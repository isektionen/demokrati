import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Use your actual project’s URL and ANON key
const SUPABASE_URL = "https://qegwcetrhbaaplkaeppd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlZ3djZXRyaGJhYXBsa2FlcHBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg3ODY4MTYsImV4cCI6MjA1NDM2MjgxNn0.M7CZVaull1RQgKSSAduoY5ZAuR7000L2PUB6Go8a-us";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// We’ll handle POST requests to /api/check-email
export async function POST(request: Request) {
  try {
    // 1) Parse the incoming JSON { email: string }
    const { email } = await request.json();

    // 2) Query the "emails" table to see if that row exists
    const { data, error } = await supabase
      .from("emails")
      .select("*")
      .eq("email", email);

    // 3) Handle potential errors from Supabase
    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { valid: false, error: "Database error occurred." },
        { status: 500 }
      );
    }

    // 4) If data length > 0, the email is found
    if (data && data.length > 0) {
      return NextResponse.json({ valid: true }, { status: 200 });
    } else {
      // Not found in the emails table
      return NextResponse.json(
        { valid: false, error: "Email not found in the list." },
        { status: 404 }
      );
    }
  } catch (err) {
    console.error("Error parsing request:", err);
    return NextResponse.json(
      { valid: false, error: "Bad request." },
      { status: 400 }
    );
  }
}
