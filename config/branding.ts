/**
 * Central branding and external links. Change here or via NEXT_PUBLIC_* env — not in UI components.
 */
export const branding = {
  productName: "answerlint",
  /** Display name for marketing copy (can differ from npm package name). */
  displayName: "AnswerLint",
  logo: {
    src: process.env.NEXT_PUBLIC_LOGO_SRC ?? "/brand/logo.png",
    width: 1600,
    height: 360,
  },
  links: {
    github:
      process.env.NEXT_PUBLIC_GITHUB_URL ??
      "https://github.com/rakeshcheekatimala/answerlint",
    npm:
      process.env.NEXT_PUBLIC_NPM_URL ??
      "https://www.npmjs.com/package/answerlint",
  },
  installCommand:
    process.env.NEXT_PUBLIC_INSTALL_CMD ??
    "npx answerlint@latest audit --url https://website.com",
  /** Terminal overview screenshot (README asset). */
  overviewImageUrl:
    process.env.NEXT_PUBLIC_OVERVIEW_IMAGE_URL ??
    "/brand/ai-visibility-explainer.png",
  explainerImageUrl:
    process.env.NEXT_PUBLIC_EXPLAINER_IMAGE_URL ??
    "/brand/ai-visibility-explainer.png",
} as const;

export type Branding = typeof branding;
