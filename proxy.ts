import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/reset-password"];
const PUBLIC_PREFIXES = ["/agreement"];
const CLIENT_ONLY_PREFIXES = ["/client"];
const PASSWORD_CHANGE_PATH = "/client/change-password";
const DEVELOPER_AGREEMENT_PREFIX = "/agreements";

function getSupabaseConfig() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export async function proxy(request: NextRequest) {
  const { url: supabaseUrl, key: supabaseKey } = getSupabaseConfig();
  if (!supabaseUrl || !supabaseKey) return new NextResponse("Supabase configuration is missing.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const pathname = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.includes(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const { data: { user } } = await supabase.auth.getUser();

  if (isPublic) {
    if (user && pathname === "/login") {
      const { data: profile } = await supabase.from("profiles").select("role,must_change_password").eq("id", user.id).maybeSingle();
      if (profile?.role === "client") return NextResponse.redirect(new URL(profile.must_change_password ? PASSWORD_CHANGE_PATH : "/client", request.url));
      return NextResponse.redirect(new URL("/", request.url));
    }
    return response;
  }

  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const { data: profile, error: profileError } = await supabase.from("profiles").select("role,must_change_password").eq("id", user.id).maybeSingle();
  if (profileError || !profile?.role) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=profile", request.url));
  }

  const isClientRoute = CLIENT_ONLY_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const isDeveloperAgreementRoute = pathname === DEVELOPER_AGREEMENT_PREFIX || pathname.startsWith(`${DEVELOPER_AGREEMENT_PREFIX}/`);

  if (profile.role === "client") {
    // A client must never render a developer workspace page. Old/stale client
    // links to /agreements/:id are mapped to the dedicated read-only portal view.
    if (isDeveloperAgreementRoute && pathname !== "/agreements") return NextResponse.redirect(new URL("/client/agreement", request.url));
    if (!isClientRoute) return NextResponse.redirect(new URL(profile.must_change_password ? PASSWORD_CHANGE_PATH : "/client", request.url));
    if (profile.must_change_password && pathname !== PASSWORD_CHANGE_PATH) return NextResponse.redirect(new URL(PASSWORD_CHANGE_PATH, request.url));
    if (!profile.must_change_password && pathname === PASSWORD_CHANGE_PATH) return NextResponse.redirect(new URL("/client", request.url));
    return response;
  }

  if (profile.role === "developer" && isClientRoute) return NextResponse.redirect(new URL("/", request.url));
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
