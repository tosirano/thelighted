import { z } from "zod";

// ── MenuItemResponse ───────────────────────────────────────────────────────

export const MenuItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.number(),
  isActive: z.boolean(),
  category: z.string().nullable(),
  imageUrl: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const MenuItemListSchema = z.array(MenuItemSchema);

// ── GalleryImageResponse ───────────────────────────────────────────────────

export const GalleryImageSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  caption: z.string().nullable(),
  order: z.number().int(),
  createdAt: z.string(),
});

export const GalleryImageListSchema = z.array(GalleryImageSchema);

// ── AdminUserResponse ──────────────────────────────────────────────────────

export const AdminUserSchema = z.object({
  id: z.string().uuid(),
  firstname: z.string(),
  lastname: z.string(),
  email: z.string().email(),
  role: z.string(),
  isVerified: z.boolean(),
  isActive: z.boolean(),
  membershipStatus: z.string(),
  profilePicture: z.string().nullable(),
  createdAt: z.string(),
});

export const AdminUserListSchema = z.array(AdminUserSchema);

// ── DashboardStatsResponse ─────────────────────────────────────────────────

export const DashboardStatsSchema = z.object({
  totalBookings: z.number().int(),
  totalRevenue: z.number(),
  activeMembers: z.number().int(),
  occupancyRate: z.number(),
  recentActivity: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      description: z.string(),
      createdAt: z.string(),
    })
  ),
});

// ── AnalyticsResponse ──────────────────────────────────────────────────────

export const AnalyticsSchema = z.object({
  period: z.string(),
  bookings: z.number().int(),
  revenue: z.number(),
  newMembers: z.number().int(),
  churnRate: z.number(),
  topWorkspaces: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      bookingCount: z.number().int(),
      revenueKobo: z.number().int(),
    })
  ),
});

// ── ApiError ───────────────────────────────────────────────────────────────

export const ApiErrorSchema = z.object({
  statusCode: z.number().int(),
  message: z.string(),
  details: z.record(z.array(z.string())).optional(),
});

// ── Inferred types (single source of truth) ────────────────────────────────

export type MenuItem = z.infer<typeof MenuItemSchema>;
export type GalleryImage = z.infer<typeof GalleryImageSchema>;
export type AdminUser = z.infer<typeof AdminUserSchema>;
export type DashboardStats = z.infer<typeof DashboardStatsSchema>;
export type Analytics = z.infer<typeof AnalyticsSchema>;