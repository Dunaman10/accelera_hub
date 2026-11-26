-- ==============================================================================
-- ACCELERA HUB — SPRINT 4 MIGRATION (SPP & DIVISI USAHA RLS)
-- Migration: 003_sprint4_spp_rls.sql
-- ==============================================================================

-- 1. Izinkan divisi_usaha memperbarui billing_submissions dari SPP_PROCESSING -> COMPLETED
DROP POLICY IF EXISTS submissions_update_divisi_usaha ON public.billing_submissions;
CREATE POLICY submissions_update_divisi_usaha
  ON public.billing_submissions
  FOR UPDATE
  TO authenticated
  USING (
    public.current_user_role() = 'divisi_usaha'
    AND current_stage IN ('SPP_PROCESSING')
  )
  WITH CHECK (
    public.current_user_role() = 'divisi_usaha'
    AND current_stage IN ('SPP_PROCESSING', 'COMPLETED')
  );

-- 2. Izinkan akuntansi juga mengembalikan ke PIC_APPROVAL dari ACCOUNTING_APPROVAL
DROP POLICY IF EXISTS submissions_update_akuntansi ON public.billing_submissions;
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
    AND current_stage IN (
      'PIC_APPROVAL',
      'ACCOUNTING_APPROVAL',
      'REVISION_ACCOUNTING',
      'SPP_PROCESSING',
      'COMPLETED'
    )
  );

-- 3. Izinkan divisi_usaha menulis stage_logs, spp_documents, dan notifications
DROP POLICY IF EXISTS stage_logs_write_internal ON public.stage_logs;
CREATE POLICY stage_logs_write_internal
  ON public.stage_logs
  FOR ALL
  TO authenticated
  USING (
    public.current_user_role() IN (
      'admin_accelera',
      'pic_usaha',
      'akuntansi',
      'divisi_usaha',
      'super_admin'
    )
  )
  WITH CHECK (
    public.current_user_role() IN (
      'admin_accelera',
      'pic_usaha',
      'akuntansi',
      'divisi_usaha',
      'super_admin'
    )
  );

DROP POLICY IF EXISTS spp_documents_insert_akuntansi ON public.spp_documents;
CREATE POLICY spp_documents_insert_akuntansi
  ON public.spp_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('divisi_usaha', 'akuntansi', 'super_admin')
  );

DROP POLICY IF EXISTS spp_documents_update_akuntansi ON public.spp_documents;
CREATE POLICY spp_documents_update_akuntansi
  ON public.spp_documents
  FOR UPDATE
  TO authenticated
  USING (
    public.current_user_role() IN ('divisi_usaha', 'akuntansi', 'super_admin')
  )
  WITH CHECK (
    public.current_user_role() IN ('divisi_usaha', 'akuntansi', 'super_admin')
  );

DROP POLICY IF EXISTS notifications_insert_workflow ON public.notifications;
CREATE POLICY notifications_insert_workflow
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() IN (
      'mitra',
      'admin_accelera',
      'pic_usaha',
      'akuntansi',
      'divisi_usaha',
      'super_admin'
    )
  );
