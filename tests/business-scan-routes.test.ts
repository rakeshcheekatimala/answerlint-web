import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetRateLimits } from "@/lib/net/rate-limit";

const {
  MockProjectAccessError,
  runBusinessAwareScan,
  getBusinessScanProject,
  updateBusinessScanProjectBestEffort,
  storeBusinessScanProjectBestEffort,
  discoverBusinessScanProject,
} = vi.hoisted(() => {
  class MockProjectAccessError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "ProjectAccessError";
    }
  }
  return {
    MockProjectAccessError,
    runBusinessAwareScan: vi.fn(),
    getBusinessScanProject: vi.fn(),
    updateBusinessScanProjectBestEffort: vi.fn(),
    storeBusinessScanProjectBestEffort: vi.fn(),
    discoverBusinessScanProject: vi.fn(),
  };
});

vi.mock("@/lib/business-scan/scan", () => ({
  runBusinessAwareScan,
}));

vi.mock("@/lib/business-scan/discovery", () => ({
  discoverBusinessScanProject,
}));

vi.mock("@/lib/business-scan/storage", () => ({
  ProjectAccessError: MockProjectAccessError,
  getBusinessScanProject,
  updateBusinessScanProjectBestEffort,
  storeBusinessScanProjectBestEffort,
}));

import { POST as scanPost } from "@/app/api/business-scan/scan/route";
import { POST as discoverPost } from "@/app/api/business-scan/discover/route";
import {
  GET as projectGet,
  PATCH as projectPatch,
} from "@/app/api/business-scan/projects/[projectId]/route";

const fakeRun = {
  id: "run",
  scannedAt: "2026-01-01T00:00:00Z",
  currentScore: 0,
  potentialScore: 0,
  lostOpportunityScore: 0,
  categoryScores: [],
  pageScores: [],
  recommendations: [],
  auditedPages: 0,
};

function scanRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://test/api/business-scan/scan", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function projectPage(id: string, url: string) {
  return {
    id,
    url,
    title: id,
    category: "Revenue Pages",
    impactTier: "Very High",
    included: true,
    is_manually_categorized: false,
    reason: "",
    confidence: 0.9,
    signals: [],
    source: "sitemap",
    incomingInternalLinks: 0,
    isNavigationLinked: false,
    isHomepageLinked: false,
  };
}

function project(pages: unknown[]) {
  return {
    id: "proj-1",
    baseUrl: "https://example.com",
    pages,
    businessModel: "SaaS Marketing Site",
    scanHistory: [],
    latestScore: null,
    potentialScore: null,
    lostOpportunityScore: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    storageStatus: "skipped",
  };
}

beforeEach(() => {
  resetRateLimits();
  vi.clearAllMocks();
  runBusinessAwareScan.mockImplementation(async (proj: unknown) => ({
    run: fakeRun,
    project: proj,
  }));
  updateBusinessScanProjectBestEffort.mockImplementation(async (proj: unknown) => proj);
});

describe("POST /api/business-scan/scan", () => {
  it("strips off-domain pages before auditing (SSRF allowlist)", async () => {
    const response = await scanPost(
      scanRequest({
        project: project([
          projectPage("home", "https://example.com/pricing"),
          projectPage("ssrf", "http://169.254.169.254/latest/meta-data"),
          projectPage("evil", "https://evil.example/x"),
        ]),
      }),
    );

    expect(response.status).toBe(200);
    const auditedProject = runBusinessAwareScan.mock.calls[0][0];
    expect(auditedProject.pages).toHaveLength(1);
    expect(auditedProject.pages[0].url).toBe("https://example.com/pricing");
  });

  it("returns 403 when loading a stored project without the owner token", async () => {
    getBusinessScanProject.mockRejectedValueOnce(
      new MockProjectAccessError("You do not have permission to open this project."),
    );

    const response = await scanPost(scanRequest({ projectId: "proj-1" }));
    expect(response.status).toBe(403);
  });

  it("rate limits repeated scans", async () => {
    let last = await scanPost(scanRequest({ project: project([]) }));
    for (let i = 0; i < 12; i += 1) {
      last = await scanPost(scanRequest({ project: project([]) }));
    }
    expect(last.status).toBe(429);
  });
});

describe("GET /api/business-scan/projects/[id]", () => {
  it("returns 403 when the owner token does not match", async () => {
    getBusinessScanProject.mockRejectedValueOnce(
      new MockProjectAccessError("You do not have permission to open this project."),
    );

    const response = await projectGet(
      new Request("http://test/api/business-scan/projects/proj-1"),
      { params: Promise.resolve({ projectId: "proj-1" }) },
    );
    expect(response.status).toBe(403);
  });

  it("passes the token header through to storage", async () => {
    getBusinessScanProject.mockResolvedValueOnce(project([]));
    await projectGet(
      new Request("http://test/api/business-scan/projects/proj-1", {
        headers: { "x-citeops-project-token": "secret-token" },
      }),
      { params: Promise.resolve({ projectId: "proj-1" }) },
    );
    expect(getBusinessScanProject).toHaveBeenCalledWith("proj-1", "secret-token");
  });
});

describe("PATCH /api/business-scan/projects/[id]", () => {
  it("rejects a payload whose id does not match the route", async () => {
    const response = await projectPatch(
      new Request("http://test/api/business-scan/projects/other-id", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project: project([]) }),
      }),
      { params: Promise.resolve({ projectId: "other-id" }) },
    );
    expect(response.status).toBe(400);
  });
});

describe("POST /api/business-scan/discover", () => {
  it("returns 400 when the base URL is missing", async () => {
    const response = await discoverPost(
      new Request("http://test/api/business-scan/discover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(response.status).toBe(400);
    expect(discoverBusinessScanProject).not.toHaveBeenCalled();
  });

  it("rate limits repeated discovery requests", async () => {
    let last: Response | undefined;
    for (let i = 0; i < 8; i += 1) {
      last = await discoverPost(
        new Request("http://test/api/business-scan/discover", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ baseUrl: "" }),
        }),
      );
    }
    expect(last?.status).toBe(429);
  });
});
