import type { Metadata } from "next";
import MenuPageClient from "./MenuPageClient";

const menuSections = [
  "Appetizers",
  "Small Chops",
  "Soups & Stews",
  "Swallow",
  "Salads",
  "Rice Dishes",
  "Proteins",
  "Sauces",
  "Bean Dishes",
  "Yam Dishes",
  "Grills & BBQ",
  "Chef Specials",
  "Seafood",
  "Drinks",
  "Desserts",
];

export const metadata: Metadata = {
  title: "Menu | Savoria Restaurant",
  description:
    "Browse the Savoria Restaurant menu with Nigerian rice dishes, soups, grills, seafood, desserts, drinks, and more.",
  openGraph: {
    title: "Menu | Savoria Restaurant",
    description:
      "Explore the full Savoria Restaurant menu, from comforting Nigerian classics to grilled specialties and refreshing drinks.",
    type: "website",
    url: "/menu",
  },
};

export default function MenuPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Savoria Restaurant Menu",
    description:
      "Browse the public menu for Savoria Restaurant, featuring Nigerian cuisine categories and signature dishes.",
    url: "/menu",
    mainEntity: {
      "@type": "Menu",
      name: "Savoria Restaurant Menu",
      hasMenuSection: menuSections.map((section) => ({
        "@type": "MenuSection",
        name: section,
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <MenuPageClient />
    </>
  );
}
