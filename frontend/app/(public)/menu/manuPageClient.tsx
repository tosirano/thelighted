"use client";

import { useDeferredValue, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Filter, Search, Sparkles } from "lucide-react";
import { Container } from "@/app/components/ui/Container";
import { Button } from "@/app/components/ui/Button";
import { MenuItemCard } from "@/app/components/menu/MenuItemCard";
import { useMenuItems } from "@/lib/hooks/useMenuItems";
import type { MenuItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type CategoryFilter = {
  label: string;
  value: string | null;
  description: string;
};

const CATEGORY_FILTERS: CategoryFilter[] = [
  {
    label: "All",
    value: null,
    description: "Every dish on the menu",
  },
  {
    label: "Appetizers",
    value: "appetizers_small_chops",
    description: "Starters and shareable bites",
  },
  {
    label: "Small Chops",
    value: "appetizers_small_chops",
    description: "Party bites and Nigerian finger foods",
  },
  {
    label: "Soups & Stews",
    value: "soups",
    description: "Rich traditional soup bowls",
  },
  {
    label: "Swallow",
    value: "swallow",
    description: "Perfect pairings for soups",
  },
  {
    label: "Salads",
    value: "salads",
    description: "Fresh and vibrant plates",
  },
  {
    label: "Rice Dishes",
    value: "rice_dishes",
    description: "Jollof, fried rice, and more",
  },
  {
    label: "Proteins",
    value: "proteins",
    description: "Chicken, beef, and assorted meats",
  },
  {
    label: "Sauces",
    value: "stews_sauces",
    description: "Flavor-packed stews and sauces",
  },
  {
    label: "Bean Dishes",
    value: "bean_dishes",
    description: "Moin moin, akara, and bean classics",
  },
  {
    label: "Yam Dishes",
    value: "yam_dishes",
    description: "Boiled, fried, and pounded yam favorites",
  },
  {
    label: "Grills & BBQ",
    value: "grills_barbecue",
    description: "Smoky grilled specialties",
  },
  {
    label: "Chef Specials",
    value: "special_delicacies",
    description: "Signature house delicacies",
  },
  {
    label: "Seafood",
    value: "special_delicacies",
    description: "Seafood-forward specialties and delicacies",
  },
  {
    label: "Drinks",
    value: "drinks",
    description: "Fresh drinks and refreshments",
  },
  {
    label: "Desserts",
    value: "desserts",
    description: "Sweet finishes for every meal",
  },
];

const gridVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: "easeOut",
    },
  },
};

