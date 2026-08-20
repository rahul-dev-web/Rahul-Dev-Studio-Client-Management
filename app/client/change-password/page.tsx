"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { createClient } from "../../../lib/supabase/browser";

export default function ChangePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 8) return setError("Use a password with at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    setLoading(true);
    const s = createClient();
    const { error: passwordError } = await s.auth.updateUser({ password });
    if (passwordError) { setError(passwordError.message); setLoading(false); return; }
    const { data: { user } } = await s.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }
    const { error: profileError } = await s.from("profiles").update({ must_change_password: false }).eq("id", user.id);
    if (profileError) { setError(profileError.message); setLoading(false); return; }
    window.location.href = "/client";
  }

  return <main className="auth-shell"><section className="auth-card"><div className="brand-mark auth-mark">R</div><div className="eyebrow">Client Portal</div><h1>Set your new password</h1><p className="auth-copy">Your temporary password has expired for first use. Choose a private password before continuing.</p><form className="auth-form" onSubmit={submit}><label>New password<div className="input-wrap"><LockKeyhole size={16}/><input type="password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" required/></div></label><label>Confirm password<div className="input-wrap"><LockKeyhole size={16}/><input type="password" minLength={8} value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password" required/></div></label>{error&&<p className="form-error">{error}</p>}<button className="btn primary auth-submit" disabled={loading}>{loading?"Updating…":"Update password"}<ArrowRight size={15}/></button></form></section></main>;
}
