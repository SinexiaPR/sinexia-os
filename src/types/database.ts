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
  target_user_id: string | null;
  calendar_item_id: string | null;
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

export type DocumentViewRow = {
  user_id: string;
  document_id: string;
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
          document_type_description: string | null;
          priority: "routine" | "urgent";
          comment: string | null;
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
          document_type_description?: string | null;
          priority?: "routine" | "urgent";
          comment?: string | null;
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
          document_type_description?: string | null;
          priority?: "routine" | "urgent";
          comment?: string | null;
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
          target_user_id?: string | null;
          calendar_item_id?: string | null;
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
          target_user_id?: string | null;
          calendar_item_id?: string | null;
          title?: string;
          description?: string;
          href?: string;
          created_at?: string;
        };
      };
      calendar_items: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          item_type: "task" | "activity" | "reminder" | "internal_message";
          company_id: string | null;
          assigned_to: string | null;
          created_by: string;
          updated_by: string;
          event_date: string;
          all_day: boolean;
          start_at: string | null;
          end_at: string | null;
          timezone: string;
          priority: "routine" | "important" | "urgent";
          status: "pending" | "in_progress" | "completed" | "cancelled";
          recurrence_rule: Json | null;
          recurrence_until: string | null;
          recurrence_parent_id: string | null;
          completed_at: string | null;
          external_provider: string | null;
          external_event_id: string | null;
          last_synced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          item_type: "task" | "activity" | "reminder" | "internal_message";
          company_id?: string | null;
          assigned_to?: string | null;
          created_by: string;
          updated_by: string;
          event_date: string;
          all_day?: boolean;
          start_at?: string | null;
          end_at?: string | null;
          timezone?: string;
          priority?: "routine" | "important" | "urgent";
          status?: "pending" | "in_progress" | "completed" | "cancelled";
          recurrence_rule?: Json | null;
          recurrence_until?: string | null;
          recurrence_parent_id?: string | null;
          completed_at?: string | null;
          external_provider?: string | null;
          external_event_id?: string | null;
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["calendar_items"]["Insert"]
        >;
      };
      calendar_item_comments: {
        Row: {
          id: string;
          calendar_item_id: string;
          user_id: string;
          content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          calendar_item_id: string;
          user_id: string;
          content: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: { content?: string; updated_at?: string };
      };
      calendar_item_occurrence_status: {
        Row: {
          id: string;
          calendar_item_id: string;
          occurrence_date: string;
          status: "pending" | "in_progress" | "completed" | "cancelled" | null;
          title: string | null;
          description: string | null;
          start_at: string | null;
          end_at: string | null;
          completed_at: string | null;
          updated_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          calendar_item_id: string;
          occurrence_date: string;
          status?: "pending" | "in_progress" | "completed" | "cancelled" | null;
          title?: string | null;
          description?: string | null;
          start_at?: string | null;
          end_at?: string | null;
          completed_at?: string | null;
          updated_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: "pending" | "in_progress" | "completed" | "cancelled" | null;
          title?: string | null;
          description?: string | null;
          start_at?: string | null;
          end_at?: string | null;
          completed_at?: string | null;
          updated_by?: string;
          updated_at?: string;
        };
      };
      payroll_employees: {
        Row: {
          id: string;
          company_id: string;
          first_name: string;
          last_name: string;
          normalized_name: string;
          section: string;
          compensation_type:
            "hourly" | "hourly_training" | "fixed_weekly" | null;
          regular_hourly_rate: number | null;
          training_hourly_rate: number | null;
          fixed_weekly_salary: number | null;
          active: boolean;
          requires_compensation_review: boolean;
          internal_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          first_name: string;
          last_name: string;
          section: string;
          compensation_type?:
            "hourly" | "hourly_training" | "fixed_weekly" | null;
          regular_hourly_rate?: number | null;
          training_hourly_rate?: number | null;
          fixed_weekly_salary?: number | null;
          active?: boolean;
          requires_compensation_review?: boolean;
          internal_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          first_name?: string;
          last_name?: string;
          section?: string;
          compensation_type?:
            "hourly" | "hourly_training" | "fixed_weekly" | null;
          regular_hourly_rate?: number | null;
          training_hourly_rate?: number | null;
          fixed_weekly_salary?: number | null;
          active?: boolean;
          requires_compensation_review?: boolean;
          internal_note?: string | null;
          updated_at?: string;
        };
      };
      weekly_payrolls: {
        Row: {
          id: string;
          company_id: string;
          week_start: string;
          week_end: string;
          status: "draft" | "submitted" | "approved";
          created_by: string;
          submitted_at: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          week_start: string;
          week_end: string;
          status?: "draft" | "submitted" | "approved";
          created_by: string;
          submitted_at?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: "draft" | "submitted" | "approved";
          submitted_at?: string | null;
          approved_at?: string | null;
          updated_at?: string;
        };
      };
      weekly_payroll_entries: {
        Row: {
          id: string;
          payroll_id: string;
          employee_id: string;
          employee_name_snapshot: string;
          section_snapshot: string;
          compensation_type_snapshot:
            "hourly" | "hourly_training" | "fixed_weekly" | null;
          regular_rate_snapshot: number | null;
          training_rate_snapshot: number | null;
          fixed_salary_snapshot: number | null;
          requires_review_snapshot: boolean;
          regular_hours: number;
          training_hours: number;
          other_payments: number;
          comment: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          payroll_id: string;
          employee_id: string;
          employee_name_snapshot: string;
          section_snapshot: string;
          compensation_type_snapshot?:
            "hourly" | "hourly_training" | "fixed_weekly" | null;
          regular_rate_snapshot?: number | null;
          training_rate_snapshot?: number | null;
          fixed_salary_snapshot?: number | null;
          requires_review_snapshot?: boolean;
          regular_hours?: number;
          training_hours?: number;
          other_payments?: number;
          comment?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          regular_hours?: number;
          training_hours?: number;
          other_payments?: number;
          comment?: string | null;
          updated_at?: string;
        };
      };
      payroll_reopen_events: {
        Row: {
          id: string;
          payroll_id: string;
          company_id: string;
          reopened_by: string;
          previous_status: "submitted" | "approved";
          reason: string;
          reopened_at: string;
        };
        Insert: {
          id?: string;
          payroll_id: string;
          company_id: string;
          reopened_by: string;
          previous_status: "submitted" | "approved";
          reason: string;
          reopened_at?: string;
        };
        Update: Record<string, never>;
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
      document_views: {
        Row: DocumentViewRow;
        Insert: {
          user_id: string;
          document_id: string;
          viewed_at?: string;
        };
        Update: {
          user_id?: string;
          document_id?: string;
          viewed_at?: string;
        };
      };
    };
  };
};
