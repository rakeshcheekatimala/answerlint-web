import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";

import {
  getVisibilityProjectToken,
  publicVisibilityProject,
  setVisibilityProjectCookie,
  visibilityProjectCookieName,
} from "@/lib/visibility/capability";
import { VISIBILITY_PROJECT_TOKEN_HEADER } from "@/lib/visibility/constants";

describe("visibility project capability transport", () => {
  it("prefers the HttpOnly cookie over the legacy migration header", () => {
    const projectId = "project-123";
    const request = new Request("https://example.com/api", {
      headers: {
        cookie: `${visibilityProjectCookieName(projectId)}=cookie-token`,
        [VISIBILITY_PROJECT_TOKEN_HEADER]: "legacy-token",
      },
    });

    expect(getVisibilityProjectToken(request, projectId)).toBe("cookie-token");
  });

  it("strips the bearer capability from client JSON", () => {
    expect(publicVisibilityProject({ id: "one", editToken: "secret" })).toEqual({
      id: "one",
    });
  });

  it("stores new capabilities in an HttpOnly scoped cookie", () => {
    const response = setVisibilityProjectCookie(
      NextResponse.json({ ok: true }),
      "project-123",
      "secret-token",
    );
    const cookie = response.headers.get("set-cookie") ?? "";

    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=lax");
    expect(cookie).toContain("Path=/api/visibility/projects/project-123");
  });
});
