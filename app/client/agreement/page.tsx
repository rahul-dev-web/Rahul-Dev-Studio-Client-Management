"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Download, FileSignature, ShieldCheck } from "lucide-react";
import { createClient } from "../../../lib/supabase/browser";

type Agreement = { id: string; agreement_code: string; status: string; version: number; created_at: string; deal_id: string };
type Deal = { deal_code: string; client_name: string; organization: string | null; project_name: string; project_type: string; project_description: string | null; technology: string | null; start_date: string | null; expected_delivery_date: string | null; total_amount: number; advance_amount: number; remaining_amount: number; payment_schedule: string | null; revision_rounds: number; support_days: number };
type Item = { title: string; item_order: number };
type Document = { storage_path: string; version: number; generated_at: string };

const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);
const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)) : "TBD";
const label = (value: string) => value.replaceAll("_", " ");

export default function ClientAgreementPage() {
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [deal, setDeal] = useState<Deal | null>(null);
  const [scope, setScope] = useState<Item[]>([]);
  const [deliverables, setDeliverables] = useState<Item[]>([]);
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const s = createClient();
      const { data: { user } } = await s.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }

      // Resolve the agreement only through the authenticated client's own project.
      // No developer agreement ID is accepted from the URL or client input.
      const { data: project, error: projectError } = await s
        .from("projects")
        .select("agreement_id")
        .eq("client_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (projectError || !project?.agreement_id) {
        setError(projectError?.message || "No agreement is linked to your project.");
        setLoading(false);
        return;
      }

      const { data: a, error: agreementError } = await s
        .from("agreements")
        .select("id,agreement_code,status,version,created_at,deal_id")
        .eq("id", project.agreement_id)
        .single();

      if (agreementError || !a) {
        setError(agreementError?.message || "Agreement not available.");
        setLoading(false);
        return;
      }

      const [{ data: d }, { data: sc }, { data: de }, { data: doc }] = await Promise.all([
        s.from("deals").select("deal_code,client_name,organization,project_name,project_type,project_description,technology,start_date,expected_delivery_date,total_amount,advance_amount,remaining_amount,payment_schedule,revision_rounds,support_days").eq("id", a.deal_id).single(),
        s.from("deal_scope").select("title,item_order").eq("deal_id", a.deal_id).order("item_order"),
        s.from("deal_deliverables").select("title,item_order").eq("deal_id", a.deal_id).order("item_order"),
        s.from("agreement_documents").select("storage_path,version,generated_at").eq("agreement_id", a.id).order("version", { ascending: false }).limit(1).maybeSingle(),
      ]);

      setAgreement(a);
      setDeal(d || null);
      setScope(sc || []);
      setDeliverables(de || []);
      setDocument(doc || null);
      setLoading(false);
    })();
  }, []);

  async function openPdf() {
    if (!document) return;
    const s = createClient();
    const { data, error } = await s.storage.from("signed-agreements").createSignedUrl(document.storage_path, 3600);
    if (error || !data?.signedUrl) { setError(error?.message || "Unable to open the final document."); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  if (loading) return <div className="auth-shell"><div className="panel">Loading your agreement…</div></div>;
  if (error || !agreement || !deal) return <div className="auth-shell"><div className="panel"><div className="eyebrow">CLIENT PORTAL</div><h1>Agreement unavailable</h1><div className="form-error">{error || "Agreement not available."}</div><a className="btn" href="/client">Back to portal</a></div></div>;

  return <main className="client-shell">
    <header className="client-header"><div className="brand"><div className="brand-mark">R</div><div><div className="brand-title">Rahul Development Studio</div><div className="brand-subtitle">Private Client Portal</div></div></div><a className="btn" href="/client"><ArrowLeft size={15}/> Back to portal</a></header>
    <div className="client-main agreement-main">
      <div className="detail-topbar"><div><div className="eyebrow">YOUR AGREEMENT</div><h1>{deal.project_name}</h1><p className="page-copy">{agreement.agreement_code} · Version {agreement.version}</p></div><div className="detail-actions"><span className={`status status-${agreement.status}`}>{label(agreement.status)}</span>{document && <button className="btn" onClick={openPdf}><Download size={15}/> Open final PDF</button>}</div></div>
      <div className="success-banner"><CheckCircle2 size={15}/> This is your private, read-only agreement record.</div>
      <div className="agreement-layout"><section className="agreement-paper"><div className="agreement-header"><div><div className="agreement-brand">RAHUL DEVELOPMENT STUDIO</div><h2>PROJECT DEVELOPMENT AGREEMENT</h2></div><div className="agreement-badge">{agreement.status.toUpperCase()} · v{agreement.version}</div></div>
        <div className="agreement-meta"><Meta label="Agreement ID" value={agreement.agreement_code}/><Meta label="Deal ID" value={deal.deal_code}/><Meta label="Client" value={deal.client_name}/><Meta label="Project" value={deal.project_name}/></div>
        <Section title="1. Parties"><p>This Project Development Agreement is entered into between <strong>Rahul Development Studio</strong> and <strong>{deal.client_name}</strong>{deal.organization ? ` (${deal.organization})` : ""} for <strong>{deal.project_name}</strong>.</p></Section>
        <Section title="2. Project Scope"><p>{deal.project_description || "The project will be developed according to the agreed scope and deliverables."}</p><p>Project type: <strong>{deal.project_type}</strong>. Technology: <strong>{deal.technology || "As mutually agreed"}</strong>.</p></Section>
        <Section title="3. Commercial Terms"><Info items={[["Total project amount", money(deal.total_amount)], ["Advance", money(deal.advance_amount)], ["Remaining", money(deal.remaining_amount)], ["Payment schedule", deal.payment_schedule || "As mutually agreed"]]}/></Section>
        <Section title="4. Timeline & Support"><Info items={[["Start date", formatDate(deal.start_date)], ["Expected delivery", formatDate(deal.expected_delivery_date)], ["Revision rounds", String(deal.revision_rounds)], ["Bug-fix support", `${deal.support_days} days`]]}/></Section>
        <Section title="5. Scope & Deliverables"><div className="two-list"><div><strong>Scope</strong>{scope.length ? scope.map((x) => <p key={x.item_order}>• {x.title}</p>) : <p>As agreed in project brief.</p>}</div><div><strong>Deliverables</strong>{deliverables.length ? deliverables.map((x) => <p key={x.item_order}>• {x.title}</p>) : <p>As agreed in project brief.</p>}</div></div></Section>
        <div className="declaration"><strong>Client Declaration</strong><p>This agreement has been finalized and is retained as a read-only record in your private portal.</p></div>
        <div className="signature-placeholder"><div>CLIENT SIGNATURE<span>{agreement.status === "executed" ? "Signed" : "Recorded"}</span></div><div>DEVELOPER COUNTERSIGN<span>{agreement.status === "executed" ? "Executed" : "Pending"}</span></div></div>
      </section>
      <aside className="agreement-actions panel"><div className="panel-title"><ShieldCheck size={16}/> Secure document</div><p className="page-copy">This page is available only inside your authenticated client portal.</p><div className="portal-card-row"><span>Status</span><strong>{label(agreement.status)}</strong></div><div className="portal-card-row"><span>Created</span><strong>{formatDate(agreement.created_at)}</strong></div>{document ? <button className="btn primary" onClick={openPdf}><Download size={15}/> Open final signed PDF</button> : <div className="empty-state"><FileSignature size={16}/> Final document is being prepared.</div>}</aside>
      </div>
    </div>
  </main>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="agreement-section"><h3>{title}</h3>{children}</section>; }
function Meta({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function Info({ items }: { items: [string, string][] }) { return <div className="agreement-info">{items.map(([k, v]) => <div key={k}><span>{k}</span><strong>{v}</strong></div>)}</div>; }
