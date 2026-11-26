-- ==============================================================================
-- ACCELERA HUB — INITIAL DATABASE SCHEMA & ROW LEVEL SECURITY (RLS)
-- Migration: 001_initial_schema.sql
-- ==============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==============================================================================
-- 1. ENUM TYPES
-- ==============================================================================

DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM (
    'mitra',
    'admin_accelera',
    'pic_usaha',
    'akuntansi',
    'divisi_usaha',
    'super_admin'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.submission_stage AS ENUM (
    'SUBMITTED',
    'PRE_CHECK',
    'REVISION_SOFTCOPY',
    'WAITING_HARDCOPY',
    'PHYSICAL_CHECK',
    'REVISION_HARDCOPY',
    'PIC_APPROVAL',
    'REVISION_PIC',
    'ACCOUNTING_APPROVAL',
    'REVISION_ACCOUNTING',
    'SPP_PROCESSING',
    'COMPLETED',
    'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.precheck_status AS ENUM (
    'Belum Diperiksa',
    'Pass',
    'Revisi'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.physical_status AS ENUM (
    'Belum Diperiksa',
    'Lengkap',
    'Tidak Lengkap'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.check_status AS ENUM (
    'Belum Diperiksa',
    'Lulus',
    'Tidak Lulus'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.followup_status AS ENUM (
    'Tidak Ada',
    'Minta Revisi',
    'Menunggu Dokumen',
    'Koordinasi Internal',
    'Selesai'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.final_status AS ENUM (
    'Dalam Proses',
    'Menunggu Mitra',
    'Selesai',
    'Dibatalkan'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.sla_status AS ENUM (
    'Dalam Proses',
    'Perlu Perhatian',
    'Sesuai SLA',
    'Terlambat'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.doc_category AS ENUM (
    'INVOICE',
    'FAKTUR_PAJAK',
    'BAST',
    'PO_KONTRAK',
    'LAINNYA'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ==============================================================================
-- 2. CORE TABLES (8 TABEL UTAMA)
-- ==============================================================================

-- 2.1 vendors
CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  npwp TEXT,
  address TEXT,
  pic_name TEXT,
  whatsapp_number TEXT,
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.2 profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role public.user_role NOT NULL DEFAULT 'mitra',
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.3 billing_submissions
CREATE TABLE IF NOT EXISTS public.billing_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agenda_no TEXT NOT NULL UNIQUE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  submitted_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  received_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  softcopy_date TIMESTAMPTZ DEFAULT now(),
  hardcopy_date TIMESTAMPTZ,
  invoice_no TEXT NOT NULL,
  work_type TEXT NOT NULL,
  contract_po_no TEXT,
  amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  current_stage public.submission_stage NOT NULL DEFAULT 'PRE_CHECK',
  precheck_status public.precheck_status NOT NULL DEFAULT 'Belum Diperiksa',
  physical_status public.physical_status NOT NULL DEFAULT 'Belum Diperiksa',
  verification_status public.check_status NOT NULL DEFAULT 'Belum Diperiksa',
  validation_status public.check_status NOT NULL DEFAULT 'Belum Diperiksa',
  findings TEXT,
  followup_action public.followup_status NOT NULL DEFAULT 'Tidak Ada',
  followup_pic TEXT,
  target_finish_date DATE,
  completed_date TIMESTAMPTZ,
  final_status public.final_status NOT NULL DEFAULT 'Dalam Proses',
  sla_target_days INT NOT NULL DEFAULT 6,
  actual_working_days NUMERIC(6,2) NOT NULL DEFAULT 0,
  sla_status public.sla_status NOT NULL DEFAULT 'Dalam Proses',
  notes TEXT,
  drive_folder_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.4 submission_documents
CREATE TABLE IF NOT EXISTS public.submission_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.billing_submissions(id) ON DELETE CASCADE,
  category public.doc_category NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes >= 0),
  drive_file_id TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1 CHECK (version >= 1),
  is_latest BOOLEAN NOT NULL DEFAULT true,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.5 stage_logs
CREATE TABLE IF NOT EXISTS public.stage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.billing_submissions(id) ON DELETE CASCADE,
  from_stage public.submission_stage,
  to_stage public.submission_stage NOT NULL,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  exited_at TIMESTAMPTZ,
  is_paused BOOLEAN NOT NULL DEFAULT false,
  working_days_spent NUMERIC(6,2) NOT NULL DEFAULT 0,
  action_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  decision TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.6 spp_documents
CREATE TABLE IF NOT EXISTS public.spp_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL UNIQUE REFERENCES public.billing_submissions(id) ON DELETE RESTRICT,
  spp_no TEXT NOT NULL UNIQUE,
  generated_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  qr_verification_hash TEXT NOT NULL UNIQUE,
  drive_file_id TEXT,
  sent_to_finance_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.7 national_holidays
CREATE TABLE IF NOT EXISTS public.national_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date DATE NOT NULL UNIQUE,
  description TEXT NOT NULL,
  is_cuti_bersama BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.8 notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES public.billing_submissions(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'IN_APP',
  is_read BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 3. INDEXES
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_vendors_is_active ON public.vendors(is_active);
CREATE INDEX IF NOT EXISTS idx_vendors_npwp ON public.vendors(npwp);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_vendor_id ON public.profiles(vendor_id);

CREATE INDEX IF NOT EXISTS idx_billing_submissions_vendor_id ON public.billing_submissions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_billing_submissions_submitted_by ON public.billing_submissions(submitted_by);
CREATE INDEX IF NOT EXISTS idx_billing_submissions_current_stage ON public.billing_submissions(current_stage);
CREATE INDEX IF NOT EXISTS idx_billing_submissions_final_status ON public.billing_submissions(final_status);
CREATE INDEX IF NOT EXISTS idx_billing_submissions_sla_status ON public.billing_submissions(sla_status);
CREATE INDEX IF NOT EXISTS idx_billing_submissions_received_date ON public.billing_submissions(received_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_submissions_active_vendor_invoice
  ON public.billing_submissions (vendor_id, lower(btrim(invoice_no)))
  WHERE final_status <> 'Dibatalkan';

CREATE INDEX IF NOT EXISTS idx_submission_documents_submission_id ON public.submission_documents(submission_id);
CREATE INDEX IF NOT EXISTS idx_submission_documents_latest ON public.submission_documents(submission_id, category) WHERE is_latest = true;
CREATE INDEX IF NOT EXISTS idx_submission_documents_drive_file_id ON public.submission_documents(drive_file_id);

CREATE INDEX IF NOT EXISTS idx_stage_logs_submission_id ON public.stage_logs(submission_id, entered_at DESC);
CREATE INDEX IF NOT EXISTS idx_stage_logs_open ON public.stage_logs(submission_id) WHERE exited_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_spp_documents_qr_hash ON public.spp_documents(qr_verification_hash);

CREATE INDEX IF NOT EXISTS idx_national_holidays_date ON public.national_holidays(holiday_date);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread ON public.notifications(recipient_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_submission_id ON public.notifications(submission_id);

-- ==============================================================================
-- 4. HELPER FUNCTIONS & TRIGGERS
-- ==============================================================================

-- 4.1 Healthcheck / Anti-Pause helper function (SELECT 1)
CREATE OR REPLACE FUNCTION public.keep_alive()
RETURNS INT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 1;
$$;

GRANT EXECUTE ON FUNCTION public.keep_alive() TO anon, authenticated, service_role;

-- 4.2 Trigger function untuk auto-update kolom updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vendors_updated_at ON public.vendors;
CREATE TRIGGER trg_vendors_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_billing_submissions_updated_at ON public.billing_submissions;
CREATE TRIGGER trg_billing_submissions_updated_at
  BEFORE UPDATE ON public.billing_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 4.2 Helper Function: generate_agenda_no()
-- Format: AGP/SSS/{NO_INVOICE_PREFIX}/{BULAN_ROMAWI}/{TAHUN_2DIGIT}/{URUT_3DIGIT}
CREATE OR REPLACE FUNCTION public.generate_agenda_no(
  p_invoice_no TEXT DEFAULT 'INV',
  p_ref_date TIMESTAMPTZ DEFAULT now()
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_local_ts TIMESTAMP;
  v_month INT;
  v_roman_month TEXT;
  v_year_2digit TEXT;
  v_raw_prefix TEXT;
  v_invoice_prefix TEXT;
  v_next_seq INT;
  v_roman_months CONSTANT TEXT[] := ARRAY[
    'I', 'II', 'III', 'IV', 'V', 'VI',
    'VII', 'VIII', 'IX', 'X', 'XI', 'XII'
  ];
BEGIN
  -- Gunakan zona waktu WIB (Asia/Jakarta)
  v_local_ts := COALESCE(p_ref_date, now()) AT TIME ZONE 'Asia/Jakarta';
  v_month := EXTRACT(MONTH FROM v_local_ts)::INT;
  v_roman_month := v_roman_months[v_month];
  v_year_2digit := to_char(v_local_ts, 'YY');

  -- Ekstrak segmen pertama dari nomor invoice & sanitasi hanya karakter alfanumerik/dash
  v_raw_prefix := split_part(COALESCE(btrim(p_invoice_no), ''), '/', 1);
  v_invoice_prefix := upper(regexp_replace(v_raw_prefix, '[^A-Za-z0-9\-]', '', 'g'));
  IF v_invoice_prefix = '' THEN
    v_invoice_prefix := 'INV';
  END IF;
  v_invoice_prefix := left(v_invoice_prefix, 12);

  -- Kunci transaksi per tahun agar nomor urut 3 digit bebas race-condition saat konkuren
  PERFORM pg_advisory_xact_lock(hashtext('accelera_agenda_seq_' || v_year_2digit));

  SELECT COALESCE(
    MAX((regexp_match(bs.agenda_no, '/([0-9]+)$'))[1]::INT),
    0
  ) + 1
  INTO v_next_seq
  FROM public.billing_submissions bs
  WHERE bs.agenda_no LIKE ('AGP/SSS/%/' || v_year_2digit || '/%');

  RETURN format(
    'AGP/SSS/%s/%s/%s/%s',
    v_invoice_prefix,
    v_roman_month,
    v_year_2digit,
    lpad(v_next_seq::TEXT, 3, '0')
  );
END;
$$;

-- Trigger otomatis mengisi agenda_no bila kosong saat INSERT billing_submissions
CREATE OR REPLACE FUNCTION public.trg_assign_agenda_no()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.agenda_no IS NULL OR btrim(NEW.agenda_no) = '' THEN
    NEW.agenda_no := public.generate_agenda_no(
      NEW.invoice_no,
      COALESCE(NEW.received_date, now())
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_submissions_agenda_no ON public.billing_submissions;
CREATE TRIGGER trg_billing_submissions_agenda_no
  BEFORE INSERT ON public.billing_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_assign_agenda_no();

-- 4.3 Trigger sinkronisasi user baru dari auth.users ke public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.user_role := 'mitra';
  v_vendor_id UUID := NULL;
BEGIN
  IF NEW.raw_user_meta_data ? 'role' THEN
    BEGIN
      v_role := (NEW.raw_user_meta_data->>'role')::public.user_role;
    EXCEPTION WHEN OTHERS THEN
      v_role := 'mitra';
    END;
  END IF;

  IF NEW.raw_user_meta_data ? 'vendor_id' AND (NEW.raw_user_meta_data->>'vendor_id') <> '' THEN
    BEGIN
      v_vendor_id := (NEW.raw_user_meta_data->>'vendor_id')::UUID;
    EXCEPTION WHEN OTHERS THEN
      v_vendor_id := NULL;
    END;
  END IF;

  INSERT INTO public.profiles (id, full_name, email, role, vendor_id)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'), ''), split_part(COALESCE(NEW.email, 'User'), '@', 1)),
    COALESCE(NEW.email, ''),
    v_role,
    v_vendor_id
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- ==============================================================================
-- 5. RLS HELPER FUNCTIONS (SECURITY DEFINER — MENCEGAH REKURSI PROFILES)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.role
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_vendor_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.vendor_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_internal_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_active = true
      AND p.role IN (
        'admin_accelera',
        'pic_usaha',
        'akuntansi',
        'divisi_usaha',
        'super_admin'
      )
  );
$$;

-- ==============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spp_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.national_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 6.1 Policies: vendors
-- ------------------------------------------------------------------------------
CREATE POLICY vendors_select_policy
  ON public.vendors
  FOR SELECT
  TO authenticated
  USING (
    public.is_internal_user()
    OR id = public.current_user_vendor_id()
  );

CREATE POLICY vendors_insert_internal
  ON public.vendors
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('admin_accelera', 'super_admin')
  );

CREATE POLICY vendors_update_internal
  ON public.vendors
  FOR UPDATE
  TO authenticated
  USING (
    public.current_user_role() IN ('admin_accelera', 'super_admin')
  )
  WITH CHECK (
    public.current_user_role() IN ('admin_accelera', 'super_admin')
  );

CREATE POLICY vendors_delete_super_admin
  ON public.vendors
  FOR DELETE
  TO authenticated
  USING (
    public.current_user_role() = 'super_admin'
  );

-- ------------------------------------------------------------------------------
-- 6.2 Policies: profiles
-- ------------------------------------------------------------------------------
CREATE POLICY profiles_select_policy
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.is_internal_user()
  );

CREATE POLICY profiles_insert_admin
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('admin_accelera', 'super_admin')
  );

-- User hanya dapat memperbarui profil miliknya tanpa mengubah role/vendor_id/status aktif
CREATE POLICY profiles_update_self
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = public.current_user_role()
    AND vendor_id IS NOT DISTINCT FROM public.current_user_vendor_id()
    AND is_active = true
  );

CREATE POLICY profiles_update_super_admin
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY profiles_delete_super_admin
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (public.current_user_role() = 'super_admin');

-- ------------------------------------------------------------------------------
-- 6.3 Policies: billing_submissions
-- ------------------------------------------------------------------------------
-- SELECT: Mitra hanya melihat vendor_id sendiri; seluruh role internal bisa melihat semua
CREATE POLICY submissions_select_policy
  ON public.billing_submissions
  FOR SELECT
  TO authenticated
  USING (
    public.is_internal_user()
    OR (
      public.current_user_role() = 'mitra'
      AND vendor_id = public.current_user_vendor_id()
    )
  );

-- INSERT: Mitra hanya untuk vendor_id sendiri & stage awal SUBMITTED / PRE_CHECK; Admin/Super Admin juga diizinkan
CREATE POLICY submissions_insert_mitra
  ON public.billing_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() = 'mitra'
    AND vendor_id = public.current_user_vendor_id()
    AND submitted_by = auth.uid()
    AND current_stage IN ('SUBMITTED', 'PRE_CHECK')
  );

CREATE POLICY submissions_insert_internal
  ON public.billing_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('admin_accelera', 'super_admin')
  );

-- UPDATE Mitra: HANYA milik vendor_id sendiri DAN HANYA saat berstatus revisi / Menunggu Mitra
CREATE POLICY submissions_update_mitra_revision_only
  ON public.billing_submissions
  FOR UPDATE
  TO authenticated
  USING (
    public.current_user_role() = 'mitra'
    AND vendor_id = public.current_user_vendor_id()
    AND (
      current_stage IN (
        'REVISION_SOFTCOPY',
        'REVISION_HARDCOPY',
        'REVISION_PIC',
        'REVISION_ACCOUNTING'
      )
      OR final_status = 'Menunggu Mitra'
    )
  )
  WITH CHECK (
    public.current_user_role() = 'mitra'
    AND vendor_id = public.current_user_vendor_id()
    AND current_stage IN (
      'SUBMITTED',
      'PRE_CHECK',
      'REVISION_SOFTCOPY',
      'WAITING_HARDCOPY',
      'PHYSICAL_CHECK',
      'REVISION_HARDCOPY',
      'REVISION_PIC',
      'REVISION_ACCOUNTING'
    )
  );

-- UPDATE Admin Accelera: Pre-check softcopy, penerimaan & cek fisik hardcopy, Drive folder, catatan
CREATE POLICY submissions_update_admin_accelera
  ON public.billing_submissions
  FOR UPDATE
  TO authenticated
  USING (
    public.current_user_role() = 'admin_accelera'
    AND current_stage IN (
      'SUBMITTED',
      'PRE_CHECK',
      'REVISION_SOFTCOPY',
      'WAITING_HARDCOPY',
      'PHYSICAL_CHECK',
      'REVISION_HARDCOPY',
      'REVISION_PIC',
      'REVISION_ACCOUNTING'
    )
  )
  WITH CHECK (
    public.current_user_role() = 'admin_accelera'
    AND current_stage IN (
      'SUBMITTED',
      'PRE_CHECK',
      'REVISION_SOFTCOPY',
      'WAITING_HARDCOPY',
      'PHYSICAL_CHECK',
      'REVISION_HARDCOPY',
      'PIC_APPROVAL',
      'CANCELLED'
    )
  );

-- UPDATE PIC Usaha: Kewenangan verifikasi substansi pekerjaan pada tahap PIC_APPROVAL
CREATE POLICY submissions_update_pic_usaha
  ON public.billing_submissions
  FOR UPDATE
  TO authenticated
  USING (
    public.current_user_role() = 'pic_usaha'
    AND current_stage IN ('PIC_APPROVAL', 'REVISION_PIC')
  )
  WITH CHECK (
    public.current_user_role() = 'pic_usaha'
    AND current_stage IN ('PIC_APPROVAL', 'REVISION_PIC', 'ACCOUNTING_APPROVAL')
  );

-- UPDATE Akuntansi: Kewenangan validasi pajak/keuangan & penerbitan SPP
CREATE POLICY submissions_update_akuntansi
  ON public.billing_submissions
  FOR UPDATE
  TO authenticated
  USING (
    public.current_user_role() = 'akuntansi'
    AND current_stage IN ('ACCOUNTING_APPROVAL', 'REVISION_ACCOUNTING', 'SPP_PROCESSING')
  )
  WITH CHECK (
    public.current_user_role() = 'akuntansi'
    AND current_stage IN ('ACCOUNTING_APPROVAL', 'REVISION_ACCOUNTING', 'SPP_PROCESSING', 'COMPLETED')
  );

-- UPDATE & DELETE Super Admin: Akses penuh pemeliharaan sistem
CREATE POLICY submissions_update_super_admin
  ON public.billing_submissions
  FOR UPDATE
  TO authenticated
  USING (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY submissions_delete_super_admin
  ON public.billing_submissions
  FOR DELETE
  TO authenticated
  USING (public.current_user_role() = 'super_admin');

-- ------------------------------------------------------------------------------
-- 6.4 Policies: submission_documents
-- ------------------------------------------------------------------------------
CREATE POLICY submission_documents_select_policy
  ON public.submission_documents
  FOR SELECT
  TO authenticated
  USING (
    public.is_internal_user()
    OR (
      public.current_user_role() = 'mitra'
      AND EXISTS (
        SELECT 1
        FROM public.billing_submissions bs
        WHERE bs.id = submission_documents.submission_id
          AND bs.vendor_id = public.current_user_vendor_id()
      )
    )
  );

-- Mitra boleh upload dokumen saat pengajuan awal (SUBMITTED) atau saat status revisi
CREATE POLICY submission_documents_insert_mitra
  ON public.submission_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() = 'mitra'
    AND uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.billing_submissions bs
      WHERE bs.id = submission_documents.submission_id
        AND bs.vendor_id = public.current_user_vendor_id()
        AND (
          bs.current_stage IN (
            'SUBMITTED',
            'PRE_CHECK',
            'REVISION_SOFTCOPY',
            'REVISION_HARDCOPY',
            'REVISION_PIC',
            'REVISION_ACCOUNTING'
          )
          OR bs.final_status = 'Menunggu Mitra'
        )
    )
  );

CREATE POLICY submission_documents_update_mitra_revision
  ON public.submission_documents
  FOR UPDATE
  TO authenticated
  USING (
    public.current_user_role() = 'mitra'
    AND EXISTS (
      SELECT 1
      FROM public.billing_submissions bs
      WHERE bs.id = submission_documents.submission_id
        AND bs.vendor_id = public.current_user_vendor_id()
        AND (
          bs.current_stage IN (
            'REVISION_SOFTCOPY',
            'REVISION_HARDCOPY',
            'REVISION_PIC',
            'REVISION_ACCOUNTING'
          )
          OR bs.final_status = 'Menunggu Mitra'
        )
    )
  )
  WITH CHECK (
    public.current_user_role() = 'mitra'
    AND EXISTS (
      SELECT 1
      FROM public.billing_submissions bs
      WHERE bs.id = submission_documents.submission_id
        AND bs.vendor_id = public.current_user_vendor_id()
    )
  );

CREATE POLICY submission_documents_write_internal
  ON public.submission_documents
  FOR ALL
  TO authenticated
  USING (
    public.current_user_role() IN ('admin_accelera', 'akuntansi', 'super_admin')
  )
  WITH CHECK (
    public.current_user_role() IN ('admin_accelera', 'akuntansi', 'super_admin')
  );

-- ------------------------------------------------------------------------------
-- 6.5 Policies: stage_logs
-- ------------------------------------------------------------------------------
CREATE POLICY stage_logs_select_policy
  ON public.stage_logs
  FOR SELECT
  TO authenticated
  USING (
    public.is_internal_user()
    OR (
      public.current_user_role() = 'mitra'
      AND EXISTS (
        SELECT 1
        FROM public.billing_submissions bs
        WHERE bs.id = stage_logs.submission_id
          AND bs.vendor_id = public.current_user_vendor_id()
      )
    )
  );

CREATE POLICY stage_logs_insert_mitra
  ON public.stage_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() = 'mitra'
    AND action_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.billing_submissions bs
      WHERE bs.id = stage_logs.submission_id
        AND bs.vendor_id = public.current_user_vendor_id()
    )
  );

CREATE POLICY stage_logs_write_internal
  ON public.stage_logs
  FOR ALL
  TO authenticated
  USING (
    public.current_user_role() IN ('admin_accelera', 'pic_usaha', 'akuntansi', 'super_admin')
  )
  WITH CHECK (
    public.current_user_role() IN ('admin_accelera', 'pic_usaha', 'akuntansi', 'super_admin')
  );

-- ------------------------------------------------------------------------------
-- 6.6 Policies: spp_documents
-- ------------------------------------------------------------------------------
CREATE POLICY spp_documents_select_policy
  ON public.spp_documents
  FOR SELECT
  TO authenticated
  USING (
    public.is_internal_user()
    OR (
      public.current_user_role() = 'mitra'
      AND EXISTS (
        SELECT 1
        FROM public.billing_submissions bs
        WHERE bs.id = spp_documents.submission_id
          AND bs.vendor_id = public.current_user_vendor_id()
      )
    )
  );

CREATE POLICY spp_documents_insert_akuntansi
  ON public.spp_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('akuntansi', 'super_admin')
  );

CREATE POLICY spp_documents_update_akuntansi
  ON public.spp_documents
  FOR UPDATE
  TO authenticated
  USING (
    public.current_user_role() IN ('akuntansi', 'super_admin')
  )
  WITH CHECK (
    public.current_user_role() IN ('akuntansi', 'super_admin')
  );

CREATE POLICY spp_documents_delete_super_admin
  ON public.spp_documents
  FOR DELETE
  TO authenticated
  USING (
    public.current_user_role() = 'super_admin'
  );

-- ------------------------------------------------------------------------------
-- 6.7 Policies: national_holidays
-- ------------------------------------------------------------------------------
CREATE POLICY national_holidays_select_authenticated
  ON public.national_holidays
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY national_holidays_write_admin
  ON public.national_holidays
  FOR ALL
  TO authenticated
  USING (
    public.current_user_role() IN ('admin_accelera', 'super_admin')
  )
  WITH CHECK (
    public.current_user_role() IN ('admin_accelera', 'super_admin')
  );

-- ------------------------------------------------------------------------------
-- 6.8 Policies: notifications
-- ------------------------------------------------------------------------------
CREATE POLICY notifications_select_own
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (
    recipient_id = auth.uid()
    OR public.current_user_role() = 'super_admin'
  );

CREATE POLICY notifications_update_own
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (
    recipient_id = auth.uid()
    OR public.current_user_role() = 'super_admin'
  )
  WITH CHECK (
    recipient_id = auth.uid()
    OR public.current_user_role() = 'super_admin'
  );

CREATE POLICY notifications_insert_workflow
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('mitra', 'admin_accelera', 'pic_usaha', 'akuntansi', 'super_admin')
  );

CREATE POLICY notifications_delete_super_admin
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (
    public.current_user_role() = 'super_admin'
  );
