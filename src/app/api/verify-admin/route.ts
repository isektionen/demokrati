import { NextResponse, NextRequest } from "next/server";
import { adminSessionVersion } from "../../../../lib/adminSession";

// GET handler verifies the admin cookie value.
export async function GET(request: NextRequest) {
  const isAdminCookie = request.cookies.get("isAdmin")?.value;
  if (isAdminCookie && isAdminCookie.startsWith("true-")) {
    // Extract the stored session version from the cookie.
    const cookieVersion = parseInt(isAdminCookie.split("-")[1]);
    // Accept only if cookie's version matches the current global version.
    if (cookieVersion === adminSessionVersion) {
      return NextResponse.json({ valid: true });
    }
  }
  return NextResponse.json({ valid: false }, { status: 401 });
}

// Ensure the file is a module
export {};
