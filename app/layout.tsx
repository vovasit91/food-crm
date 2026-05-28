import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import Sidebar from "./components/Sidebar";
import { db } from "@/db";
import { contentVersion } from "@/db/generated/schema";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "Food CRM",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let currentVersion = 0;
  try {
    const [row] = await db.select({ version: contentVersion.version }).from(contentVersion);
    currentVersion = row?.version ?? 0;
  } catch {
    // DB unreachable at build time — runtime requests will have the real value
  }

  return (
    <ClerkProvider>
      <html lang="en" className={`${geist.variable} h-full`}>
        <body className="h-full flex font-[var(--font-geist),Arial,sans-serif]">
          <Sidebar currentVersion={currentVersion} />
          <main className="flex-1 overflow-auto bg-gray-50">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
