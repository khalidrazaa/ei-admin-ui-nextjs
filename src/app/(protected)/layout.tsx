"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { logout } from "@/lib/services/auth"; // adjust path if needed
import Button from "@/components/ui/Button"; // adjust path if needed

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const navItems = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Trends", href: "/trends" },
    { name: "Niches", href: "/niches" },
    { name: "Youtube Popular", href: "/youtube-popular" },
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
      <header className="h-14 bg-gray-900 text-white flex items-center justify-between px-6">
        
        {/* Left: Logo */}
        <div className="font-bold text-lg">Admin Panel</div>

        {/* Center: Nav */}
        <nav className="flex gap-6">
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
        <Button
          variant="danger"
          onClick={handleLogout}
          disabled={loading}
          //className="rounded bg-red-500 px-3 py-1 text-sm hover:bg-red-600 disabled:opacity-50"
        >
          {loading ? "..." : <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-square-arrow-right-exit-icon lucide-square-arrow-right-exit"><path d="M10 12h11"/><path d="m17 16 4-4-4-4"/><path d="M21 6.344V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1.344"/></svg> }
        </Button>
      </header>

      {/* 🔽 PAGE CONTENT */}
      <main className="flex-1 bg-gray-50">
        {children}
      </main>

    </div>
  );
}
