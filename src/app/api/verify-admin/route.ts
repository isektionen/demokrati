import { NextResponse, NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const isAdmin = request.cookies.get("isAdmin")?.value;
  if (isAdmin === "true") {
    return NextResponse.json({ valid: true });
  } else {
    return NextResponse.json({ valid: false }, { status: 401 });
  }
}

// Ensure this file is treated as a module
export {};
