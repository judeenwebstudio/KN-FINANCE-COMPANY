import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const userId = request.auth?.user?.id;
  if (!userId || typeof userId !== "string" || userId.trim() === "") {
    return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(pathname)}`, request.url));
  }
  return NextResponse.next();
});

export const config = { matcher: ["/admin/:path*", "/member/:path*"] };
