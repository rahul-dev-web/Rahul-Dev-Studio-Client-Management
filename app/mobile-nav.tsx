"use client";

import { FileSignature, FolderKanban, Settings2, Users, BriefcaseBusiness, X, Handshake, CheckCircle2, Wrench } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

const items = [
  { href: "/agreements", label: "Agreements", icon: FileSignature },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/clients", label: "Clients", icon: Users },
];

const moreItems = [
  { href: "/deals", label: "Deals", icon: Handshake },
  { href: "/completed", label: "Completed", icon: CheckCircle2 },
  { href: "/corrections", label: "Corrections", icon: Wrench },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export default function MobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const isDeveloperRoute = ["/agreements", "/projects", "/clients", "/completed", "/corrections", "/settings", "/deals"].some((route) => pathname.startsWith(route));
  if (!isDeveloperRoute || pathname === "/login") return null;

  const moreActive = moreItems.some(({ href }) => pathname.startsWith(href));

  return (
    <>
      {moreOpen && (
        <button className="mobile-more-backdrop" aria-label="Close more menu" onClick={() => setMoreOpen(false)} />
      )}
      {moreOpen && (
        <section className="mobile-more-sheet" aria-label="More navigation">
          <div className="mobile-more-head"><strong>More</strong><button aria-label="Close" onClick={() => setMoreOpen(false)}><X size={18} /></button></div>
          <div className="mobile-more-grid">
            {moreItems.map(({ href, label, icon: Icon }) => (
              <a key={href} href={href} className={pathname.startsWith(href) ? "active" : ""} onClick={() => setMoreOpen(false)}>
                <Icon size={17} /><span>{label}</span>
              </a>
            ))}
          </div>
        </section>
      )}
      <nav className="mobile-nav global-mobile-nav" aria-label="Primary navigation">
        <a href="/" className="global-home-link"><span className="mobile-nav-icon"><BriefcaseBusiness size={18} /></span><span>Home</span></a>
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return <a key={href} className={active ? "active" : ""} href={href} aria-current={active ? "page" : undefined}><span className="mobile-nav-icon"><Icon size={18} strokeWidth={active ? 2.2 : 1.8} /></span><span>{label}</span></a>;
        })}
        <button className={moreActive ? "active" : ""} onClick={() => setMoreOpen((open) => !open)} aria-expanded={moreOpen} aria-haspopup="dialog">
          <span className="mobile-nav-icon"><Settings2 size={18} strokeWidth={moreActive ? 2.2 : 1.8} /></span><span>More</span>
        </button>
      </nav>
    </>
  );
}
