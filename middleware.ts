import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Her istekte oturumu yeniler; giriş yapmamış kullanıcıyı /giris'e yönlendirir.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response; // kurulum eksikse sayfa kendi uyarısını gösterir

  const sb = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await sb.auth.getUser();
  const path = request.nextUrl.pathname;
  const isPublic = path.startsWith("/giris") || path.startsWith("/api/tcmb");

  if (!user && !isPublic) {
    const to = request.nextUrl.clone();
    to.pathname = "/giris";
    to.search = "";
    return NextResponse.redirect(to);
  }
  if (user && path.startsWith("/giris")) {
    const to = request.nextUrl.clone();
    to.pathname = "/";
    to.search = "";
    return NextResponse.redirect(to);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo-white.png|.*\\.(?:png|jpg|svg|ico)$).*)"],
};
