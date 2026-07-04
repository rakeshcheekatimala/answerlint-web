import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: [
    "/",
    "/(en)/:path*",
    "/((?!api|auth|_next|_vercel|robots\\.txt|sitemap\\.xml|favicon\\.ico|.*\\..*).*)",
  ],
};
