import "./globals.css";
import AdminLayout from "../components/AdminShell";
import { title } from "process";

export const metadata = {
  title: "Admin",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AdminLayout>{children}</AdminLayout>
      </body>
    </html>
  );
}