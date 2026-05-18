/**
 * Centralised pricing config. Edit this file to change pricing everywhere.
 * No internal numbers (costs, margins) are kept here — only customer-facing
 * details that are safe to render on the site.
 */

export const CURRENCY = "₹";

// Universal entitlements that apply to every paid pack.
export const UNIVERSAL = {
  fileLimitMB: 50,
  rawSupported: true,
};

export const TRIAL = {
  id: "trial",
  name: "Trial",
  priceLabel: "₹0",
  priceNumeric: 0,
  tagline: "One-time · no card needed",
  description: "Try the full product once.",
  events: 1,
  photos: 200,
  guestScans: 100,
  fileLimitMB: 50,
  rawSupported: true,
  notes: ["One per account · phone OTP verified"],
  cta: "Start free trial",
};

export const SMALL_EVENT = {
  id: "small",
  name: "Small event pack",
  priceLabel: "₹599",
  priceNumeric: 599,
  tagline: "Single small event",
  description: "₹599 per event · never expires.",
  events: 1,
  photos: 300,
  guestScans: 150,
  fileLimitMB: 50,
  rawSupported: true,
  cta: "Buy small event",
};

export const STANDARD_EVENT = {
  id: "standard",
  name: "Standard event",
  priceLabel: "₹1,500",
  priceNumeric: 1500,
  tagline: "Single standard event",
  description: "₹1,500 per event · never expires.",
  events: 1,
  photos: 1000,
  guestScans: 400,
  fileLimitMB: 50,
  rawSupported: true,
  cta: "Buy standard event",
  multiPackOffers: [
    {
      label: "5-event pack",
      discountLabel: "21% off",
      priceLabel: "₹5,900",
      priceNumeric: 5900,
      perEventLabel: "₹1,180/ev",
      strikePriceLabel: "₹7,500",
      saveLabel: "Save ₹1,600",
      events: 5,
    },
    {
      label: "10-event pack",
      discountLabel: "33% off",
      priceLabel: "₹9,990",
      priceNumeric: 9990,
      perEventLabel: "₹999/ev",
      strikePriceLabel: "₹15,000",
      saveLabel: "Save ₹5,010",
      events: 10,
      badge: "Best value",
    },
  ],
};

export const GRAND_EVENT = {
  id: "grand",
  name: "Grand event",
  priceLabel: "₹2,999",
  priceNumeric: 2999,
  tagline: "Single large event",
  description: "₹2,999 per grand event · never expires.",
  events: 1,
  photos: 3000,
  guestScans: 1500,
  fileLimitMB: 50,
  rawSupported: true,
  cta: "Buy grand event",
};

// Multi-pack cards shown alongside standard — kept here so other pages
// (refund policy, billing) can render the same data.
export const FIVE_PACK = {
  id: "pack-5",
  name: "5-event pack",
  priceLabel: "₹5,900",
  priceNumeric: 5900,
  tagline: "₹1,180/ev · save ₹1,600 · 21% off",
  description: "Five standard events at a discount.",
  events: 5,
  photosPerEvent: 1000,
  guestScansPerEvent: 400,
  fileLimitMB: 50,
  rawSupported: true,
  cta: "Buy 5-event pack",
};

export const TEN_PACK = {
  id: "pack-10",
  name: "10-event pack",
  priceLabel: "₹9,990",
  priceNumeric: 9990,
  tagline: "₹999/ev · save ₹5,010 · 33% off",
  description: "Best value — ten standard events.",
  events: 10,
  photosPerEvent: 1000,
  guestScansPerEvent: 400,
  fileLimitMB: 50,
  rawSupported: true,
  badge: "Best value",
  cta: "Buy 10-event pack",
};

// Cards on the main pricing grid — keep the Standard card single, with the
// multi-pack savings called out above it (per user spec).
export const PRIMARY_PLANS = [TRIAL, SMALL_EVENT, STANDARD_EVENT, GRAND_EVENT];

// Full pack catalogue for refund / billing pages.
export const ALL_PACKS = [
  SMALL_EVENT,
  STANDARD_EVENT,
  FIVE_PACK,
  TEN_PACK,
  GRAND_EVENT,
];

// ── Add-ons ────────────────────────────────────────────────────
export const ADDONS = [
  {
    id: "extend-30-days",
    name: "Extend to 30 days",
    priceLabel: "₹299",
    priceNumeric: 299,
    unitLabel: "/ event",
    description:
      "Keep one event's photos alive for 30 days instead of 7. Buy any time before day 7.",
  },
  {
    id: "extra-photos",
    name: "Extra photos",
    priceLabel: "₹249",
    priceNumeric: 249,
    unitLabel: "/ 500 photos",
    description:
      "+500 photos beyond event limit. Stack multiple blocks. Works on any pack.",
  },
];

// Default entitlements for a brand-new (un-purchased) photographer.
// Mirrors the Trial plan so /api/usage and the dashboard read the same numbers.
export const DEFAULT_PLAN = {
  plan_name: "trial",
  events_per_month: TRIAL.events,
  photos_per_event: TRIAL.photos,
  scans_per_event: TRIAL.guestScans,
  file_limit_mb: TRIAL.fileLimitMB,
  raw_supported: TRIAL.rawSupported,
};
