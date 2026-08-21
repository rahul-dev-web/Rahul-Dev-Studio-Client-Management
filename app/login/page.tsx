"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, CheckCircle2, KeyRound, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { createClient } from "../../lib/supabase/browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }
    window.location.href = "/";
  }

  async function sendReset() {
    setError("");
    setMessage("");
    if (!email.trim()) return setError("Enter your account email first.");
    setResetting(true);
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (resetError) setError(resetError.message);
    else setMessage("If an account exists for this email, a password-reset link has been sent.");
    setResetting(false);
  }

  return <main className="auth-shell auth-premium">
    <div className="auth-glow" />
    <section className="auth-card auth-card-premium">
      <div className="auth-brand-row"><div className="brand-mark auth-mark">R</div><div><strong>Rahul Development Studio</strong><span>Secure client management</span></div></div>
      <div className="auth-icon"><ShieldCheck size={20}/></div>
      <div className="eyebrow">PRIVATE WORKSPACE</div>
      <h1>Welcome back.</h1>
      <p className="auth-copy">Sign in to your authorized developer workspace or client project portal.</p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label>Email<div className="input-wrap"><Mail size={16}/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required/></div></label>
        <label>Password<div className="input-wrap"><LockKeyhole size={16}/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your password" autoComplete="current-password" required/></div></label>
        {error && <p className="form-error">{error}</p>}
        {message && <p className="auth-success"><CheckCircle2 size={15}/>{message}</p>}
        <button className="btn primary auth-submit" disabled={loading}>{loading?"Signing in…":"Sign in securely"}<ArrowRight size={15}/></button>
      </form>

      <button className="auth-forgot" type="button" disabled={resetting} onClick={sendReset}><KeyRound size={14}/>{resetting?"Sending reset link…":"Forgot password? Send reset link"}</button>
      <div className="auth-security-note"><LockKeyhole size={14}/><span>Password authentication is handled by Supabase Auth. Passwords are never stored in your application database.</span></div>
    </section>
  </main>;
}
