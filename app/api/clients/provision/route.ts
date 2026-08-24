import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const agreementId = typeof body?.agreementId === "string" ? body.agreementId : "";
    if (!agreementId) return NextResponse.json({ error: "agreementId is required." }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profileError || profile?.role !== "developer") return NextResponse.json({ error: "Developer authorization required." }, { status: 403 });

    const { data, error } = await supabase.functions.invoke("provision-client-portal", { body: { agreementId } });
    if (error) {
      console.error("Client provisioning Edge Function failed", error);
      return NextResponse.json({ error: error.message || "Unable to provision client portal." }, { status: 502 });
    }
    if (data?.error) return NextResponse.json({ error: data.error }, { status: 400 });
    return NextResponse.json(data);
  } catch (error) {
    console.error("Client provisioning failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to provision client portal." }, { status: 500 });
  }
}
