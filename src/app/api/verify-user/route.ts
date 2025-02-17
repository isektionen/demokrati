import { NextResponse, NextRequest } from "next/server";

// GET handler verifies if a valid user cookie exists.
// If yes, returns the email; otherwise, returns an error status.
export async function GET(request: NextRequest) {
  const userEmail = request.cookies.get("userEmail")?.value;
  if (userEmail) {
    return NextResponse.json({ valid: true, email: userEmail });
  } else {
    return NextResponse.json({ valid: false }, { status: 401 });
  }
}

// Ensure the file is a module
export {};
