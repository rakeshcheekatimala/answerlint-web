import type { NextResponse } from "next/server";

import { VISIBILITY_PROJECT_TOKEN_HEADER } from "@/lib/visibility/constants";

const COOKIE_PREFIX = "answerlint_visibility_";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function visibilityProjectCookieName(projectId: string) {
  return `${COOKIE_PREFIX}${projectId}`;
}

export function getVisibilityProjectToken(request: Request, projectId: string) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieName = visibilityProjectCookieName(projectId);
  const cookieToken = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);

  if (cookieToken) {
    try {
      return decodeURIComponent(cookieToken);
    } catch {
      return undefined;
    }
  }
  return request.headers.get(VISIBILITY_PROJECT_TOKEN_HEADER) ?? undefined;
}

export function setVisibilityProjectCookie(
  response: NextResponse,
  projectId: string,
  token: string,
) {
  response.cookies.set(visibilityProjectCookieName(projectId), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: `/api/visibility/projects/${projectId}`,
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}

/** Never expose the bearer capability or internal persistence errors to JS. */
export function publicVisibilityProject<T extends { editToken?: string }>(project: T) {
  const { editToken, ...safeProject } = project;
  void editToken;
  return safeProject;
}
