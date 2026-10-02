import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession, safeReturnPath } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = await getSession(request.headers.get("cookie"));

  if (pathname === "/sign-in") {
    if (!session) {
      return NextResponse.next();
    }

    const destination = safeReturnPath(
      request.nextUrl.searchParams.get("return_to"),
    );
    return NextResponse.redirect(new URL(destination, request.url));
  }

  if (session) {
    return NextResponse.next();
  }

  const signIn = new URL("/sign-in", request.url);

  if (pathname !== "/") {
    signIn.searchParams.set("return_to", `${pathname}${search}`);
  }

  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
