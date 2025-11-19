import { NextResponse, NextRequest } from "next/server";
import { supabase } from "../../../../lib/supabaseClient";

// GET handler verifies if a valid user session token exists.
// If yes, returns the email; otherwise, returns an error status.
export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get("sessionToken")?.value;

  if (!sessionToken) {
    return NextResponse.json({ valid: false }, { status: 401 });
  }

  try {
    const { data, error } = await supabase
      .from("emails")
      .select("email")
      .eq("session_token", sessionToken)
      .single();

    if (error || !data) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    return NextResponse.json({ valid: true, email: data.email });
  } catch {
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}

// Ensure the file is a module
export { };
