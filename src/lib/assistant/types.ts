export type AssistantContext = {
  companyName: string;
  totalDocuments: number;
  pendingDocuments: number;
  availableReports: number;
  latestReportTitle: string | null;
};

export type AssistantMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AssistantResponse = {
  message: string;
  disclaimer: string;
};

export interface AssistantProvider {
  generate(input: string, context: AssistantContext): Promise<AssistantResponse>;
}
