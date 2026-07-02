import type { MetadataRoute } from "next";

import { SITE_LAST_UPDATED_ISO } from "@/config/content-freshness";
import { SITE_URL } from "@/config/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(`${SITE_LAST_UPDATED_ISO}T12:00:00.000Z`);

  return [
    "",
    "/playground",
    "/docs/getting-started/installation",
  ].map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
  }));
}
