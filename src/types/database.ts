export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type DocumentStatus =
  | "received"
  | "reviewing"
  | "processed"
  | "needs_info"
  | "rejected";

type ReportCategory =
  | "Aging"
  | "Profit & Loss"
  | "Balance Sheet"
  | "Bank Reconciliation"
  | "Payroll"
  | "Statement"
  | "Custom Report";

type NotificationKind =
  | "document_uploaded"
  | "document_status_changed"
  | "document_needs_info"
  | "report_published";

export type Database = {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          name: string;
          slug: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          created_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: "admin" | "client";
          company_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: "admin" | "client";
          company_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          role?: "admin" | "client";
          company_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      documents: {
        Row: {
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
          file_size: number | null;
          status: DocumentStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          uploaded_by: string;
          supplier: string;
          invoice_number: string;
          invoice_date: string;
          due_date?: string | null;
          amount: number;
          document_type: string;
          file_url: string;
          file_size?: number | null;
          status?: DocumentStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          uploaded_by?: string;
          supplier?: string;
          invoice_number?: string;
          invoice_date?: string;
          due_date?: string | null;
          amount?: number;
          document_type?: string;
          file_url?: string;
          file_size?: number | null;
          status?: DocumentStatus;
          created_at?: string;
          updated_at?: string;
        };
      };
      reports: {
        Row: {
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
        Insert: {
          id?: string;
          company_id: string;
          uploaded_by: string;
          title: string;
          category: ReportCategory;
          period: string;
          notes?: string | null;
          file_url: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          uploaded_by?: string;
          title?: string;
          category?: ReportCategory;
          period?: string;
          notes?: string | null;
          file_url?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          recipient_id: string;
          company_id: string | null;
          kind: NotificationKind;
          title: string;
          body: string;
          href: string | null;
          document_id: string | null;
          report_id: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          recipient_id: string;
          company_id?: string | null;
          kind: NotificationKind;
          title: string;
          body: string;
          href?: string | null;
          document_id?: string | null;
          report_id?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          recipient_id?: string;
          company_id?: string | null;
          kind?: NotificationKind;
          title?: string;
          body?: string;
          href?: string | null;
          document_id?: string | null;
          report_id?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
      };
    };
  };
};
