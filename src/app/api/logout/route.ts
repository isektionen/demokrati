import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabase } from "../../../../lib/supabaseClient";

// POST handler clears authentication cookies and invalidates the session token.
export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get("sessionToken")?.value;

  if (sessionToken) {
    // Invalidate the session token in the database
    await supabase
      .from("emails")
      .update({ session_token: null })
      .eq("session_token", sessionToken);
  }

  const response = NextResponse.json({ success: true });
  // Clear cookies by setting maxAge to 0
  response.cookies.set("sessionToken", "", { maxAge: 0, path: "/" });
  response.cookies.set("isAdmin", "", { maxAge: 0, path: "/" });
  return response;
}

export { };
