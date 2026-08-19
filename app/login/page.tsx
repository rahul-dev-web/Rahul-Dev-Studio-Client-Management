"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, LockKeyhole, Mail } from "lucide-react";
import { createClient } from "../../lib/supabase/browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    window.location.href = "/";
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand-mark auth-mark">R</div>
        <div className="eyebrow">Rahul Development Studio</div>
        <h1>Developer login</h1>
        <p className="auth-copy">Sign in to manage deals, agreements, projects and client handovers.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>Email<div className="input-wrap"><Mail size={16} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required /></div></label>
          <label>Password<div className="input-wrap"><LockKeyhole size={16} /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required /></div></label>
          {error && <p className="form-error">{error}</p>}
          <button className="btn primary auth-submit" disabled={loading}>{loading ? "Signing in…" : "Sign in"}<ArrowRight size={15} /></button>
        </form>
      </section>
    </main>
  );
}
