import type { Metadata } from "next";
import { ContactForm } from "@/components/features/ContactForm";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with Savoria Restaurant for reservations, questions, catering inquiries, or anything else you need.",
  openGraph: {
    title: "Contact Us | Savoria Restaurant",
    description:
      "Reach out to Savoria Restaurant for reservations, private dining, catering, and general inquiries.",
    type: "website",
    url: "/contact",
  },
};

export default function ContactPage() {
  return <ContactForm />;
}
