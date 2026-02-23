import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  const { pathname } = req.nextUrl;

  // Redirect to login page if user is not logged in
  if (!token && pathname !== "/login"){
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // if logged in block login
  if (token && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"], // applies only to /admin/*
};