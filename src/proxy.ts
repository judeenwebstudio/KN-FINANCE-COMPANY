import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((request) => {
  const { pathname } = request.nextUrl;
  if (!request.auth?.user?.id) return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(pathname)}`, request.url));
  return NextResponse.next();
});

export const config = { matcher: ["/admin/:path*", "/member/:path*"] };
