-- ==============================================================================
-- ACCELERA HUB — SLA WORKING DAYS ENGINE, AUTO-PAUSE & NATIONAL HOLIDAYS SEED
-- Migration: 002_sla_engine.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PERLUASAN SKEMA TABEL national_holidays & stage_logs (KOMPATIBEL PENUH)
-- ------------------------------------------------------------------------------

-- 1.1 Tambahkan kolom `year` dan `is_joint_leave` pada `national_holidays`
--     serta sinkronkan dua arah dengan `is_cuti_bersama`
ALTER TABLE public.national_holidays
  ADD COLUMN IF NOT EXISTS year INT,
  ADD COLUMN IF NOT EXISTS is_joint_leave BOOLEAN NOT NULL DEFAULT false;

UPDATE public.national_holidays
SET
  year = COALESCE(year, EXTRACT(YEAR FROM holiday_date)::INT),
  is_joint_leave = COALESCE(is_cuti_bersama, is_joint_leave, false);

ALTER TABLE public.national_holidays
  ALTER COLUMN year SET NOT NULL;

CREATE OR REPLACE FUNCTION public.trg_sync_national_holidays_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.holiday_date IS NOT NULL THEN
    NEW.year := COALESCE(NEW.year, EXTRACT(YEAR FROM NEW.holiday_date)::INT);
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.is_joint_leave IS TRUE AND NEW.is_cuti_bersama IS FALSE THEN
      NEW.is_cuti_bersama := true;
    ELSIF NEW.is_cuti_bersama IS TRUE AND NEW.is_joint_leave IS FALSE THEN
      NEW.is_joint_leave := true;
    END IF;
  ELSE
    IF NEW.is_joint_leave IS DISTINCT FROM OLD.is_joint_leave THEN
      NEW.is_cuti_bersama := NEW.is_joint_leave;
    ELSIF NEW.is_cuti_bersama IS DISTINCT FROM OLD.is_cuti_bersama THEN
      NEW.is_joint_leave := NEW.is_cuti_bersama;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_national_holidays_sync ON public.national_holidays;
CREATE TRIGGER trg_national_holidays_sync
  BEFORE INSERT OR UPDATE ON public.national_holidays
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_national_holidays_fields();

CREATE INDEX IF NOT EXISTS idx_national_holidays_year ON public.national_holidays(year, holiday_date);

