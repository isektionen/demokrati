import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client specific for this API
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// POST handler to verify if an email exists in the "emails" table
export async function POST(request: Request) {
  try {
    // Parse incoming JSON with an email property
    const { email } = await request.json();

    // Query the "emails" table for the provided email
    const { data, error } = await supabase
      .from("emails")
      .select("*")
      .eq("email", email);

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { valid: false, error: "Database error occurred." },
        { status: 500 }
      );
    }

    // If email exists, set a secure "userEmail" cookie
    if (data && data.length > 0) {
      const response = NextResponse.json({ valid: true }, { status: 200 });
      response.cookies.set("userEmail", email, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/",
      });
      return response;
    } else {
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
