export const siteConfig = {
  name: process.env.NEXT_PUBLIC_SITE_NAME || "ShortXMax",
  tagline:
    process.env.NEXT_PUBLIC_SITE_TAGLINE ||
    "Short dramas that hook you in minutes.",
  url: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3100").replace(
    /\/$/,
    "",
  ),
  supportEmail: "support@shortxmax.com",
};
