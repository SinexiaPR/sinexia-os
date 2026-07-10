export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type DocumentProfileRow = {
  id: string;
  document_processing_id: string;
  company_id: string;
  report_id: string | null;
  document_id: string | null;
  document_type: string | null;
  period: string | null;
  structured_data: Json;
  summary: string | null;
  extraction_confidence: number | null;
  source_document: string | null;
  upload_date: string | null;
  created_at: string;
  updated_at: string;
};

export type SinexiaGptCacheRow = {
  id: string;
  cache_key: string;
  company_id: string;
  document_processing_id: string | null;
  question_normalized: string;
  response: string;
  model_name: string | null;
  created_at: string;
  expires_at: string | null;
};

export type PortalNotificationRow = {
  id: string;
  dedupe_key: string;
  audience: "client" | "admin";
  kind: string;
  company_id: string | null;
  report_id: string | null;
  document_id: string | null;
  title: string;
  description: string;
  href: string;
  created_at: string;
};

export type NotificationReadRow = {
  notification_id: string;
  user_id: string;
  read_at: string;
};

export type ReportViewRow = {
  user_id: string;
  report_id: string;
  viewed_at: string;
};

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
          status: "received" | "reviewing" | "processed" | "rejected";
          created_at: string;
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
          status?: "received" | "reviewing" | "processed" | "rejected";
          created_at?: string;
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
          status?: "received" | "reviewing" | "processed" | "rejected";
          created_at?: string;
        };
      };
      reports: {
        Row: {
          id: string;
          company_id: string;
          uploaded_by: string;
          title: string;
          category:
            | "Aging"
            | "Profit & Loss"
            | "Balance Sheet"
            | "Bank Reconciliation"
            | "Payroll"
            | "Statement"
            | "Custom Report";
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
          category:
            | "Aging"
            | "Profit & Loss"
            | "Balance Sheet"
            | "Bank Reconciliation"
            | "Payroll"
            | "Statement"
            | "Custom Report";
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
          category?:
            | "Aging"
            | "Profit & Loss"
            | "Balance Sheet"
            | "Bank Reconciliation"
            | "Payroll"
            | "Statement"
            | "Custom Report";
          period?: string;
          notes?: string | null;
          file_url?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      document_profiles: {
        Row: DocumentProfileRow;
        Insert: {
          id?: string;
          document_processing_id: string;
          company_id: string;
          report_id?: string | null;
          document_id?: string | null;
          document_type?: string | null;
          period?: string | null;
          structured_data?: Json;
          summary?: string | null;
          extraction_confidence?: number | null;
          source_document?: string | null;
          upload_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          document_processing_id?: string;
          company_id?: string;
          report_id?: string | null;
          document_id?: string | null;
          document_type?: string | null;
          period?: string | null;
          structured_data?: Json;
          summary?: string | null;
          extraction_confidence?: number | null;
          source_document?: string | null;
          upload_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      sinexia_gpt_cache: {
        Row: SinexiaGptCacheRow;
        Insert: {
          id?: string;
          cache_key: string;
          company_id: string;
          document_processing_id?: string | null;
          question_normalized: string;
          response: string;
          model_name?: string | null;
          created_at?: string;
          expires_at?: string | null;
        };
        Update: {
          id?: string;
          cache_key?: string;
          company_id?: string;
          document_processing_id?: string | null;
          question_normalized?: string;
          response?: string;
          model_name?: string | null;
          created_at?: string;
          expires_at?: string | null;
        };
      };
      notifications: {
        Row: PortalNotificationRow;
        Insert: {
          id?: string;
          dedupe_key: string;
          audience: "client" | "admin";
          kind: string;
          company_id?: string | null;
          report_id?: string | null;
          document_id?: string | null;
          title: string;
          description: string;
          href: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          dedupe_key?: string;
          audience?: "client" | "admin";
          kind?: string;
          company_id?: string | null;
          report_id?: string | null;
          document_id?: string | null;
          title?: string;
          description?: string;
          href?: string;
          created_at?: string;
        };
      };
      notification_reads: {
        Row: NotificationReadRow;
        Insert: {
          notification_id: string;
          user_id: string;
          read_at?: string;
        };
        Update: {
          notification_id?: string;
          user_id?: string;
          read_at?: string;
        };
      };
      report_views: {
        Row: ReportViewRow;
        Insert: {
          user_id: string;
          report_id: string;
          viewed_at?: string;
        };
        Update: {
          user_id?: string;
          report_id?: string;
          viewed_at?: string;
        };
      };
    };
  };
};

