import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// POST handler to verify admin credentials
export async function POST(request: Request) {
  try {
    const { adminName, adminPassword } = await request.json();
    console.log("\n🔹 Login attempt for:", adminName);

    // Fetch admin credentials from Supabase
    const { data: admin, error } = await supabase
      .from("admins")
      .select("username, password, privileges")
      .eq("username", adminName)
      .single();

    if (error) {
      console.error("\n❌ Supabase Error:", error.message);
      return NextResponse.json({ success: false, message: "Database error" }, { status: 500 });
    }

    if (!admin) {
      console.log("\n❌ No matching admin found in Supabase");
      return NextResponse.json({ success: false, message: "Invalid admin credentials" }, { status: 401 });
    }

    console.log("\n✅ Admin found in Supabase:", admin);

    // Compare plain text password (⚠️ Security Risk: Will be replaced with hashing later)
    if (adminPassword !== admin.password) {
      console.log("\n❌ Incorrect password");
      return NextResponse.json({ success: false, message: "Invalid admin credentials" }, { status: 401 });
    }

    console.log("\n✅ Password matched! Logging in admin...");

    // Set authentication cookies
    const response = NextResponse.json({ success: true, privileges: admin.privileges }, { status: 200 });
    response.cookies.set("isAdmin", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    response.cookies.set("adminPrivileges", admin.privileges, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("❌ Error processing admin login:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
