// app/admin/layout.tsx

"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";



const links = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/verify", label: "Verify" },
  { href: "/admin/ads", label: "Ads" },
  { href: "/admin/users", label: "Users" },
];

function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex lg:flex-col w-60 border-r border-white/10 bg-black/90 text-sm">
      <div className="px-4 py-4 text-lg font-semibold">Admin</div>
      <nav className="flex-1 px-2 space-y-1">
        {links.map((link) => {
          const active = pathname?.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`block px-3 py-2 rounded-lg transition ${
                active
                  ? "bg-pink-500 text-black font-semibold"
                  : "text-white/70 hover:bg-white/10"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

// Bottom nav for mobile
function AdminBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 border-t border-white/10 bg-black/90 backdrop-blur px-1 py-1">
      <div className="flex justify-around">
        {links.map((link) => {
          const active = pathname?.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex-1 text-center text-xs py-2 rounded-lg mx-0.5 ${
                active
                  ? "bg-pink-500 text-black font-semibold"
                  : "text-white/70"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col lg:flex-row">
      <AdminSidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 pb-20 lg:pb-6">
        {children}
      </main>
      <AdminBottomNav />
    </div>
  );
}
