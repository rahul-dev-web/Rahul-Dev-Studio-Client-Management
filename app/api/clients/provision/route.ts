import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "../../../../lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function generateTemporaryPassword() { return randomBytes(12).toString("base64url"); }
function generateClientCode() { return `RDSC-${randomBytes(4).toString("hex").toUpperCase()}`; }

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const agreementId = typeof body?.agreementId === "string" ? body.agreementId : "";
    if (!agreementId) return NextResponse.json({ error: "agreementId is required." }, { status: 400 });

    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profileError || profile?.role !== "developer") return NextResponse.json({ error: "Developer authorization required." }, { status: 403 });

    const { data: agreement, error: agreementError } = await supabase
      .from("agreements")
      .select("id, status, client_id, deal_id")
      .eq("id", agreementId)
      .single();
    if (agreementError || !agreement) return NextResponse.json({ error: "Agreement not found." }, { status: 404 });
    if (agreement.status !== "executed") return NextResponse.json({ error: "Client access can only be provisioned after the agreement is executed." }, { status: 409 });

    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .select("id, developer_id, client_id, client_name, client_email, organization")
      .eq("id", agreement.deal_id)
      .single();
    if (dealError || !deal || deal.developer_id !== user.id) return NextResponse.json({ error: "Deal not found or not owned by the current developer." }, { status: 404 });
    if (deal.client_id && agreement.client_id && deal.client_id !== agreement.client_id) return NextResponse.json({ error: "Agreement and deal client ownership do not match." }, { status: 409 });

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!serviceRoleKey || !supabaseUrl) return NextResponse.json({ error: "Server Supabase credentials are not configured." }, { status: 500 });

    const admin = createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
    const email = deal.client_email.trim().toLowerCase();
    const temporaryPassword = generateTemporaryPassword();
    let clientUserId = agreement.client_id || deal.client_id || "";

    if (clientUserId) {
      const { data: existing, error } = await admin.auth.admin.getUserById(clientUserId);
      if (error || !existing.user) return NextResponse.json({ error: "The linked client account could not be found." }, { status: 409 });
      if ((existing.user.email || "").toLowerCase() !== email) return NextResponse.json({ error: "The linked client account email does not match the deal." }, { status: 409 });
      const { error: updateError } = await admin.auth.admin.updateUserById(clientUserId, { password: temporaryPassword, email_confirm: true });
      if (updateError) throw updateError;
    } else {
      const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (usersError) throw usersError;
      const existing = usersData.users.find((candidate) => (candidate.email || "").toLowerCase() === email);
      if (existing) {
        clientUserId = existing.id;
        const { data: existingProfile } = await admin.from("profiles").select("role").eq("id", clientUserId).maybeSingle();
        if (existingProfile?.role === "developer") return NextResponse.json({ error: "This email belongs to a developer account and cannot be provisioned as a client." }, { status: 409 });
        const { error: updateError } = await admin.auth.admin.updateUserById(clientUserId, { password: temporaryPassword, email_confirm: true });
        if (updateError) throw updateError;
      } else {
        const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password: temporaryPassword, email_confirm: true, user_metadata: { full_name: deal.client_name, organization: deal.organization, role: "client" } });
        if (createError || !created.user) throw createError || new Error("Unable to create client account.");
        clientUserId = created.user.id;
      }
    }

    const { data: currentProfile } = await admin.from("profiles").select("client_code").eq("id", clientUserId).maybeSingle();
    const clientCode = currentProfile?.client_code || generateClientCode();
    const { error: profileUpsertError } = await admin.from("profiles").upsert({ id: clientUserId, role: "client", full_name: deal.client_name, client_code: clientCode, must_change_password: true }, { onConflict: "id" });
    if (profileUpsertError) throw profileUpsertError;

    const { error: dealUpdateError } = await admin.from("deals").update({ client_id: clientUserId }).eq("id", deal.id);
    if (dealUpdateError) throw dealUpdateError;
    const { error: agreementUpdateError } = await admin.from("agreements").update({ client_id: clientUserId }).eq("id", agreement.id);
    if (agreementUpdateError) throw agreementUpdateError;

    const { data: project } = await admin.from("projects").select("id, client_id").eq("agreement_id", agreement.id).maybeSingle();
    if (project) {
      const { error: projectUpdateError } = await admin.from("projects").update({ client_id: clientUserId }).eq("id", project.id);
      if (projectUpdateError) throw projectUpdateError;
    }

    return NextResponse.json({ clientId: clientCode, email, temporaryPassword, mustChangePassword: true, message: "Client portal credentials generated. Show the temporary password to the client once and require a password change on first login." });
  } catch (error) {
    console.error("Client provisioning failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to provision client portal." }, { status: 500 });
  }
}
