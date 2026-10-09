"use client";
import { useEffect, useState } from "react";
import { API, DEMO } from "@/lib/api";
import { SETTINGS } from "@/lib/settings";
import { toast } from "@/lib/ui";

// "Continue with Google" for UM accounts. In demo mode, type any UM email instead.
// `error` shows a message from the page, e.g. "Your sign-in has expired. Sign in again."
export default function SignInBox({ title, help, error, placeholder = "you@siswa.um.edu.my", className = "panel", style, onSignedIn }) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const doms = SETTINGS.allowedDomains.map(d => "@" + d).join(" or ");

  // An error from a redirect sign-in (used on phones that block pop-ups) shows up here.
  useEffect(() => { API.signInError().then(m => m && setErr(m)); }, []);

  async function go(e) {
    if (e) e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const a = await API.signIn(DEMO ? { email } : undefined);
      toast("Signed in as " + a.email);
      onSignedIn && onSignedIn(a);
    } catch (x) { setErr(x.message); }
    finally { setBusy(false); }
  }

  return (
    <div id="signin" className={className} style={style}>
      {title}
      <p className="help">{help || `Use your UM ${DEMO ? "email" : "Google account"} (${doms}). You'll stay signed in on this device.`}</p>
      {!DEMO && (
        <button className="cta-btn gbtn" type="button" onClick={() => go()} disabled={busy}>
          {busy ? "Opening Google…" : "Continue with Google"}
        </button>
      )}
      {DEMO && (
        <>
          <form className="signin-row" noValidate onSubmit={go}>
            <label htmlFor="a-email">UM email
              <input id="a-email" type="email" autoComplete="email" inputMode="email" maxLength={160} placeholder={placeholder} value={email} onChange={e => setEmail(e.target.value)} />
            </label>
            <button className="cta-btn" id="a-send" type="submit" disabled={busy}>Sign in</button>
          </form>
          <div className="notice"><strong>Demo mode:</strong> type any UM email to try it out. The live site uses Google sign-in.</div>
        </>
      )}
      {(err || error) && <p className="err" id="aerr" role="alert">{err || error}</p>}
    </div>
  );
}
