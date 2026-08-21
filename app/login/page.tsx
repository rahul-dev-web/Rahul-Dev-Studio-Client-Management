"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, CheckCircle2, KeyRound, LockKeyhole, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { createClient } from "../../lib/supabase/browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage(""); setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError || !data.user) { setError(signInError?.message || "Unable to sign in. Please check your credentials."); setLoading(false); return; }
      const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
      if (profileError) { await supabase.auth.signOut(); setError("Your account is authenticated, but its workspace role could not be verified."); setLoading(false); return; }
      if (profile?.role === "client") { window.location.href = "/client"; return; }
      if (profile?.role === "developer") { window.location.href = "/"; return; }
      await supabase.auth.signOut(); setError("This account does not have an authorized workspace role yet.");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to sign in."); }
    finally { setLoading(false); }
  }

  async function sendReset() {
    setError(""); setMessage("");
    if (!email.trim()) return setError("Enter your account email first.");
    setResetting(true);
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
    if (resetError) setError(resetError.message); else setMessage("If an account exists for this email, a password-reset link has been sent.");
    setResetting(false);
  }

  return <main className="auth-shell auth-premium">
    <div className="auth-grid-lines" aria-hidden="true" /><div className="auth-orb auth-orb-one" aria-hidden="true" /><div className="auth-orb auth-orb-two" aria-hidden="true" />
    <section className="auth-login-layout">
      <aside className="auth-showcase">
        <div className="auth-showcase-top"><div className="brand-mark auth-mark">R</div><span className="auth-live"><i /> PRIVATE WORKSPACE</span></div>
        <div className="auth-showcase-copy"><div className="auth-showcase-kicker"><Sparkles size={14}/> RAHUL DEVELOPMENT STUDIO</div><h2>Every deal.<br/><span>One secure workspace.</span></h2><p>Manage agreements, client approvals and project delivery from one focused command center.</p></div>
        <div className="auth-feature-stack"><div><span className="auth-feature-icon"><ShieldCheck size={17}/></span><span><strong>Private by design</strong><small>Role-based access powered by Supabase Auth</small></span></div><div><span className="auth-feature-icon"><CheckCircle2 size={17}/></span><span><strong>Deal to delivery</strong><small>Agreements, signatures and progress in one flow</small></span></div></div>
        <div className="auth-showcase-footer"><span>RDS</span><span>•</span><span>CLIENT MANAGEMENT PORTAL</span></div>
      </aside>
      <section className="auth-card auth-card-premium">
        <div className="auth-brand-row"><div className="brand-mark auth-mark mobile-brand-mark">R</div><div><strong>Rahul Development Studio</strong><span>Secure client management</span></div></div>
        <div className="auth-icon"><LockKeyhole size={19}/></div><div className="eyebrow">WELCOME BACK</div><h1>Sign in to your workspace</h1><p className="auth-copy">Use your authorized account to continue to your developer or client portal.</p>
        <form className="auth-form" onSubmit={handleSubmit}><label>Email address<div className="input-wrap"><Mail size={16}/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required/></div></label><label>Password<div className="input-wrap"><LockKeyhole size={16}/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" required/></div></label>{error && <p className="form-error">{error}</p>}{message && <p className="auth-success"><CheckCircle2 size={15}/>{message}</p>}<button className="btn primary auth-submit" disabled={loading}>{loading ? "Signing in…" : "Continue securely"}<ArrowRight size={15}/></button></form>
        <button className="auth-forgot" type="button" disabled={resetting} onClick={sendReset}><KeyRound size={14}/>{resetting ? "Sending reset link…" : "Forgot password? Send reset link"}</button><div className="auth-security-note"><LockKeyhole size={14}/><span>Authentication is handled securely by Supabase Auth. Your password is never stored in the application database.</span></div>
      </section>
    </section>
  </main>;
}
