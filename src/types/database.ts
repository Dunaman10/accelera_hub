export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole =
  | "mitra"
  | "admin_accelera"
  | "pic_usaha"
  | "akuntansi"
  | "divisi_usaha"
  | "super_admin";

export type SubmissionStage =
  | "SUBMITTED"
  | "PRE_CHECK"
  | "REVISION_SOFTCOPY"
  | "WAITING_HARDCOPY"
  | "PHYSICAL_CHECK"
  | "REVISION_HARDCOPY"
  | "PIC_APPROVAL"
  | "REVISION_PIC"
  | "ACCOUNTING_APPROVAL"
  | "REVISION_ACCOUNTING"
  | "SPP_PROCESSING"
  | "COMPLETED"
  | "CANCELLED";

export type PrecheckStatus = "Belum Diperiksa" | "Pass" | "Revisi";

export type PhysicalStatus = "Belum Diperiksa" | "Lengkap" | "Tidak Lengkap";

export type CheckStatus = "Belum Diperiksa" | "Lulus" | "Tidak Lulus";

export type FollowupStatus =
  | "Tidak Ada"
  | "Minta Revisi"
  | "Menunggu Dokumen"
  | "Koordinasi Internal"
  | "Selesai";

export type FinalStatus =
  | "Dalam Proses"
  | "Menunggu Mitra"
  | "Selesai"
  | "Dibatalkan";

export type SlaStatus =
  | "Dalam Proses"
  | "Perlu Perhatian"
  | "Sesuai SLA"
  | "Terlambat";

export type DocCategory =
  | "INVOICE"
  | "FAKTUR_PAJAK"
  | "BAST"
  | "PO_KONTRAK"
  | "LAINNYA";

