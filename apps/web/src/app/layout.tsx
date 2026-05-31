import type { Metadata } from "next";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { SidebarConfigProvider } from "@/contexts/sidebar-context";
import { Providers } from "@/components/providers";
import { inter } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "Accountly",
  description: "Upload an invoice, get a journal entry.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`}>
      <body className={inter.className}>
        <ThemeProvider defaultTheme="system" storageKey="nextjs-ui-theme">
          <SidebarConfigProvider>
            <Providers>{children}</Providers>
          </SidebarConfigProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
