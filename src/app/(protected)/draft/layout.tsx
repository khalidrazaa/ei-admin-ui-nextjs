import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Draft",
};

export default function DraftLayout({ children }: { children: React.ReactNode }) {
  return children;
}