export default function MenuPageClient(): React.JSX.Element {
  const { data: menuItems = [], isLoading, error, refetch } = useMenuItems();
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const normalizedSearch = deferredSearchQuery.trim().toLowerCase();
  const filteredItems = menuItems.filter((item: MenuItem) => {
    const matchesCategory =
      activeCategory === null || item.category === activeCategory;
    const matchesSearch =
      normalizedSearch.length === 0 ||
      item.name.toLowerCase().includes(normalizedSearch) ||
      item.description.toLowerCase().includes(normalizedSearch);

    return matchesCategory && matchesSearch;
  });

  const activeFilterLabel =
    CATEGORY_FILTERS.find((filter) => filter.value === activeCategory)?.label ??
    "All";

  return (
    <main className="bg-gradient-to-b from-orange-50 via-white to-amber-50 pb-20 pt-28 md:pb-24 md:pt-32">
      <Container>
        <section className="mb-10 rounded-[2rem] border border-orange-100 bg-white/85 p-6 shadow-xl shadow-orange-100/50 backdrop-blur md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-orange-100 px-4 py-2 text-sm font-medium text-orange-700">
                <Sparkles className="h-4 w-4" />
                Nigerian Cuisine Menu
              </div>
              <h1 className="font-serif text-4xl font-bold text-slate-900 md:text-5xl">
                Explore Every Flavor on the Table
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
                Search the menu, browse by category, and discover everything from
                comforting rice dishes to grilled favorites, soups, desserts, and
                refreshing drinks.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative min-w-0 sm:w-80">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search menu items"
                  className="w-full rounded-2xl border border-orange-200 bg-white px-12 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
                  aria-label="Search menu items"
                />
              </div>

              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setShowFilters((current) => !current)}
                className="border-orange-500 text-orange-600 hover:bg-orange-500 hover:text-white"
              >
                <Filter className="mr-2 h-4 w-4" />
                {showFilters ? "Hide Filters" : "Show Filters"}
              </Button>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="mt-6 border-t border-orange-100 pt-6">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-orange-700">
                        Categories
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Switch between signature Nigerian menu groupings.
                      </p>
                    </div>
                    <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
                      Active: {activeFilterLabel}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {CATEGORY_FILTERS.map((filter) => {
                      const isActive = filter.value === activeCategory;

                      return (
                        <button
                          key={filter.label}
                          type="button"
                          onClick={() => setActiveCategory(filter.value)}
                          className={cn(
                            "rounded-full border px-4 py-2 text-sm font-medium transition",
                            isActive
                              ? "border-orange-500 bg-orange-500 text-white shadow-lg shadow-orange-200"
                              : "border-orange-200 bg-white text-slate-700 hover:border-orange-300 hover:bg-orange-50",
                          )}
                          title={filter.description}
                          aria-pressed={isActive}
                        >
                          {filter.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {isLoading && (
          <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-2xl border border-orange-100 bg-white p-5 shadow-sm"
              >
                <div className="h-44 animate-pulse rounded-xl bg-orange-100" />
                <div className="mt-4 h-5 animate-pulse rounded bg-orange-100" />
                <div className="mt-3 h-4 w-2/3 animate-pulse rounded bg-orange-50" />
                <div className="mt-5 h-10 animate-pulse rounded-xl bg-orange-100" />
              </div>
            ))}
          </section>
        )}

        {error && !isLoading && (
          <section className="rounded-[2rem] border border-red-200 bg-white p-8 text-center shadow-lg">
            <h2 className="font-serif text-3xl font-bold text-slate-900">
              We couldn&apos;t load the menu
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-slate-600">
              {error instanceof Error
                ? error.message
                : "An unexpected error occurred while fetching menu items."}
            </p>
            <Button type="button" onClick={() => refetch()} className="mt-6">
              Try Again
            </Button>
          </section>
        )}

        {!isLoading && !error && (
          <>
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-serif text-3xl font-bold text-slate-900">
                  Menu Items
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  {filteredItems.length} item{filteredItems.length === 1 ? "" : "s"} found
                  {normalizedSearch ? ` for "${deferredSearchQuery}"` : ""}.
                </p>
              </div>
            </div>

            {filteredItems.length === 0 ? (
              <section className="rounded-[2rem] border border-orange-100 bg-white p-10 text-center shadow-lg">
                <p className="text-5xl" aria-hidden="true">
                  🍽️
                </p>
                <h3 className="mt-4 font-serif text-3xl font-bold text-slate-900">
                  No dishes matched your filters
                </h3>
                <p className="mx-auto mt-3 max-w-2xl text-slate-600">
                  Try a different search term or switch back to the All category to
                  see the full menu again.
                </p>
                <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setActiveCategory(null);
                    }}
                  >
                    Clear Filters
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowFilters(true)}
                    className="border-orange-500 text-orange-600 hover:bg-orange-500 hover:text-white"
                  >
                    Browse Categories
                  </Button>
                </div>
              </section>
            ) : (
              <motion.section
                variants={gridVariants}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3"
              >
                {filteredItems.map((item) => (
                  <motion.div key={item.id} variants={itemVariants}>
                    <MenuItemCard item={item} showFullDetails />
                  </motion.div>
                ))}
              </motion.section>
            )}
          </>
        )}
      </Container>
    </main>
  );
}
