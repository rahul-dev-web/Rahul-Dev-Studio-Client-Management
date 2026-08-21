"use client";

import { FileSignature, FolderKanban, Settings2, Users, BriefcaseBusiness } from "lucide-react";
import { usePathname } from "next/navigation";

const items = [
  { href: "/agreements", label: "Agreements", icon: FileSignature },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/settings", label: "More", icon: Settings2 },
];

export default function MobileNav() {
  const pathname = usePathname();
  const isDeveloperRoute = ["/agreements", "/projects", "/clients", "/completed", "/corrections", "/settings", "/deals"].some((route) => pathname.startsWith(route));
  if (!isDeveloperRoute || pathname === "/login") return null;

  return (
    <nav className="mobile-nav global-mobile-nav" aria-label="Primary navigation">
      <a href="/" className="global-home-link"><span className="mobile-nav-icon"><BriefcaseBusiness size={18} /></span><span>Home</span></a>
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/settings"
          ? pathname.startsWith("/settings") || pathname.startsWith("/completed") || pathname.startsWith("/corrections") || pathname.startsWith("/deals")
          : pathname.startsWith(href);
        return <a key={href} className={active ? "active" : ""} href={href} aria-current={active ? "page" : undefined}><span className="mobile-nav-icon"><Icon size={18} strokeWidth={active ? 2.2 : 1.8} /></span><span>{label}</span></a>;
      })}
    </nav>
  );
}
