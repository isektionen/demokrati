import { NextResponse, NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const userEmail = request.cookies.get("userEmail")?.value;
  if (userEmail) {
    return NextResponse.json({ valid: true, email: userEmail });
  } else {
    return NextResponse.json({ valid: false }, { status: 401 });
  }
}

// Ensure this file is treated as a module
export {};
