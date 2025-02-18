import { NextResponse } from "next/server";
import { adminSessionVersion } from "../../../../lib/adminSession"; // import global session version

// POST handler to verify admin credentials and set the "isAdmin" cookie
export async function POST(request: Request) {
  try {
    // Parse the incoming JSON with admin credentials
    const { adminName, adminPassword } = await request.json();
    // Log the incoming credentials for debugging (remove in production)
    console.log("\n————— Login attempt:", adminName, " —————\n");

    // Parse admin credentials from env variable (if missing, fallback to single credential)
    let isAuthenticated = false;
    let privileges = "";
    if (process.env.ADMIN_CREDENTIALS) {
      const creds = JSON.parse(process.env.ADMIN_CREDENTIALS);
      for (const cred of creds as Array<{ adminName: string; adminPassword: string; privileges?: string }>) {
        if (cred.adminName === adminName && cred.adminPassword === adminPassword) {
          isAuthenticated = true;
          privileges = cred.privileges || "";
          break;
        }
      }
    }
    console.log("\n————— Authenticated:", isAuthenticated, "Privileges:", privileges, " —————\n");

    if (isAuthenticated) {
      const response = NextResponse.json({ success: true, privileges }, { status: 200 });
      response.cookies.set("isAdmin", `true-${Number(adminSessionVersion)}`, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/",
      });
      // Optionally, set an extra cookie for admin privileges
      if (privileges) {
        response.cookies.set("adminPrivileges", privileges, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          path: "/",
        });
      }
      return response;
    } else {
      return NextResponse.json(
        { success: false, message: "Invalid admin credentials" },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("Error processing admin login:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
