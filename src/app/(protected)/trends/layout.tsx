import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trends",
};

export default function TrendsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
