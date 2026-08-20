import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];
const PUBLIC_PREFIXES = ["/agreement"];
const CLIENT_ONLY_PREFIXES = ["/client"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    },
  );

  const pathname = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.includes(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  const { data: { user } } = await supabase.auth.getUser();

  // Agreement review/sign links are intentionally public and use their own
  // server-side token/RPC authorization. They must not require a portal session.
  if (isPublic) {
    if (user && pathname === "/login") {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      return NextResponse.redirect(new URL(profile?.role === "client" ? "/client" : "/", request.url));
    }
    return response;
  }

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Authorization is enforced here as a routing boundary, while Supabase RLS
  // remains the real data-access boundary. Never trust this check alone.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.role) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=profile", request.url));
  }

  const isClientRoute = CLIENT_ONLY_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (profile.role === "client" && !isClientRoute) {
    return NextResponse.redirect(new URL("/client", request.url));
  }

  if (profile.role === "developer" && isClientRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
