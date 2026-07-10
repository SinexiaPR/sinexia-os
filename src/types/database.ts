export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

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
    };
  };
};
