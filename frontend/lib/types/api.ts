// Strict TypeScript interfaces for every API response shape.
// Zero use of `any` — all shapes are explicitly typed.

// ── Shared primitives ──────────────────────────────────────────────────────

export type ApiError = {
  statusCode: number;
  message: string;
  details?: Record<string, string[]>;
};

// ── Dashboard / Analytics ──────────────────────────────────────────────────

export interface DashboardStatsResponse {
  totalBookings: number;
  totalRevenue: number;
  activeMembers: number;
  occupancyRate: number;
  recentActivity: ActivityItem[];
}

export interface ActivityItem {
  id: string;
  type: string;
  description: string;
  createdAt: string;
}

export interface AnalyticsResponse {
  period: string;
  bookings: number;
  revenue: number;
  newMembers: number;
  churnRate: number;
  topWorkspaces: WorkspaceStats[];
}

export interface WorkspaceStats {
  id: string;
  name: string;
  bookingCount: number;
  revenueKobo: number;
}

// ── Menu ───────────────────────────────────────────────────────────────────

export interface MenuItemResponse {
  id: string;
  name: string;
  description: string | null;
  price: number;
  isActive: boolean;
  category: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Gallery ────────────────────────────────────────────────────────────────

export interface GalleryImageResponse {
  id: string;
  url: string;
  caption: string | null;
  order: number;
  createdAt: string;
}

// ── Admin users ────────────────────────────────────────────────────────────

export interface AdminUserResponse {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  role: string;
  isVerified: boolean;
  isActive: boolean;
  membershipStatus: string;
  profilePicture: string | null;
  createdAt: string;
}

// ── Contact submissions ────────────────────────────────────────────────────

export interface ContactSubmissionResponse {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: "new" | "read" | "replied";
  createdAt: string;
}

// ── Paginated wrapper ──────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
}

// ── Auth ───────────────────────────────────────────────────────────────────

export interface AuthResponse {
  accessToken: string;
  user: AdminUserResponse;
}

// ── Generic mutation response ──────────────────────────────────────────────

export interface MutationSuccessResponse {
  message: string;
  data?: unknown;
}