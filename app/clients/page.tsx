"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import { createClient } from "../../lib/supabase/browser";

type Agreement = { id: string; agreement_code: string; status: string; client_id: string | null; deal_id: string; created_at: string };
type Deal = { id: string; project_name: string; client_name: string; client_email: string; organization: string; client_id: string | null };
type Credentials = { clientId: string; email: string; temporaryPassword: string; mustChangePassword: boolean };

export default function ClientsPage() {
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const s = createClient();
    const [{ data: a, error: ae }, { data: d, error: de }] = await Promise.all([
      s.from("agreements").select("id,agreement_code,status,client_id,deal_id,created_at").order("created_at", { ascending: false }),
      s.from("deals").select("id,project_name,client_name,client_email,organization,client_id").order("created_at", { ascending: false }),
    ]);
    if (ae || de) setError(ae?.message || de?.message || "Unable to load clients.");
    setAgreements(a || []);
    setDeals(d || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const rows = useMemo(() => agreements.map((agreement) => ({ agreement, deal: deals.find((deal) => deal.id === agreement.deal_id) })).filter((row) => row.deal), [agreements, deals]);

  async function provision(agreementId: string) {
    setBusy(agreementId);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/clients/provision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agreementId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to provision client portal.");
      setCredentials(data);
      setMessage("Client portal credentials are ready. The temporary password is shown only in this response.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to provision client portal.");
    } finally {
      setBusy("");
    }
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    setMessage("Copied to clipboard.");
  }

  return <div className="shell"><aside className="sidebar"><div className="brand"><div className="brand-mark">R</div><div><div className="brand-title">Rahul Development Studio</div><div className="brand-subtitle">Client Management</div></div></div><nav className="nav"><a className="nav-item" href="/">Dashboard</a><a className="nav-item" href="/agreements">Agreements</a><a className="nav-item" href="/projects">Projects</a><a className="nav-item active" href="/clients">Clients</a><a className="nav-item" href="/completed">Completed</a><a className="nav-item" href="/settings">Settings</a></nav></aside>
    <main className="main"><div className="form-topbar"><div><div className="eyebrow">Client access</div><h1>Clients</h1><p className="page-copy">Provision secure portal credentials only after an agreement has been executed.</p></div><button className="btn" onClick={load} disabled={loading}><RefreshCw size={15}/> Refresh</button></div>
      {message && <div className="success-banner"><ShieldCheck size={15}/>{message}</div>}{error && <div className="form-error deal-error">{error}</div>}
      <section className="panel"><div className="panel-header"><div><div className="panel-title">Client portal access</div><p className="page-copy">Temporary passwords are never stored in the application database; Supabase Auth handles the credential.</p></div></div>
        {loading ? <p className="page-copy">Loading client access records…</p> : !rows.length ? <p className="page-copy">No agreements found yet.</p> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Client</th><th>Project</th><th>Agreement</th><th>Status</th><th>Portal</th></tr></thead><tbody>{rows.map(({ agreement, deal }) => <tr key={agreement.id}><td><strong>{deal!.client_name}</strong><span>{deal!.client_email}</span></td><td><strong>{deal!.project_name}</strong><span>{deal!.organization}</span></td><td><span>{agreement.agreement_code}</span></td><td><span className={`status status-${agreement.status}`}>{agreement.status.replaceAll("_", " ")}</span></td><td>{agreement.status === "executed" ? <button className="btn small" disabled={busy === agreement.id} onClick={() => provision(agreement.id)}><KeyRound size={14}/>{busy === agreement.id ? "Generating…" : agreement.client_id ? "Regenerate access" : "Provision portal"}</button> : <span className="muted">Available after execution</span>}</td></tr>)}</tbody></table></div>}
      </section>
    </main>
    {credentials && <div className="modal-backdrop"><div className="modal panel"><div className="panel-title"><KeyRound size={16}/> Client portal credentials</div><p className="page-copy">Give these credentials to the client securely. The temporary password is intentionally shown only once here.</p><div className="credential-box"><div><span>Client ID</span><strong>{credentials.clientId}</strong><button className="icon-btn" onClick={() => copy(credentials.clientId)} aria-label="Copy client ID"><Copy size={14}/></button></div><div><span>Email</span><strong>{credentials.email}</strong><button className="icon-btn" onClick={() => copy(credentials.email)} aria-label="Copy email"><Copy size={14}/></button></div><div><span>Temporary password</span><strong>{credentials.temporaryPassword}</strong><button className="icon-btn" onClick={() => copy(credentials.temporaryPassword)} aria-label="Copy temporary password"><Copy size={14}/></button></div></div><div className="action-note"><strong>First login:</strong> the client will be required to change this temporary password before accessing the portal.</div><div className="modal-actions"><button className="btn" onClick={() => setCredentials(null)}>Close</button></div></div></div>}
  </div>;
}
