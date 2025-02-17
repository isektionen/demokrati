import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { adminName, adminPassword } = await request.json();

    const expectedAdminName = process.env.ADMIN_USERNAME;
    const expectedAdminPassword = process.env.ADMIN_PASSWORD;

    if (adminName === expectedAdminName && adminPassword === expectedAdminPassword) {
      const response = NextResponse.json({ success: true }, { status: 200 });
      response.cookies.set("isAdmin", "true", {
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
