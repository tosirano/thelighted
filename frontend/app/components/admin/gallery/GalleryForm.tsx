"use client";

import React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { ImageUpload } from "../../ui/ImageUpload";
import { cn } from "@/lib/utils";

export const galleryCategories = [
  "food",
  "ambiance",
  "kitchen",
  "events",
  "drinks",
] as const;

const galleryImageSchema = z.object({
  imageUrl: z.string().min(1, "Image is required"),
  alt: z.string().min(5, "Alt text must be at least 5 characters"),
  category: z.enum(galleryCategories),
  isVisible: z.boolean().optional(),
  displayOrder: z.number().min(0, "Display order must be 0 or greater").optional(),
});

export type GalleryFormData = z.infer<typeof galleryImageSchema>;

interface GalleryFormProps {
  initialData?: Partial<GalleryFormData>;
  onSubmit: (data: GalleryFormData) => Promise<void>;
  isSubmitting: boolean;
  submitLabel?: string;
}

const categoryDescriptions: Record<(typeof galleryCategories)[number], string> =
  {
    food: "Dishes, plating, and food presentation",
    ambiance: "Restaurant atmosphere, décor, and seating",
    kitchen: "Behind-the-scenes kitchen and cooking",
    events: "Special events, celebrations, and gatherings",
    drinks: "Beverages, cocktails, and drinks menu",
  };

export function GalleryForm({
  initialData,
  onSubmit,
  isSubmitting,
  submitLabel = "Save Image",
}: GalleryFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<GalleryFormData>({
    resolver: zodResolver(galleryImageSchema),
    defaultValues: {
      isVisible: true,
      displayOrder: 0,
      imageUrl: "",
      category: "food",
      ...initialData,
    },
  });

  const handleFormSubmit = async (data: GalleryFormData) => {
    await onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-8">
      {/* Gallery Image */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Gallery Image
        </h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Image *
          </label>
          <Controller
            name="imageUrl"
            control={control}
            render={({ field }) => (
              <ImageUpload
                value={field.value}
                onChange={field.onChange}
                error={errors.imageUrl?.message}
                disabled={isSubmitting}
              />
            )}
          />
          <p className="mt-1 text-xs text-gray-500">
            Recommended dimensions: 800×600px. JPG or PNG format.
          </p>
        </div>
      </div>

      {/* Image Details */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Image Details
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Alt Text */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Alt Text *
            </label>
            <Input
              {...register("alt")}
              placeholder="e.g., Freshly plated jollof rice with fried plantain"
              error={errors.alt?.message}
              disabled={isSubmitting}
            />
            <p className="mt-1 text-xs text-gray-500">
              Describes the image for SEO and accessibility. Be specific and
              descriptive.
            </p>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category *
            </label>
            <select
              {...register("category")}
              disabled={isSubmitting}
              className={cn(
                "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent capitalize",
                errors.category ? "border-red-500" : "border-gray-300",
                isSubmitting && "opacity-50 cursor-not-allowed",
              )}
            >
              {galleryCategories.map((cat) => (
                <option key={cat} value={cat} className="capitalize">
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
            {errors.category && (
              <p className="mt-1 text-sm text-red-600">
                {errors.category.message}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              {galleryCategories.map((cat) => (
                <span key={cat} className="block">
                  <strong className="capitalize">{cat}</strong>:{" "}
                  {categoryDescriptions[cat]}
                </span>
              ))}
            </p>
          </div>

          {/* Display Order */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Display Order
            </label>
            <Input
              type="number"
              min="0"
              {...register("displayOrder", { valueAsNumber: true })}
              placeholder="0"
              error={errors.displayOrder?.message}
              disabled={isSubmitting}
              className={cn(isSubmitting && "opacity-50 cursor-not-allowed")}
            />
            <p className="mt-1 text-xs text-gray-500">
              Controls the order images appear. Use increments of 10 (e.g., 10,
              20, 30) to allow future insertions.
            </p>
          </div>

          {/* Visibility */}
          <div className="md:col-span-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                {...register("isVisible")}
                disabled={isSubmitting}
                className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500 disabled:opacity-50"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">
                  Visible on Website
                </span>
                <p className="text-xs text-gray-500">
                  When checked, this image will appear in the public gallery.
                  Uncheck to hide it without deleting.
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className="min-w-[200px]"
        >
          {isSubmitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Saving…
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </div>
    </form>
  );
}
