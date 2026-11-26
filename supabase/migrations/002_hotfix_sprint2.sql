-- ==============================================================================
-- ACCELERA HUB — HOTFIX SPRINT 2
-- Migration: 002_hotfix_sprint2.sql
-- 1. Partial Unique Index anti-duplikat (vendor_id, LOWER(TRIM(invoice_no)))
--    pada tagihan aktif (final_status <> 'Dibatalkan')
-- 2. Default stage awal langsung PRE_CHECK (Pre-Check Softcopy) & penyesuaian RLS
-- ==============================================================================

-- 1. Partial Unique Index untuk mencegah duplikasi nomor invoice per vendor pada tagihan aktif
CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_submissions_active_vendor_invoice
  ON public.billing_submissions (vendor_id, lower(btrim(invoice_no)))
  WHERE final_status <> 'Dibatalkan';

-- 2. Ubah default current_stage pada billing_submissions menjadi 'PRE_CHECK'
ALTER TABLE public.billing_submissions
  ALTER COLUMN current_stage SET DEFAULT 'PRE_CHECK';

-- 3. Perbarui RLS Policy INSERT billing_submissions untuk Mitra agar mengizinkan
--    current_stage IN ('SUBMITTED', 'PRE_CHECK')
DROP POLICY IF EXISTS submissions_insert_mitra ON public.billing_submissions;
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

-- 4. Perbarui RLS Policy INSERT submission_documents untuk Mitra agar tetap bisa
--    mengunggah dokumen saat current_stage berada di 'PRE_CHECK'
DROP POLICY IF EXISTS submission_documents_insert_mitra ON public.submission_documents;
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
