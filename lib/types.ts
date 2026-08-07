// Shared domain types (enums are strings in the SQLite schema; these unions
// mirror them and are enforced via Zod at trust boundaries).

export type Role = "HOST" | "ADMIN";
export type EventStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type LocationType = "HOME" | "VENUE" | "OUTDOOR" | "PARK";
export type ItemStatus = "AVAILABLE" | "CLAIMED" | "PURCHASED";
export type ClickSource = "PLANNER" | "REGISTRY" | "ARTICLE" | "THEME";
export type ReferrerType = "HOST" | "GUEST" | "SEARCH" | "DIRECT";
export type RecSource = "ai" | "fallback" | "cached";

export interface PlanInput {
  siteSlug: string;
  themeSlug: string;
  childName?: string;
  childAge?: number;
  guestCount: number;
  budgetTotal: number;
  partyDate?: string;
  locationType?: LocationType;
}

export interface CandidateProduct {
  id: string;
  title: string;
  categorySlug: string;
  categoryName: string;
  price: number;
  packQuantity: number;
  themeTags: string[];
  colorTags: string[];
}

export interface PlanItem {
  productId: string;
  quantity: number;
  reason: string;
}

export interface PlanCategory {
  slug: string;
  name: string;
  items: PlanItem[];
}

export interface PlanOutput {
  budgetAllocation: Record<string, number>;
  categories: PlanCategory[];
  notes: string;
  shippingWarning: string | null;
}

export interface HydratedItem extends PlanItem {
  product: {
    id: string;
    title: string;
    imageUrl: string;
    price: number;
    packQuantity: number | null;
    productUrl: string;
    affiliateUrl: string | null;
    merchantName: string;
  };
  lineTotal: number;
  unitLabel: string;
}

export interface HydratedPlan {
  categories: {
    slug: string;
    name: string;
    items: HydratedItem[];
    subtotal: number;
  }[];
  total: number;
  budgetTotal: number;
  withinBudget: boolean;
  notes: string;
  shippingWarning: string | null;
  source: RecSource;
  model?: string | null;
}
