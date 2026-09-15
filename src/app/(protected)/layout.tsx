"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { logout } from "@/lib/services/auth"; // adjust path if needed
import Button from "@/components/ui/Button"; // adjust path if needed

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Trends", href: "/trends" },
    { name: "Niches", href: "/niches" },
    { name: "Youtube Popular", href: "/youtube-popular" },
    { name: "Draft", href: "/draft" },
    { name: "Articles", href: "/articles" }
  ];

  const handleLogout = async () => {
    try {
      setLoading(true);
      await logout();
      router.push("/login");
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">

      {/* 🔷 TOP NAVBAR */}
      <header className="relative z-30 h-14 shrink-0 bg-gray-900 text-white flex items-center justify-between px-4 lg:px-6">
        
        {/* Left: Logo */}
        <div className="font-bold text-lg">Admin Panel</div>

        {/* Center: Nav */}
        <nav aria-label="Main navigation" className="hidden lg:flex gap-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-2 py-1 rounded ${
                pathname === item.href
                  ? "bg-gray-700"
                  : "hover:bg-gray-800"
              }`}
            >
              {item.name}
            </Link>
          ))}
        </nav>

        {/* Right: Logout */}
        <div className="flex items-center gap-3">
        <button type="button" className="flex h-11 w-11 items-center justify-center rounded hover:bg-gray-800 lg:hidden" aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileMenuOpen} aria-controls="mobile-navigation" onClick={() => setMobileMenuOpen((open) => !open)}>{mobileMenuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}</button>
        <Button
          variant="danger"
          onClick={handleLogout}
          disabled={loading}
          aria-label="Log out"
          className="min-h-11 lg:min-h-0"
          //className="rounded bg-red-500 px-3 py-1 text-sm hover:bg-red-600 disabled:opacity-50"
        >
          {loading ? "..." : <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-square-arrow-right-exit-icon lucide-square-arrow-right-exit"><path d="M10 12h11"/><path d="m17 16 4-4-4-4"/><path d="M21 6.344V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1.344"/></svg> }
        </Button>
        </div>
        {mobileMenuOpen && (<nav id="mobile-navigation" aria-label="Mobile navigation" className="absolute top-14 inset-x-0 grid grid-cols-2 gap-2 border-t border-gray-700 bg-gray-900 p-4 shadow-lg lg:hidden">{[...navItems, { name: "Settings", href: "/settings" }].map((item) => (<Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)} aria-current={pathname === item.href ? "page" : undefined} className={"rounded px-3 py-3 text-sm " + (pathname === item.href ? "bg-gray-700" : "hover:bg-gray-800")}>{item.name}</Link>))}</nav>)}
      </header>

      {/* 🔽 PAGE CONTENT */}
      <main className="flex-1 bg-gray-50">
        {children}
      </main>

    </div>
  );
}
