import type { Metadata } from "next";
import { LandingPageContent } from "@/components/landing/landing-page-content";

export const metadata: Metadata = {
  title: "Accountly",
  description: "Upload an invoice, get a journal entry.",
};

export default function HomePage() {
  return <LandingPageContent />;
}