export interface Database {
  public: {
    Tables: {
      vendors: {
        Row: {
          id: string;
          name: string;
          npwp: string | null;
          address: string | null;
          pic_name: string | null;
          whatsapp_number: string | null;
          email: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          npwp?: string | null;
          address?: string | null;
          pic_name?: string | null;
          whatsapp_number?: string | null;
          email?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          npwp?: string | null;
          address?: string | null;
          pic_name?: string | null;
          whatsapp_number?: string | null;
          email?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          role: UserRole;
          vendor_id: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          email: string;
          role?: UserRole;
          vendor_id?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string;
          role?: UserRole;
          vendor_id?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
        ];
      };
      billing_submissions: {
        Row: {
          id: string;
          agenda_no: string;
          vendor_id: string;
          submitted_by: string;
          received_date: string;
          softcopy_date: string | null;
          hardcopy_date: string | null;
          invoice_no: string;
          work_type: string;
          contract_po_no: string | null;
          amount: number;
          current_stage: SubmissionStage;
          precheck_status: PrecheckStatus;
          physical_status: PhysicalStatus;
          verification_status: CheckStatus;
          validation_status: CheckStatus;
          findings: string | null;
          followup_action: FollowupStatus;
          followup_pic: string | null;
          target_finish_date: string | null;
          completed_date: string | null;
          final_status: FinalStatus;
          sla_target_days: number;
          actual_working_days: number;
          sla_status: SlaStatus;
          notes: string | null;
          drive_folder_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          agenda_no?: string;
          vendor_id: string;
          submitted_by: string;
          received_date?: string;
          softcopy_date?: string | null;
          hardcopy_date?: string | null;
          invoice_no: string;
          work_type: string;
          contract_po_no?: string | null;
          amount: number;
          current_stage?: SubmissionStage;
          precheck_status?: PrecheckStatus;
          physical_status?: PhysicalStatus;
          verification_status?: CheckStatus;
          validation_status?: CheckStatus;
          findings?: string | null;
          followup_action?: FollowupStatus;
          followup_pic?: string | null;
          target_finish_date?: string | null;
          completed_date?: string | null;
          final_status?: FinalStatus;
          sla_target_days?: number;
          actual_working_days?: number;
          sla_status?: SlaStatus;
          notes?: string | null;
          drive_folder_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          agenda_no?: string;
          vendor_id?: string;
          submitted_by?: string;
          received_date?: string;
          softcopy_date?: string | null;
          hardcopy_date?: string | null;
          invoice_no?: string;
          work_type?: string;
          contract_po_no?: string | null;
          amount?: number;
          current_stage?: SubmissionStage;
          precheck_status?: PrecheckStatus;
          physical_status?: PhysicalStatus;
          verification_status?: CheckStatus;
          validation_status?: CheckStatus;
          findings?: string | null;
          followup_action?: FollowupStatus;
          followup_pic?: string | null;
          target_finish_date?: string | null;
          completed_date?: string | null;
          final_status?: FinalStatus;
          sla_target_days?: number;
          actual_working_days?: number;
          sla_status?: SlaStatus;
          notes?: string | null;
          drive_folder_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "billing_submissions_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "billing_submissions_submitted_by_fkey";
            columns: ["submitted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      submission_documents: {
        Row: {
          id: string;
          submission_id: string;
          category: DocCategory;
          file_name: string;
          mime_type: string;
          file_size_bytes: number;
          drive_file_id: string;
          version: number;
          is_latest: boolean;
          uploaded_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          submission_id: string;
          category: DocCategory;
          file_name: string;
          mime_type: string;
          file_size_bytes: number;
          drive_file_id: string;
          version?: number;
          is_latest?: boolean;
          uploaded_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          submission_id?: string;
          category?: DocCategory;
          file_name?: string;
          mime_type?: string;
          file_size_bytes?: number;
          drive_file_id?: string;
          version?: number;
          is_latest?: boolean;
          uploaded_by?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "submission_documents_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "billing_submissions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "submission_documents_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      stage_logs: {
        Row: {
          id: string;
          submission_id: string;
          from_stage: SubmissionStage | null;
          to_stage: SubmissionStage;
          entered_at: string;
          exited_at: string | null;
          is_paused: boolean;
          working_days_spent: number;
          action_by: string | null;
          decision: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          submission_id: string;
          from_stage?: SubmissionStage | null;
          to_stage: SubmissionStage;
          entered_at?: string;
          exited_at?: string | null;
          is_paused?: boolean;
          working_days_spent?: number;
          action_by?: string | null;
          decision?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          submission_id?: string;
          from_stage?: SubmissionStage | null;
          to_stage?: SubmissionStage;
          entered_at?: string;
          exited_at?: string | null;
          is_paused?: boolean;
          working_days_spent?: number;
          action_by?: string | null;
          decision?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stage_logs_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "billing_submissions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stage_logs_action_by_fkey";
            columns: ["action_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      spp_documents: {
        Row: {
          id: string;
          submission_id: string;
          spp_no: string;
          generated_by: string;
          qr_verification_hash: string;
          drive_file_id: string | null;
          sent_to_finance_at: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          submission_id: string;
          spp_no: string;
          generated_by: string;
          qr_verification_hash: string;
          drive_file_id?: string | null;
          sent_to_finance_at?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          submission_id?: string;
          spp_no?: string;
          generated_by?: string;
          qr_verification_hash?: string;
          drive_file_id?: string | null;
          sent_to_finance_at?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "spp_documents_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: true;
            referencedRelation: "billing_submissions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "spp_documents_generated_by_fkey";
            columns: ["generated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      national_holidays: {
        Row: {
          id: string;
          holiday_date: string;
          description: string;
          is_cuti_bersama: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          holiday_date: string;
          description: string;
          is_cuti_bersama?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          holiday_date?: string;
          description?: string;
          is_cuti_bersama?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          recipient_id: string;
          submission_id: string | null;
          title: string;
          message: string;
          channel: string;
          is_read: boolean;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          recipient_id: string;
          submission_id?: string | null;
          title: string;
          message: string;
          channel?: string;
          is_read?: boolean;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          recipient_id?: string;
          submission_id?: string | null;
          title?: string;
          message?: string;
          channel?: string;
          is_read?: boolean;
          sent_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "billing_submissions";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      keep_alive: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      generate_agenda_no: {
        Args: {
          p_invoice_no?: string;
          p_ref_date?: string;
        };
        Returns: string;
      };
      current_user_role: {
        Args: Record<PropertyKey, never>;
        Returns: UserRole;
      };
      current_user_vendor_id: {
        Args: Record<PropertyKey, never>;
        Returns: string | null;
      };
      is_internal_user: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
    Enums: {
      user_role: UserRole;
      submission_stage: SubmissionStage;
      precheck_status: PrecheckStatus;
      physical_status: PhysicalStatus;
      check_status: CheckStatus;
      followup_status: FollowupStatus;
      final_status: FinalStatus;
      sla_status: SlaStatus;
      doc_category: DocCategory;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

export type Vendor = Database["public"]["Tables"]["vendors"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type BillingSubmission =
  Database["public"]["Tables"]["billing_submissions"]["Row"];
export type SubmissionDocument =
  Database["public"]["Tables"]["submission_documents"]["Row"];
export type StageLog = Database["public"]["Tables"]["stage_logs"]["Row"];
export type SppDocument = Database["public"]["Tables"]["spp_documents"]["Row"];
export type NationalHoliday =
  Database["public"]["Tables"]["national_holidays"]["Row"];
export type Notification =
  Database["public"]["Tables"]["notifications"]["Row"];
