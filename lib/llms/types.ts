export type LlmsSection = "Docs" | "API" | "Product" | "Blog" | "Site" | "Optional";

export type LlmsPage = {
  url: string;
  title: string;
  description: string;
  section: LlmsSection;
  text: string;
};

export type LlmsGenerationResult = {
  llmsTxt: string;
  llmsFullTxt?: string;
  sourceCount: number;
  siteName: string;
  warnings: string[];
};
