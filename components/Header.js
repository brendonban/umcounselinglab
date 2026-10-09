"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/useAuth";

// Pages · account · Book now. The logo goes home, so there's no Home link.
const NAV = [
  { href: "/rules", label: "Rules" },
  { href: "/guide", label: "Guide" },
  { href: "/support", label: "Support" },
];

function initials(a) {
  const name = (a.profile && a.profile.name) || a.email.split("@")[0];
  const parts = name.replace(/[^A-Za-z ]/g, " ").trim().split(/\s+/);
  return ((parts[0] || "?")[0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export default function Header() {
  const path = usePathname();
  const [auth] = useAuth();
  const [noLogo, setNoLogo] = useState(false);
  const cur = href => (path === href ? "page" : undefined);
  return (
    <header className="site">
      <div className="wrap nav">
        <Link className={"brand" + (noLogo ? " nologo" : "")} href="/" aria-label="UM Counseling Lab home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo" src="/um-logo.png" alt="Universiti Malaya" onError={() => setNoLogo(true)} />
          <span className="sub">Counseling Lab</span>
          <span className="fallback"><span className="mark" aria-hidden="true">UM</span><span><b>Counseling Lab</b><small>Universiti Malaya</small></span></span>
        </Link>
        <nav className="right" aria-label="Main">
          <ul>
            {NAV.map(n => <li key={n.href}><Link href={n.href} aria-current={cur(n.href)}>{n.label}</Link></li>)}
            <li className="acct-li">
              {auth && auth.email ? (
                <Link href="/profile" className="me" title={auth.email} aria-current={cur("/profile")}>
                  <span className="av" aria-hidden="true">{initials(auth)}</span>My profile
                </Link>
              ) : (
                <Link href="/profile" aria-current={cur("/profile")}>Sign in</Link>
              )}
            </li>
          </ul>
          <Link className="cta-btn hdr" href="/book">Book now</Link>
        </nav>
      </div>
    </header>
  );
}