-- 1.2 Tambahkan kolom `is_internal_sla`, `working_days_used`, dan `ended_at` pada `stage_logs`
--     agar kompatibel penuh dengan `is_paused`, `working_days_spent`, dan `exited_at`
ALTER TABLE public.stage_logs
  ADD COLUMN IF NOT EXISTS is_internal_sla BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS working_days_used NUMERIC(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

UPDATE public.stage_logs
SET
  is_internal_sla = NOT COALESCE(is_paused, false),
  working_days_used = COALESCE(working_days_spent, 0),
  ended_at = exited_at;

CREATE OR REPLACE FUNCTION public.trg_sync_stage_logs_sla_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_paused IS TRUE THEN
      NEW.is_internal_sla := false;
    ELSIF NEW.is_internal_sla IS FALSE THEN
      NEW.is_paused := true;
    ELSE
      NEW.is_internal_sla := true;
      NEW.is_paused := false;
    END IF;

    NEW.ended_at := COALESCE(NEW.ended_at, NEW.exited_at);
    NEW.exited_at := COALESCE(NEW.exited_at, NEW.ended_at);

    NEW.working_days_used := COALESCE(NULLIF(NEW.working_days_used, 0), NEW.working_days_spent, 0);
    NEW.working_days_spent := COALESCE(NULLIF(NEW.working_days_spent, 0), NEW.working_days_used, 0);
  ELSE
    IF NEW.is_paused IS DISTINCT FROM OLD.is_paused THEN
      NEW.is_internal_sla := NOT NEW.is_paused;
    ELSIF NEW.is_internal_sla IS DISTINCT FROM OLD.is_internal_sla THEN
      NEW.is_paused := NOT NEW.is_internal_sla;
    END IF;

    IF NEW.exited_at IS DISTINCT FROM OLD.exited_at THEN
      NEW.ended_at := NEW.exited_at;
    ELSIF NEW.ended_at IS DISTINCT FROM OLD.ended_at THEN
      NEW.exited_at := NEW.ended_at;
    END IF;

    IF NEW.working_days_spent IS DISTINCT FROM OLD.working_days_spent THEN
      NEW.working_days_used := NEW.working_days_spent;
    ELSIF NEW.working_days_used IS DISTINCT FROM OLD.working_days_used THEN
      NEW.working_days_spent := NEW.working_days_used;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stage_logs_sync_sla ON public.stage_logs;
CREATE TRIGGER trg_stage_logs_sync_sla
  BEFORE INSERT OR UPDATE ON public.stage_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_stage_logs_sla_fields();

-- ------------------------------------------------------------------------------
-- 2. SEED DATA HARI LIBUR NASIONAL & CUTI BERSAMA INDONESIA (2026 - 2027)
-- ------------------------------------------------------------------------------

INSERT INTO public.national_holidays (holiday_date, description, year, is_joint_leave, is_cuti_bersama)
VALUES
  -- 2026
  ('2026-01-01', 'Tahun Baru 2026 Masehi', 2026, false, false),
  ('2026-01-16', 'Isra Mikraj Nabi Muhammad SAW', 2026, false, false),
  ('2026-02-16', 'Cuti Bersama Tahun Baru Imlek 2577 Kongzili', 2026, true, true),
  ('2026-02-17', 'Tahun Baru Imlek 2577 Kongzili', 2026, false, false),
  ('2026-03-18', 'Cuti Bersama Hari Suci Nyepi Tahun Baru Saka 1948', 2026, true, true),
  ('2026-03-19', 'Hari Suci Nyepi Tahun Baru Saka 1948', 2026, false, false),
  ('2026-03-20', 'Hari Raya Idul Fitri 1447 Hijriah (Hari Pertama)', 2026, false, false),
  ('2026-03-21', 'Hari Raya Idul Fitri 1447 Hijriah (Hari Kedua)', 2026, false, false),
  ('2026-03-23', 'Cuti Bersama Hari Raya Idul Fitri 1447 Hijriah', 2026, true, true),
  ('2026-03-24', 'Cuti Bersama Hari Raya Idul Fitri 1447 Hijriah', 2026, true, true),
  ('2026-03-25', 'Cuti Bersama Hari Raya Idul Fitri 1447 Hijriah', 2026, true, true),
  ('2026-04-03', 'Wafat Yesus Kristus (Jumat Agung)', 2026, false, false),
  ('2026-05-01', 'Hari Buruh Internasional', 2026, false, false),
  ('2026-05-14', 'Kenaikan Yesus Kristus', 2026, false, false),
  ('2026-05-15', 'Cuti Bersama Kenaikan Yesus Kristus', 2026, true, true),
  ('2026-05-27', 'Hari Raya Idul Adha 1447 Hijriah', 2026, false, false),
  ('2026-05-28', 'Cuti Bersama Hari Raya Idul Adha 1447 Hijriah', 2026, true, true),
  ('2026-05-31', 'Hari Raya Waisak 2570 BE', 2026, false, false),
  ('2026-06-01', 'Hari Lahir Pancasila', 2026, false, false),
  ('2026-06-16', 'Tahun Baru Islam 1448 Hijriah', 2026, false, false),
  ('2026-08-17', 'Hari Kemerdekaan Republik Indonesia ke-81', 2026, false, false),
  ('2026-08-25', 'Maulid Nabi Muhammad SAW', 2026, false, false),
  ('2026-12-24', 'Cuti Bersama Hari Raya Natal', 2026, true, true),
  ('2026-12-25', 'Hari Raya Natal', 2026, false, false),
  -- 2027
  ('2027-01-01', 'Tahun Baru 2027 Masehi', 2027, false, false),
  ('2027-01-05', 'Isra Mikraj Nabi Muhammad SAW', 2027, false, false),
  ('2027-02-05', 'Cuti Bersama Tahun Baru Imlek 2578 Kongzili', 2027, true, true),
  ('2027-02-06', 'Tahun Baru Imlek 2578 Kongzili', 2027, false, false),
  ('2027-03-08', 'Cuti Bersama Hari Raya Idul Fitri 1448 Hijriah', 2027, true, true),
  ('2027-03-09', 'Hari Raya Idul Fitri 1448 Hijriah (Hari Pertama)', 2027, false, false),
  ('2027-03-10', 'Hari Raya Idul Fitri 1448 Hijriah (Hari Kedua)', 2027, false, false),
  ('2027-03-11', 'Cuti Bersama Hari Raya Idul Fitri 1448 Hijriah', 2027, true, true),
  ('2027-03-12', 'Cuti Bersama Hari Raya Idul Fitri 1448 Hijriah', 2027, true, true),
  ('2027-03-26', 'Wafat Yesus Kristus (Jumat Agung)', 2027, false, false),
  ('2027-04-08', 'Hari Suci Nyepi Tahun Baru Saka 1949', 2027, false, false),
  ('2027-04-09', 'Cuti Bersama Hari Suci Nyepi Tahun Baru Saka 1949', 2027, true, true),
  ('2027-05-01', 'Hari Buruh Internasional', 2027, false, false),
  ('2027-05-06', 'Kenaikan Yesus Kristus', 2027, false, false),
  ('2027-05-07', 'Cuti Bersama Kenaikan Yesus Kristus', 2027, true, true),
  ('2027-05-16', 'Hari Raya Idul Adha 1448 Hijriah', 2027, false, false),
  ('2027-05-17', 'Cuti Bersama Hari Raya Idul Adha 1448 Hijriah', 2027, true, true),
  ('2027-05-20', 'Hari Raya Waisak 2571 BE', 2027, false, false),
  ('2027-06-01', 'Hari Lahir Pancasila', 2027, false, false),
  ('2027-06-06', 'Tahun Baru Islam 1449 Hijriah', 2027, false, false),
  ('2027-08-14', 'Maulid Nabi Muhammad SAW', 2027, false, false),
  ('2027-08-17', 'Hari Kemerdekaan Republik Indonesia ke-82', 2027, false, false),
  ('2027-12-24', 'Cuti Bersama Hari Raya Natal', 2027, true, true),
  ('2027-12-25', 'Hari Raya Natal', 2027, false, false)
ON CONFLICT (holiday_date) DO UPDATE
SET
  description = EXCLUDED.description,
  year = EXCLUDED.year,
  is_joint_leave = EXCLUDED.is_joint_leave,
  is_cuti_bersama = EXCLUDED.is_cuti_bersama;

-- ------------------------------------------------------------------------------
-- 3. FUNGSI POSTGRESQL: calculate_working_days(start_ts, end_ts) RETURNS numeric
-- ------------------------------------------------------------------------------
-- Menghitung jumlah hari kerja (zona waktu Asia/Jakarta / WIB) antara start_ts dan end_ts,
-- mengecualikan hari Sabtu (ISODOW = 6), Minggu (ISODOW = 7), dan seluruh tanggal di `national_holidays`.
-- Menggunakan irisan interval per hari kalender WIB agar akurat terhadap pecahan jam.

CREATE OR REPLACE FUNCTION public.calculate_working_days(
  start_ts TIMESTAMPTZ,
  end_ts TIMESTAMPTZ
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_wib TIMESTAMP;
  v_end_wib TIMESTAMP;
  v_cur_date DATE;
  v_end_date DATE;
  v_day_start TIMESTAMP;
  v_day_end TIMESTAMP;
  v_slice_start TIMESTAMP;
  v_slice_end TIMESTAMP;
  v_is_holiday BOOLEAN;
  v_dow INT;
  v_total_seconds NUMERIC := 0;
BEGIN
  IF start_ts IS NULL OR end_ts IS NULL OR end_ts <= start_ts THEN
    RETURN 0;
  END IF;

  v_start_wib := start_ts AT TIME ZONE 'Asia/Jakarta';
  v_end_wib := end_ts AT TIME ZONE 'Asia/Jakarta';

  v_cur_date := v_start_wib::DATE;
  v_end_date := v_end_wib::DATE;

  WHILE v_cur_date <= v_end_date LOOP
    v_dow := EXTRACT(ISODOW FROM v_cur_date)::INT;

    -- Sabtu = 6, Minggu = 7
    IF v_dow NOT IN (6, 7) THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.national_holidays nh
        WHERE nh.holiday_date = v_cur_date
      )
      INTO v_is_holiday;

      IF NOT v_is_holiday THEN
        v_day_start := v_cur_date::TIMESTAMP;
        v_day_end := (v_cur_date + INTERVAL '1 day')::TIMESTAMP;

        v_slice_start := GREATEST(v_start_wib, v_day_start);
        v_slice_end := LEAST(v_end_wib, v_day_end);

        IF v_slice_end > v_slice_start THEN
          v_total_seconds := v_total_seconds + EXTRACT(EPOCH FROM (v_slice_end - v_slice_start));
        END IF;
      END IF;
    END IF;

    v_cur_date := v_cur_date + 1;
  END LOOP;

  RETURN ROUND((v_total_seconds / 86400.0)::NUMERIC, 2);
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_working_days(TIMESTAMPTZ, TIMESTAMPTZ) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. FUNGSI POSTGRESQL: recalculate_submission_sla(p_submission_id uuid)
-- ------------------------------------------------------------------------------
-- 1. Menghitung `working_days_used` (dan `working_days_spent`) pada setiap baris `stage_logs`:
--    - Jika `is_internal_sla = true` (dan `is_paused = false`), hitung `calculate_working_days(entered_at, COALESCE(ended_at, exited_at, NOW()))`
--    - Jika baris pause / `Menunggu Mitra` (`is_internal_sla = false` atau `is_paused = true`), durasi = 0
-- 2. Menjumlahkan HANYA baris dengan `is_internal_sla = true`
-- 3. Menentukan status SLA otomatis (target default `sla_target_days = 6`):
--    - `final_status = 'Selesai'` & total <= target -> `'Sesuai SLA'`
--    - total > target -> `'Terlambat'`
--    - masih berjalan & (total >= 4.5 hk atau memasuki hari kerja ke-5, atau sisa kuota tahap aktif <= 25%) -> `'Perlu Perhatian'`
--    - selain itu -> `'Dalam Proses'`

CREATE OR REPLACE FUNCTION public.recalculate_submission_sla(
  p_submission_id UUID
)
RETURNS TABLE (
  submission_id UUID,
  actual_working_days NUMERIC(6,2),
  sla_target_days INT,
  sla_status public.sla_status,
  is_paused BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub RECORD;
  v_log RECORD;
  v_end_ts TIMESTAMPTZ;
  v_log_days NUMERIC(6,2);
  v_total_days NUMERIC(6,2) := 0;
  v_target_days INT := 6;
  v_new_sla_status public.sla_status := 'Dalam Proses';
  v_active_stage_quota NUMERIC(6,2) := 1;
  v_active_stage_elapsed NUMERIC(6,2) := 0;
  v_active_stage_remaining_ratio NUMERIC(6,4) := 1;
  v_is_currently_paused BOOLEAN := false;
BEGIN
  SELECT *
  INTO v_sub
  FROM public.billing_submissions bs
  WHERE bs.id = p_submission_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_target_days := COALESCE(NULLIF(v_sub.sla_target_days, 0), 6);

  -- Iterasi seluruh stage_logs milik pengajuan ini
  FOR v_log IN
    SELECT *
    FROM public.stage_logs sl
    WHERE sl.submission_id = p_submission_id
    ORDER BY sl.entered_at ASC
  LOOP
    v_end_ts := COALESCE(v_log.ended_at, v_log.exited_at, now());

    IF v_log.is_internal_sla IS TRUE AND COALESCE(v_log.is_paused, false) IS FALSE THEN
      v_log_days := public.calculate_working_days(v_log.entered_at, v_end_ts);
      v_total_days := v_total_days + v_log_days;
    ELSE
      v_log_days := 0;
    END IF;

    -- Perbarui nilai working_days_used & working_days_spent pada stage_logs
    IF v_log.working_days_used IS DISTINCT FROM v_log_days
       OR v_log.working_days_spent IS DISTINCT FROM v_log_days THEN
      UPDATE public.stage_logs
      SET
        working_days_used = v_log_days,
        working_days_spent = v_log_days
      WHERE id = v_log.id;
    END IF;

    -- Jika ini log yang masih terbuka (ended_at IS NULL & exited_at IS NULL), cek kuota tahap aktif
    IF v_log.ended_at IS NULL AND v_log.exited_at IS NULL THEN
      v_is_currently_paused := (NOT v_log.is_internal_sla) OR COALESCE(v_log.is_paused, false);
      v_active_stage_elapsed := v_log_days;
      v_active_stage_quota := CASE v_log.to_stage
        WHEN 'PRE_CHECK' THEN 1
        WHEN 'PHYSICAL_CHECK' THEN 1
        WHEN 'PIC_APPROVAL' THEN 1
        WHEN 'ACCOUNTING_APPROVAL' THEN 2
        WHEN 'SPP_PROCESSING' THEN 1
        ELSE 1
      END;

      IF v_active_stage_quota > 0 THEN
        v_active_stage_remaining_ratio := GREATEST(0, (v_active_stage_quota - v_active_stage_elapsed) / v_active_stage_quota);
      END IF;
    END IF;
  END LOOP;

  v_total_days := ROUND(COALESCE(v_total_days, 0), 2);

  -- Evaluasi status SLA otomatis
  IF v_total_days > v_target_days THEN
    v_new_sla_status := 'Terlambat';
  ELSIF v_sub.final_status = 'Selesai' OR v_sub.current_stage = 'COMPLETED' THEN
    v_new_sla_status := 'Sesuai SLA';
  ELSIF v_total_days >= 4.5
        OR (NOT v_is_currently_paused AND v_active_stage_remaining_ratio <= 0.25) THEN
    v_new_sla_status := 'Perlu Perhatian';
  ELSE
    v_new_sla_status := 'Dalam Proses';
  END IF;

  UPDATE public.billing_submissions
  SET
    actual_working_days = v_total_days,
    sla_status = v_new_sla_status
  WHERE id = p_submission_id;

  RETURN QUERY
  SELECT
    p_submission_id,
    v_total_days,
    v_target_days,
    v_new_sla_status,
    (v_is_currently_paused OR v_sub.final_status = 'Menunggu Mitra');
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_submission_sla(UUID) TO authenticated, service_role;
