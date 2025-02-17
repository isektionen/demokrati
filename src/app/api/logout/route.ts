import { NextResponse } from "next/server";

// POST handler clears authentication cookies to log the user out.
export async function POST() {
  const response = NextResponse.json({ success: true });
  // Clear cookies by setting maxAge to 0
  response.cookies.set("userEmail", "", { maxAge: 0, path: "/" });
  response.cookies.set("isAdmin", "", { maxAge: 0, path: "/" });
  return response;
}

export {};
