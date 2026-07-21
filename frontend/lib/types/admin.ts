// Shared types for admin CRUD data models

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  isActive: boolean;
  category?: string;
}

export interface GalleryImage {
  id: string;
  url: string;
  caption?: string;
  order?: number;
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: "active" | "inactive" | "pending";
}