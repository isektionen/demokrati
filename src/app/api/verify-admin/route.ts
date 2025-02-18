import { NextResponse, NextRequest } from "next/server";
import { adminSessionVersion } from "../../../../lib/adminSession";

// GET handler verifies the admin cookie value.
export async function GET(request: NextRequest) {
  const isAdminCookie = request.cookies.get("isAdmin")?.value;
  // Read the privilege cookie, convert to lowercase, and default to ""
  let adminPrivileges = (request.cookies.get("adminPrivileges")?.value || "").toLowerCase();

  // Ensure adminPrivileges is only one of: "", "all", "valberedning", or "results"
  if (!["", "all", "valberedning", "results"].includes(adminPrivileges)) {
    adminPrivileges = "";
  }

  // Check if isAdminCookie starts with "true-" (meaning user is admin),
  // and the session version matches the global session version.
  if (isAdminCookie && isAdminCookie.startsWith("true-")) {
    const cookieVersion = parseInt(isAdminCookie.split("-")[1], 10);
    if (cookieVersion === Number(adminSessionVersion)) {
      return NextResponse.json({ isAdmin: true, privileges: adminPrivileges });
    }
  }
  
  // If not an admin or version mismatch, return isAdmin: false with privileges: "".
  return NextResponse.json({ isAdmin: false, privileges: "" }, { status: 401 });
}

// Ensure the file is a module (Next.js requirement)
export {};
