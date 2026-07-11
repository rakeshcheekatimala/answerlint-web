export type DocsPage = {
  title: string;
  description: string;
  slug: string[];
  body: Array<
    | {
        type: "lead";
        text: string;
      }
    | {
        type: "paragraph";
        text: string;
      }
    | {
        type: "code";
        language: string;
        code: string;
      }
    | {
        type: "list";
        items: string[];
      }
    | {
        type: "table";
        headers: string[];
        rows: string[][];
      }
    | {
        type: "callout";
        title: string;
        body: string;
      }
    | {
        type: "image";
        src: string;
        alt: string;
      }
    | {
        type: "subheading";
        text: string;
      }
  >;
};

export type DocsGroup = {
  title: string;
  pages: DocsPage[];
};

export const docsGroups: DocsGroup[] = [
  {
    title: "Getting Started",
    pages: [
      {
        slug: ["getting-started", "installation"],
        title: "Installation",
        description:
          "Install AnswerLint globally or run it directly with npx in a few minutes.",
        body: [
          {
            type: "lead",
            text:
              "AnswerLint is a CLI for auditing pages and content repositories for AEO and GEO readiness. The fastest path is a global npm install, but `npx` works well when you want to run it without installing anything permanently.",
          },
          {
            type: "subheading",
            text: "Requirements",
          },
          {
            type: "list",
            items: [
              "Node.js 18 or newer",
              "npm available in your terminal",
              "A public URL or local Markdown/HTML content to audit",
            ],
          },
          {
            type: "subheading",
            text: "Install globally",
          },
          {
            type: "code",
            language: "bash",
            code: "npm install -g answerlint",
          },
          {
            type: "paragraph",
            text:
              "Global installation is useful if you expect to run audits often from your terminal or CI runners with a fixed setup.",
          },
          {
            type: "subheading",
            text: "Run without installing",
          },
          {
            type: "code",
            language: "bash",
            code: "npx answerlint audit --help",
          },
          {
            type: "paragraph",
            text:
              "This is the easiest way to try the tool for the first time or use it in a disposable environment.",
          },
          {
            type: "subheading",
            text: "Verify the installation",
          },
          {
            type: "code",
            language: "bash",
            code: "answerlint overview\n# or\nanswerlint info",
          },
          {
            type: "callout",
            title: "Recommended next step",
            body:
              "After installation, go straight to the Quick Start page and run one URL audit plus one local-file audit. That gives you both the happy path and the stable local workflow.",
          },
        ],
      },
      {
        slug: ["getting-started", "quick-start"],
        title: "Quick Start",
        description:
          "Run your first audits against a URL, a local file, a folder, or a sitemap.",
        body: [
          {
            type: "lead",
            text:
              "The CLI supports four common inputs: a live URL, a local Markdown or HTML file, a directory of content files, or a sitemap for batch work.",
          },
          {
            type: "subheading",
            text: "Audit a live URL",
          },
          {
            type: "code",
            language: "bash",
            code:
              'answerlint audit --url "https://example.com/docs/article" --output html --output-path ./report.html',
          },
          {
            type: "subheading",
            text: "Compare against a competitor URL",
          },
          {
            type: "code",
            language: "bash",
            code:
              'answerlint audit --url "https://example.com/docs/article" --compare "https://competitor.example/docs/article" --output html --output-path ./compare-report.html',
          },
          {
            type: "subheading",
            text: "Audit a local Markdown or HTML file",
          },
          {
            type: "code",
            language: "bash",
            code:
              "answerlint audit --file ./content/post.md --output json --output-path ./report.json",
          },
          {
            type: "subheading",
            text: "Audit a directory",
          },
          {
            type: "code",
            language: "bash",
            code:
              "answerlint audit --dir ./content --output csv --output-path ./batch.csv",
          },
          {
            type: "subheading",
            text: "Audit a sitemap",
          },
          {
            type: "code",
            language: "bash",
            code:
              'answerlint audit --sitemap "https://example.com/sitemap.xml" --output csv --output-path ./site.csv',
          },
          {
            type: "callout",
            title: "Quoting URLs",
            body:
              "If your URL contains `&` or other shell-sensitive characters, wrap it in quotes so your shell passes the whole string correctly.",
          },
        ],
      },
      {
        slug: ["getting-started", "configuration"],
        title: "Configuration",
        description:
          "Use .answerlint.json to define project defaults and keep your audit behavior consistent.",
        body: [
          {
            type: "lead",
            text:
              "AnswerLint can read project defaults from a `.answerlint.json` file in your repository or home directory. This is the best way to make scoring and CI behavior consistent across teams.",
          },
          {
            type: "subheading",
            text: "Use a custom config file",
          },
          {
            type: "code",
            language: "bash",
            code:
              'answerlint audit --url "https://example.com" --config ./my-answerlint.json',
          },
          {
            type: "subheading",
            text: "Typical reasons to use config",
          },
          {
            type: "list",
            items: [
              "Set scoring defaults across a team",
              "Tune CI thresholds for your release process",
              "Keep audit behavior predictable in automation",
            ],
          },
        ],
      },
    ],
  },
  {
    title: "Workflows",
    pages: [
      {
        slug: ["workflows", "ci-mode"],
        title: "CI Mode",
        description:
          "Fail builds when your composite score falls below an agreed threshold.",
        body: [
          {
            type: "lead",
            text:
              "CI mode turns AnswerLint into a release gate. If the composite score drops below your threshold, the command exits with code 1 so your pipeline can fail fast.",
          },
          {
            type: "code",
            language: "bash",
            code:
              'answerlint audit --url "$DEPLOY_URL" --ci --threshold 70 --output json --output-path ./answerlint-report.json',
          },
          {
            type: "table",
            headers: ["Exit code", "Meaning"],
            rows: [
              ["0", "Success, or CI passed when score is at or above threshold"],
              ["1", "CI failed because composite score is below threshold"],
              ["2", "Crawl or network error"],
              ["3", "Invalid input or config error"],
            ],
          },
          {
            type: "callout",
            title: "Team-friendly usage",
            body:
              "Treat the threshold as a shared publishing standard. That keeps AEO and GEO quality from becoming a last-minute editorial debate.",
          },
        ],
      },
      {
        slug: ["workflows", "testing"],
        title: "Testing and Validation",
        description:
          "Smoke test AnswerLint locally before publishing or integrating into a larger workflow.",
        body: [
          {
            type: "lead",
            text:
              "If you are contributing to the package or validating it in a new environment, start with local files first. They remove network variability and make it easier to verify the output shape.",
          },
          {
            type: "subheading",
            text: "Build from source",
          },
          {
            type: "code",
            language: "bash",
            code:
              "git clone <your-repo-url> answerlint\ncd answerlint\nnpm install\nnpm run lint\nnpm run build",
          },
          {
            type: "subheading",
            text: "Smoke test a local file",
          },
          {
            type: "code",
            language: "bash",
            code:
              "node dist/index.js audit --file ./README.md --output html --output-path ./test-report.html",
          },
          {
            type: "subheading",
            text: "Smoke test JSON output",
          },
          {
            type: "code",
            language: "bash",
            code:
              "node dist/index.js audit --file ./README.md --output json --output-path ./test-report.json\nnode -e \"const r=require('./test-report.json'); console.log(r.scores, r.audits.length)\"",
          },
        ],
      },
    ],
  },
  {
    title: "Reference",
    pages: [
      {
        slug: ["reference", "outputs"],
        title: "Outputs",
        description:
          "Choose the right output format for stakeholders, automation, or batch reporting.",
        body: [
          {
            type: "lead",
            text:
              "Different output formats fit different audiences. HTML is easiest for humans, JSON is best for pipelines, and CSV is ideal for broad batches such as directories and sitemaps.",
          },
          {
            type: "table",
            headers: ["Flag", "Description"],
            rows: [
              ["--output html", "Single-file HTML report for human review"],
              ["--output json", "Machine-readable report for scripts and automation"],
              ["--output csv", "Summary rows for directories or sitemap batches"],
            ],
          },
          {
            type: "image",
            src: "/brand/ai-visibility-explainer.png",
            alt: "AnswerLint overview terminal screenshot",
          },
        ],
      },
      {
        slug: ["reference", "cli-commands"],
        title: "CLI Commands",
        description:
          "Reference for the overview and audit commands exposed by AnswerLint.",
        body: [
          {
            type: "lead",
            text:
              "The CLI is intentionally compact. Most teams use `overview` for orientation and `audit` for day-to-day work.",
          },
          {
            type: "code",
            language: "text",
            code: `answerlint overview   (alias: info)

answerlint audit [options]

  --url <url>           Single URL
  --file <path>         Local .md or .html
  --dir <path>          Directory of .md / .html
  --sitemap <url>       Crawl URLs from sitemap.xml

  --output <format>     html | json | csv (default: html)
  --output-path <path>  Write report to this path

  --threshold <n>       CI threshold (default: 70)
  --ci                  Exit 1 if composite < threshold

  --ignore-robots       Ignore robots.txt
  --depth <n>           Crawl depth (default: 1)
  --rate <n>            Requests per second (default: 1)
  --config <path>       Path to .answerlint.json

  --probe               Reserved for future LLM probe mode
  --compare <url>       Compare one target URL against one competitor URL`,
          },
        ],
      },
    ],
  },
];

export const defaultDocsSlug = ["getting-started", "installation"];

export function getDocsPage(slug?: string[]) {
  const normalized = slug && slug.length > 0 ? slug : defaultDocsSlug;

  for (const group of docsGroups) {
    for (const page of group.pages) {
      if (page.slug.join("/") === normalized.join("/")) {
        return page;
      }
    }
  }

  return null;
}
