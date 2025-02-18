import { NextResponse, NextRequest } from "next/server";

// GET handler verifies the admin cookie value.
export async function GET(request: NextRequest) {
  const isAdminCookie = request.cookies.get("isAdmin")?.value;
  let adminPrivileges = request.cookies.get("adminPrivileges")?.value || "";

  if (!["", "all", "valberedning", "results"].includes(adminPrivileges)) {
    adminPrivileges = "";
  }

  if (isAdminCookie === "true") {
    return NextResponse.json({ isAdmin: true, privileges: adminPrivileges });
  }

  return NextResponse.json({ isAdmin: false, privileges: "" }, { status: 401 });
}
