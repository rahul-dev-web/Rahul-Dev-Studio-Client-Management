"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, KeyRound } from "lucide-react";
import { createClient } from "../../lib/supabase/browser";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) setError("This password-reset link is invalid or has expired.");
      else setReady(true);
    });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (password.length < 8) return setError("Use at least 8 characters for your new password.");
    if (password !== confirm) return setError("Passwords do not match.");
    setSaving(true);
    const { error: updateError } = await createClient().auth.updateUser({ password });
    if (updateError) setError(updateError.message);
    else setMessage("Password updated successfully. You can now sign in with your new password.");
    setSaving(false);
  }

  return <main className="auth-shell auth-premium">
    <div className="auth-glow" />
    <section className="auth-card auth-card-premium">
      <div className="auth-brand-row"><div className="brand-mark auth-mark">R</div><div><strong>Rahul Development Studio</strong><span>Secure client management</span></div></div>
      <div className="auth-icon"><KeyRound size={20}/></div>
      <div className="eyebrow">ACCOUNT SECURITY</div>
      <h1>Set a new password</h1>
      <p className="auth-copy">Choose a strong password for your portal account. Your temporary password will stop working after this change.</p>
      {ready && !message && <form className="auth-form" onSubmit={submit}>
        <label>New password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" required/></label>
        <label>Confirm password<input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Repeat your password" autoComplete="new-password" required/></label>
        {error && <p className="form-error">{error}</p>}
        <button className="btn primary auth-submit" disabled={saving}>{saving?"Updating…":"Update password"}<ArrowRight size={15}/></button>
      </form>}
      {message && <div className="auth-success"><CheckCircle2 size={18}/><div><strong>Password updated</strong><p>{message}</p><a className="btn primary" href="/login">Continue to sign in</a></div></div>}
      {!ready && error && <div className="form-error">{error}<div style={{marginTop:10}}><a className="btn" href="/login">Back to login</a></div></div>}
    </section>
  </main>;
}
