import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Retrieve Supabase credentials from environment variables
const SUPABASE_URL: string = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY: string = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
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
      const response = NextResponse.json({ valid: true }, { status: 200 });
      response.cookies.set("userEmail", email, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/",
      });
      return response;
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
