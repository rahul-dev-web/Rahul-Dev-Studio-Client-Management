"use client";

import { BriefcaseBusiness, CheckCircle2, FileSignature, FolderKanban, Settings2, Users } from "lucide-react";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Home", icon: BriefcaseBusiness },
  { href: "/agreements", label: "Agreements", icon: FileSignature },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/settings", label: "More", icon: Settings2 },
];

export default function MobileNav() {
  const pathname = usePathname();
  const isDeveloperRoute = pathname === "/" || ["/agreements", "/projects", "/clients", "/completed", "/corrections", "/settings", "/deals"].some((route) => pathname.startsWith(route));
  if (!isDeveloperRoute || pathname === "/login") return null;

  return (
    <nav className="mobile-nav global-mobile-nav" aria-label="Primary navigation">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <a key={href} className={active ? "active" : ""} href={href} aria-current={active ? "page" : undefined}>
            <span className="mobile-nav-icon"><Icon size={18} strokeWidth={active ? 2.2 : 1.8} /></span>
            <span>{label}</span>
          </a>
        );
      })}
    </nav>
  );
}
