import { NextResponse } from "next/server";
import { incrementAdminSession } from "../../../../lib/adminSession";

// POST handler to log out ALL admins by invalidating their session cookies.
export async function POST() {
  incrementAdminSession();
  return NextResponse.json({ success: true });
}

export {};
