import type { ReportCategory } from "@/lib/constants/reports";

export type UserRole = "admin" | "client";

export type DocumentStatus =
  | "received"
  | "reviewing"
  | "processed"
  | "rejected";

export type Company = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  company_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Document = {
  id: string;
  company_id: string;
  uploaded_by: string;
  supplier: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  amount: number;
  document_type: string;
  file_url: string;
  status: DocumentStatus;
  created_at: string;
};

export type DocumentWithCompany = Document & {
  company: Pick<Company, "id" | "name"> | null;
};

export type CompanyWithStats = Company & {
  pending_count: number;
  total_documents: number;
};

export const PENDING_STATUSES: DocumentStatus[] = ["received", "reviewing"];

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  received: "Received",
  reviewing: "Reviewing",
  processed: "Processed",
  rejected: "Rejected",
};

export const DOCUMENT_TYPE_OPTIONS = [
  "Invoice",
  "Receipt",
  "Credit Note",
  "Statement",
  "Other",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPE_OPTIONS)[number];

export type { ReportCategory } from "@/lib/constants/reports";

export type Report = {
  id: string;
  company_id: string;
  uploaded_by: string;
  title: string;
  category: ReportCategory;
  period: string;
  notes: string | null;
  file_url: string;
  created_at: string;
  updated_at: string;
};

export type ReportWithCompany = Report & {
  company: Pick<Company, "id" | "name"> | null;
};
