import { CodeCopyBlock } from "@/components/CodeCopyBlock";

export function InstallCommandCopy({
  command,
  label,
}: {
  command: string;
  label: string;
}) {
  return (
    <CodeCopyBlock
      code={command}
      label={label}
      minHeightClassName="min-h-[4.75rem]"
    />
  );
}
