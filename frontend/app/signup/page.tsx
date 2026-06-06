"use client";
import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Mail, Lock, User, ArrowRight } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { toast, Toaster } from "@/components/ui/Toast";

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupInner />
    </Suspense>
  );
}

function SignupInner() {
  const supabase = getSupabaseBrowser();
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/dashboard";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  async function emailSignUp() {
    if (!email || !password) { toast.error("Email and password required"); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name || email.split("@")[0] },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data.user && !data.session) {
      // Email confirmation required (default Supabase setting)
      toast.info("Check your email to confirm your account, then sign in.");
      router.push("/login");
    } else {
      toast.success("Welcome to StyleSense!");
      router.push(next);
      router.refresh();
    }
  }

  async function googleSignIn() {
    setOauthLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setOauthLoading(false);
      toast.error(
        error.message.includes("provider")
          ? "Google sign-in isn't enabled. Enable it in Supabase → Authentication → Providers → Google."
          : error.message
      );
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Toaster />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="surface w-full max-w-md p-8"
      >
        <div className="mb-7 text-center">
          <div className="font-display text-4xl mb-1" style={{ color: "var(--gold)" }}>StyleSense</div>
          <p className="text-xs uppercase tracking-widest" style={{ color: "var(--text-dim)" }}>
            Build your editorial closet
          </p>
        </div>

        <button
          className="btn-secondary w-full mb-4 flex items-center justify-center gap-2"
          onClick={googleSignIn}
          disabled={oauthLoading || loading}
        >
          {oauthLoading ? <Loader2 size={16} className="spin" /> : null}
          Continue with Google
        </button>

        <div className="flex items-center gap-3 my-5 text-xs" style={{ color: "var(--text-dim)" }}>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          OR
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>

        <div className="space-y-3 mb-5">
          <div>
            <label className="label">
              <User size={11} style={{ display: "inline", marginRight: 6 }} />
              Name (optional)
            </label>
            <input className="input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">
              <Mail size={11} style={{ display: "inline", marginRight: 6 }} />
              Email
            </label>
            <input
              className="input" type="email" autoComplete="email"
              placeholder="you@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label">
              <Lock size={11} style={{ display: "inline", marginRight: 6 }} />
              Password
            </label>
            <input
              className="input" type="password" autoComplete="new-password"
              placeholder="6+ characters"
              value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && emailSignUp()}
            />
          </div>
        </div>

        <button className="btn-primary w-full" onClick={emailSignUp} disabled={loading || oauthLoading}>
          {loading ? <><Loader2 size={16} className="spin" /> Creating account...</> : <>Create account <ArrowRight size={14} /></>}
        </button>

        <div className="text-center mt-5 text-sm" style={{ color: "var(--text-muted)" }}>
          Already have an account?{" "}
          <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} style={{ color: "var(--gold)" }}>
            Sign in
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
