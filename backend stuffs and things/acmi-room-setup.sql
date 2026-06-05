-- ============================================================
-- 158th FW Virtual VANG — ACMI Room Setup
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================


-- ── 1. STORAGE BUCKET ───────────────────────────────────────
-- Create the bucket via Supabase Dashboard:
--   Storage → New bucket → Name: acmi-files → Private (NOT public)
-- OR run via API. The policies below assume the bucket exists.
-- File size limit: 200 MB (ACMI files are typically 1–50 MB)


-- ── 2. ACMI MISSIONS TABLE ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.acmi_missions (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    uploaded_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    callsign        TEXT        NOT NULL,
    mission_name    TEXT        NOT NULL,
    mission_date    DATE        NOT NULL,
    aircraft        TEXT,                   -- e.g. "F-16C Viper"
    participants    TEXT[],                 -- array of callsigns involved
    description     TEXT,
    file_path       TEXT        NOT NULL,   -- path inside acmi-files bucket
    file_name       TEXT        NOT NULL,   -- original filename shown to user
    file_size       BIGINT,                 -- bytes
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.acmi_missions IS
    'Metadata for uploaded Tacview .acmi debrief files for the 158th FW ACMI Room.';


-- ── 3. ROW LEVEL SECURITY ───────────────────────────────────

ALTER TABLE public.acmi_missions ENABLE ROW LEVEL SECURITY;

-- Any authenticated (active) member can read all missions
CREATE POLICY "member: read all missions"
    ON public.acmi_missions
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Any authenticated member can upload missions
CREATE POLICY "member: insert own mission"
    ON public.acmi_missions
    FOR INSERT
    WITH CHECK (auth.uid() = uploaded_by);

-- Members can delete their own missions
CREATE POLICY "member: delete own mission"
    ON public.acmi_missions
    FOR DELETE
    USING (auth.uid() = uploaded_by);

-- Admins can delete any mission
CREATE POLICY "admin: delete any mission"
    ON public.acmi_missions
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.vsaferep_admins
            WHERE email = auth.email()
        )
    );


-- ── 4. STORAGE POLICIES (acmi-files bucket) ─────────────────
-- Run these AFTER creating the bucket in the Supabase Dashboard.

-- Authenticated members can upload to their own folder
CREATE POLICY "member: upload acmi"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'acmi-files'
        AND auth.uid() IS NOT NULL
    );

-- Authenticated members can download any file
CREATE POLICY "member: download acmi"
    ON storage.objects
    FOR SELECT
    USING (
        bucket_id = 'acmi-files'
        AND auth.uid() IS NOT NULL
    );

-- Members can delete their own uploads
CREATE POLICY "member: delete own acmi"
    ON storage.objects
    FOR DELETE
    USING (
        bucket_id = 'acmi-files'
        AND auth.uid() IS NOT NULL
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Admins can delete any file
CREATE POLICY "admin: delete any acmi"
    ON storage.objects
    FOR DELETE
    USING (
        bucket_id = 'acmi-files'
        AND EXISTS (
            SELECT 1 FROM public.vsaferep_admins
            WHERE email = auth.email()
        )
    );
