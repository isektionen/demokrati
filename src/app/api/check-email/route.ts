import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
// import path from "path";
// import { promises as fs } from "fs";

// Initialize Supabase client specific for this API
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// POST handler to verify if an email exists in the "emails" table
export async function POST(request: Request) {
  try {
    // Parse incoming JSON with email and pincode properties
    const { email, pincode } = await request.json();
    // Trim possible whitespace and convert to lower-case
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPincode = pincode.trim();

    // Temporary debug query to print all emails from supabase (for development only)
    if (process.env.USE_FILE_DEBUG == "true") {
      const { data: allData } = await supabase
         .from("emails")
         .select("*");
      console.log("Debug - All emails in table:", allData);
    }

    // Query Supabase for a record with matching email and password
    const { data, error } = await supabase
      .from("emails")
      .select("*")
      .eq("email", trimmedEmail)
      .eq("password", trimmedPincode);

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { valid: false, error: "Database error occurred." },
        { status: 500 }
      );
    }

    // If a matching record exists, set a secure "userEmail" cookie
    if (data && data.length > 0) {
      console.log("User authenticated:", trimmedEmail);
      const response = NextResponse.json({ valid: true }, { status: 200 });
      response.cookies.set("userEmail", trimmedEmail, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/",
      });
      return response;
    } else {
      console.warn("No matching record found for email:", trimmedEmail);
      return NextResponse.json(
        { valid: false, error: "Invalid email or pincode." },
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
