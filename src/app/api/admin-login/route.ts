import { NextResponse } from "next/server";
import { adminSessionVersion } from "../../../../lib/adminSession"; // import global session version

// POST handler to verify admin credentials and set the "isAdmin" cookie
export async function POST(request: Request) {
  try {
    // Parse the incoming JSON with admin credentials
    const { adminName, adminPassword } = await request.json();

    // Compare with expected credentials stored in environment variables
    const expectedAdminName = process.env.ADMIN_USERNAME;
    const expectedAdminPassword = process.env.ADMIN_PASSWORD;

    if (adminName === expectedAdminName && adminPassword === expectedAdminPassword) {
      const response = NextResponse.json({ success: true }, { status: 200 });
      // Set the admin cookie with the current session version (e.g. "true-1")
      response.cookies.set("isAdmin", `true-${adminSessionVersion}`, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/",
      });
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
