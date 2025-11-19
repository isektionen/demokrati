import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabaseClient";

// POST handler to verify if an email exists in the "emails" table
export async function POST(request: Request) {
  try {
    // Parse incoming JSON with email and pincode properties
    const { email, pincode } = await request.json();
    // Trim possible whitespace and convert to lower-case
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPincode = pincode.trim();

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

    // If a matching record exists, set a secure "sessionToken" cookie
    if (data && data.length > 0) {
      console.log("User authenticated:", trimmedEmail);
      const sessionToken = crypto.randomUUID();

      const { error: updateError } = await supabase
        .from("emails")
        .update({ session_token: sessionToken })
        .eq("email", trimmedEmail);

      if (updateError) {
        console.error("Supabase error during session token update:", updateError);
        return NextResponse.json(
          { valid: false, error: "Failed to create session." },
          { status: 500 }
        );
      }

      const response = NextResponse.json({ valid: true }, { status: 200 });
      response.cookies.set("sessionToken", sessionToken, {
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
