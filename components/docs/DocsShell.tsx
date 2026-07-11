import Image from "next/image";
import Link from "next/link";

import { CodeCopyBlock } from "@/components/CodeCopyBlock";
import type { DocsGroup, DocsPage } from "@/lib/docs";

type Props = {
  groups: DocsGroup[];
  page: DocsPage;
};

export function DocsShell({ groups, page }: Props) {
  return (
    <div className="safe-pad mx-auto max-w-content py-10 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-12">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-[28px] border border-border bg-card p-4 shadow-soft sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              Documentation
            </p>
            <div className="mt-4 space-y-5">
              {groups.map((group) => (
                <div key={group.title}>
                  <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-ink-subtle">
                    {group.title}
                  </h2>
                  <nav className="mt-3 grid gap-1" aria-label={group.title}>
                    {group.pages.map((item) => {
                      const active = item.slug.join("/") === page.slug.join("/");
                      return (
                        <Link
                          key={item.slug.join("/")}
                          href={`/docs/${item.slug.join("/")}`}
                          aria-current={active ? "page" : undefined}
                          className={`rounded-2xl px-3 py-2.5 text-sm transition-colors ${
                            active
                              ? "bg-paper-muted font-semibold text-ink"
                              : "text-ink-muted hover:bg-paper-muted hover:text-ink"
                          }`}
                        >
                          {item.title}
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <article className="min-w-0 rounded-[32px] border border-border bg-card p-6 shadow-soft sm:p-8">
          <header className="border-b border-border pb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-accent">
              {page.slug[0].replace(/-/g, " ")}
            </p>
            <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-5xl">
              {page.title}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-ink-muted sm:text-lg">
              {page.description}
            </p>
          </header>

          <div className="mt-8 space-y-7">
            {page.body.map((block, index) => {
              switch (block.type) {
                case "lead":
                  return (
                    <p
                      key={index}
                      className="max-w-3xl text-lg leading-8 text-ink sm:text-xl"
                    >
                      {block.text}
                    </p>
                  );
                case "paragraph":
                  return (
                    <p
                      key={index}
                      className="max-w-3xl text-base leading-8 text-ink-muted"
                    >
                      {block.text}
                    </p>
                  );
                case "subheading":
                  return (
                    <h2
                      key={index}
                      className="font-display text-2xl font-semibold text-ink"
                    >
                      {block.text}
                    </h2>
                  );
                case "code":
                  return (
                    <CodeCopyBlock
                      key={index}
                      code={block.code}
                      label="Command"
                      className="rounded-[8px]"
                      minHeightClassName="min-h-[6rem]"
                    />
                  );
                case "list":
                  return (
                    <ul key={index} className="grid gap-3">
                      {block.items.map((item) => (
                        <li
                          key={item}
                          className="rounded-2xl bg-paper-muted px-4 py-3 text-base leading-7 text-ink-muted"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  );
                case "table":
                  return (
                    <div
                      key={index}
                      className="overflow-x-auto rounded-[24px] border border-border"
                    >
                      <table className="min-w-full border-collapse bg-card text-left text-sm text-ink">
                        <thead className="bg-paper-muted">
                          <tr>
                            {block.headers.map((header) => (
                              <th
                                key={header}
                                className="px-4 py-3 font-semibold text-ink"
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {block.rows.map((row, rowIndex) => (
                            <tr key={rowIndex} className="border-t border-border">
                              {row.map((cell, cellIndex) => (
                                <td
                                  key={`${rowIndex}-${cellIndex}`}
                                  className="px-4 py-3 align-top text-ink-muted"
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                case "callout":
                  return (
                    <div
                      key={index}
                      className="rounded-[24px] border border-border-strong bg-wash p-5"
                    >
                      <h3 className="text-lg font-semibold text-ink">
                        {block.title}
                      </h3>
                      <p className="mt-2 text-base leading-7 text-ink-muted">
                        {block.body}
                      </p>
                    </div>
                  );
                case "image":
                  return (
                    <div
                      key={index}
                      className="overflow-hidden rounded-[28px] border border-border bg-ink shadow-soft"
                    >
                      <Image
                        src={block.src}
                        alt={block.alt}
                        width={1200}
                        height={720}
                        className="block h-auto w-full max-w-full object-cover object-top"
                        sizes="(max-width: 1024px) 100vw, 70vw"
                      />
                    </div>
                  );
                default:
                  return null;
              }
            })}
          </div>
        </article>
      </div>
    </div>
  );
}
