-- ============================================================
-- 158th FW Virtual VANG — Supabase Member Invite Setup
-- Run this entire file in the Supabase SQL Editor (one shot)
-- https://supabase.com/dashboard → your project → SQL Editor
-- ============================================================


-- ── 1. MEMBERS PROFILE TABLE ────────────────────────────────
-- Stores extra info for each auth user (callsign, rank, etc.)
-- 'id' is a foreign key to auth.users so it's always in sync.

CREATE TABLE IF NOT EXISTS public.members (
    id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email       TEXT,
    callsign    TEXT,
    rank        TEXT,
    role        TEXT        NOT NULL DEFAULT 'member'
                            CHECK (role IN ('member', 'admin')),
    status      TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'active', 'inactive')),
    vatsim_id   TEXT,                          -- VATSIM CID
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add vatsim_id to existing deployments
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS vatsim_id TEXT;

-- Populate known CIDs from roster (update by callsign)
UPDATE public.members SET vatsim_id = '1627852' WHERE callsign = 'Sabre';
UPDATE public.members SET vatsim_id = '1582344' WHERE callsign = 'Smore';
UPDATE public.members SET vatsim_id = '1490208' WHERE callsign = 'Venus';
UPDATE public.members SET vatsim_id = '1731294' WHERE callsign = 'Veix';
UPDATE public.members SET vatsim_id = '1935951' WHERE callsign = 'Magma';

COMMENT ON TABLE public.members IS
    'Extended profile for each invited/registered member of the 158th FW.';


-- ── 2. ROW LEVEL SECURITY ───────────────────────────────────
-- Must be enabled before policies take effect.

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

-- Members can always read their own row
CREATE POLICY "member: read own profile"
    ON public.members
    FOR SELECT
    USING (auth.uid() = id);

-- Members can update their own non-sensitive fields
CREATE POLICY "member: update own profile"
    ON public.members
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- All authenticated members can read active member profiles (needed for gradesheet)
DROP POLICY IF EXISTS "member: read active roster" ON public.members;
CREATE POLICY "member: read active roster"
    ON public.members
    FOR SELECT
    USING (status = 'active' AND auth.uid() IS NOT NULL);

-- Admins can read ALL member rows (including inactive/pending)
DROP POLICY IF EXISTS "admin: read all members" ON public.members;
CREATE POLICY "admin: read all members"
    ON public.members
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.vsaferep_admins
            WHERE email = auth.email()
        )
    );

-- Admins can update ALL member rows (e.g. promote, deactivate)
CREATE POLICY "admin: update all members"
    ON public.members
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.members m
            WHERE m.id = auth.uid() AND m.role = 'admin'
        )
    );

-- Admins can delete member rows
CREATE POLICY "admin: delete members"
    ON public.members
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.members m
            WHERE m.id = auth.uid() AND m.role = 'admin'
        )
    );


-- ── 3. TRIGGER — auto-create profile row on invite ──────────
-- When an admin invites someone via supabase.auth.admin.inviteUserByEmail(),
-- Supabase inserts a row into auth.users with email_confirmed_at = NULL.
-- This trigger immediately creates a matching 'pending' row in public.members.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.members (id, email, callsign, status)
    VALUES (
        NEW.id,
        NEW.email,
        -- Pull callsign from invite metadata if admin passed it
        NEW.raw_user_meta_data ->> 'callsign',
        -- If already confirmed (e.g. social/magic-link signup), go active immediately
        CASE
            WHEN NEW.email_confirmed_at IS NOT NULL THEN 'active'
            ELSE 'pending'
        END
    )
    ON CONFLICT (id) DO NOTHING;   -- safe to re-run migrations

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();


-- ── 4. TRIGGER — activate member when invite is accepted ────
-- When the invited user clicks the email link and sets their password,
-- Supabase sets email_confirmed_at on their auth.users row.
-- This trigger flips their status from 'pending' → 'active'.

CREATE OR REPLACE FUNCTION public.handle_user_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only act when email_confirmed_at goes from NULL → a real timestamp
    IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
        UPDATE public.members
        SET
            status     = 'active',
            updated_at = NOW()
        WHERE id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
    AFTER UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_user_confirmed();


-- ── 5. TRIGGER — keep updated_at current ────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS members_set_updated_at ON public.members;
CREATE TRIGGER members_set_updated_at
    BEFORE UPDATE ON public.members
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();


-- ── 6. VIEW — active member roster ──────────────────────────
-- Used by roster.html to list only confirmed/active members.

CREATE OR REPLACE VIEW public.active_members AS
    SELECT id, callsign, rank, role, joined_at
    FROM public.members
    WHERE status = 'active'
    ORDER BY rank, callsign;

-- Any authenticated user (logged-in member) can read the roster
GRANT SELECT ON public.active_members TO authenticated;


-- ── 7. USAGE NOTES ──────────────────────────────────────────
-- Inviting a member (run from your server or Supabase Dashboard):
--
--   supabase.auth.admin.inviteUserByEmail('pilot@example.com', {
--       data: { callsign: 'VIPER', rank: 'Captain' }
--   })
--
-- This requires the SERVICE ROLE key (never expose on the frontend).
-- Use a Supabase Edge Function or your backend server for invites.
--
-- The invited user receives an email. When they click the link they
-- land on accept-invite.html (see Site URL / Redirect URLs in
-- Supabase Dashboard → Authentication → URL Configuration).
-- They enter a password → supabase.auth.updateUser({ password }) →
-- email_confirmed_at is set → on_auth_user_confirmed fires →
-- their status becomes 'active'.


-- ============================================================


-- ── 8. PILOT APPLICATIONS — RLS POLICIES ────────────────────
-- Run these in the Supabase SQL Editor if anonymous form
-- submissions are being blocked (silent failure / not appearing
-- in the admin panel).

-- Create the table if it doesn't exist yet
CREATE TABLE IF NOT EXISTS public.pilot_applications (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    real_name     TEXT        NOT NULL,
    email         TEXT        NOT NULL,
    motivation    TEXT,
    status        TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'approved', 'denied')),
    reviewed_by   TEXT,
    reviewed_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.pilot_applications ENABLE ROW LEVEL SECURITY;

-- Grant table-level privileges (required in addition to RLS policies)
GRANT INSERT ON public.pilot_applications TO anon;
GRANT SELECT, UPDATE, DELETE ON public.pilot_applications TO authenticated;

-- Allow any visitor (unauthenticated) to submit
DROP POLICY IF EXISTS "public: insert pilot application" ON public.pilot_applications;
CREATE POLICY "public: insert pilot application"
    ON public.pilot_applications
    FOR INSERT
    WITH CHECK (true);

-- Allow admins to read all submissions
DROP POLICY IF EXISTS "admin: select pilot applications" ON public.pilot_applications;
CREATE POLICY "admin: select pilot applications"
    ON public.pilot_applications
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.vsaferep_admins
            WHERE email = auth.email()
        )
    );

-- Allow admins to approve/deny
DROP POLICY IF EXISTS "admin: update pilot applications" ON public.pilot_applications;
CREATE POLICY "admin: update pilot applications"
    ON public.pilot_applications
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.vsaferep_admins
            WHERE email = auth.email()
        )
    );

-- Allow admins to delete
DROP POLICY IF EXISTS "admin: delete pilot applications" ON public.pilot_applications;
CREATE POLICY "admin: delete pilot applications"
    ON public.pilot_applications
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.vsaferep_admins
            WHERE email = auth.email()
        )
    );

-- ============================================================

-- -- 9. FLIGHT RECORDS � TABLE & RLS POLICIES ----------------
-- Stores post-mission flight logs submitted by each pilot.
-- Run this block in the Supabase SQL Editor if the table does
-- not yet exist, or if admins cannot see all unit flight records.

CREATE TABLE IF NOT EXISTS public.flight_records (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email        TEXT,
    pilot_callsign    TEXT,
    mission_date      TEXT,
    mission_type      TEXT,
    callsign          TEXT,
    aircraft          TEXT,
    tail_number       TEXT,
    dep_icao          TEXT,
    takeoff_time      TEXT,
    arr_icao          TEXT,
    land_time         TEXT,
    total_flight_time TEXT,
    time_mode         TEXT,
    route             TEXT,
    obj1_result       TEXT,
    obj1_notes        TEXT,
    obj2_result       TEXT,
    obj2_notes        TEXT,
    obj3_result       TEXT,
    obj3_notes        TEXT,
    debrief_notes     TEXT,
    vatsim_cid        TEXT,
    certified         BOOLEAN     DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.flight_records ENABLE ROW LEVEL SECURITY;

-- Grant table-level privileges
GRANT INSERT ON public.flight_records TO authenticated;
GRANT SELECT ON public.flight_records TO authenticated;

-- Each pilot can insert their own records
DROP POLICY IF EXISTS "member: insert own flight record" ON public.flight_records;
CREATE POLICY "member: insert own flight record"
    ON public.flight_records
    FOR INSERT
    WITH CHECK (auth.email() = user_email);

-- Each pilot can read their own records
DROP POLICY IF EXISTS "member: select own flight records" ON public.flight_records;
CREATE POLICY "member: select own flight records"
    ON public.flight_records
    FOR SELECT
    USING (auth.email() = user_email);

-- Admins can read ALL flight records (unit-wide view)
DROP POLICY IF EXISTS "admin: select all flight records" ON public.flight_records;
CREATE POLICY "admin: select all flight records"
    ON public.flight_records
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.vsaferep_admins
            WHERE email = auth.email()
        )
    );

-- ============================================================

-- ── 10. SPECIAL INTEREST EVENTS — RSVP TABLE ────────────────
CREATE TABLE IF NOT EXISTS public.sie_rsvps (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    callsign    TEXT,
    event_key   TEXT        NOT NULL,
    status      TEXT        NOT NULL CHECK (status IN ('going','notgoing')),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, event_key)
);

ALTER TABLE public.sie_rsvps ENABLE ROW LEVEL SECURITY;

GRANT INSERT, SELECT, UPDATE, DELETE ON public.sie_rsvps TO authenticated;

-- Members can manage their own RSVPs
DROP POLICY IF EXISTS "member: manage own rsvps" ON public.sie_rsvps;
CREATE POLICY "member: manage own rsvps"
    ON public.sie_rsvps FOR ALL
    USING  (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Admins can read all RSVPs
DROP POLICY IF EXISTS "admin: read all rsvps" ON public.sie_rsvps;
CREATE POLICY "admin: read all rsvps"
    ON public.sie_rsvps FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.vsaferep_admins
            WHERE email = auth.email()
        )
    );

-- ============================================================

-- ── 11. GRADESHEET ENTRIES ───────────────────────────────────
-- Stores per-student per-course grades and instructor notes.
-- Used by gradesheet.html (read) and admin.html (read/write).

CREATE TABLE IF NOT EXISTS public.gradesheet_entries (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id  UUID        NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    course_id   TEXT        NOT NULL,          -- e.g. 'FFAM', 'MQT1'
    grade       TEXT        NOT NULL DEFAULT 'NG'
                            CHECK (grade IN ('NG','E','G','F','U')),
    notes       TEXT,                          -- instructor notes (nullable)
    updated_by  TEXT,                          -- admin email
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, course_id)
);

COMMENT ON TABLE public.gradesheet_entries IS
    'v158th FW training grades per student per course (FFAM, LAO, MQT1-10).';

ALTER TABLE public.gradesheet_entries ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.gradesheet_entries TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.gradesheet_entries TO authenticated;

-- Any authenticated member can read all grades (for the gradesheet view)
DROP POLICY IF EXISTS "member: read all grades" ON public.gradesheet_entries;
CREATE POLICY "member: read all grades"
    ON public.gradesheet_entries
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Only admins can insert/update/delete grades
DROP POLICY IF EXISTS "admin: write grades" ON public.gradesheet_entries;
CREATE POLICY "admin: write grades"
    ON public.gradesheet_entries
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.vsaferep_admins
            WHERE email = auth.email()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.vsaferep_admins
            WHERE email = auth.email()
        )
    );

-- ============================================================

-- ── 12. VSAFEREP REPORTS TABLE ──────────────────────────────
-- Receives submissions from vsaferep-aviation.html,
-- vsaferep-hazard.html, and vsaferep-behavior.html.
-- Reports are anonymous-insert / admin-read-only.

CREATE TABLE IF NOT EXISTS public.vsaferep_reports (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    report_type         TEXT        NOT NULL
                                    CHECK (report_type IN ('aviation','hazard','behavior','nearmiss')),
    short_id            TEXT,

    -- Shared fields (all report types)
    description         TEXT,
    location            TEXT,
    incident_date       TEXT,
    incident_time       TEXT,
    category            TEXT,
    reporter_name       TEXT,
    reporter_email      TEXT,
    unit                TEXT,
    duty_position       TEXT,

    -- Aviation-specific fields
    occurrence_type     TEXT,
    aircraft_type       TEXT,
    flight_callsign     TEXT,
    departure_base      TEXT,
    phase_of_flight     TEXT,
    mission_type        TEXT,
    system_affected     TEXT,
    emergency_declared  BOOLEAN,
    crew_injuries       BOOLEAN,
    aircraft_damage     BOOLEAN,
    diverted            BOOLEAN,
    corrective_actions  TEXT,

    -- Hazard-specific fields
    observed_date       TEXT,
    observed_time       TEXT,
    risk_level          TEXT,

    -- Behavior-specific fields
    reported_member     TEXT,
    witnesses           TEXT,
    witness_names       TEXT,
    involvement         TEXT,
    repeat_offense      TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.vsaferep_reports IS
    'Safety reports from aviation, hazard, and behavior forms. Anonymous insert, admin-read.';

ALTER TABLE public.vsaferep_reports ENABLE ROW LEVEL SECURITY;

-- Any visitor (unauthenticated) can submit a report
GRANT INSERT ON public.vsaferep_reports TO anon;
GRANT SELECT, DELETE ON public.vsaferep_reports TO authenticated;

DROP POLICY IF EXISTS "public: insert vsaferep report" ON public.vsaferep_reports;
CREATE POLICY "public: insert vsaferep report"
    ON public.vsaferep_reports
    FOR INSERT
    WITH CHECK (true);

-- Only admins can read reports
DROP POLICY IF EXISTS "admin: select vsaferep reports" ON public.vsaferep_reports;
CREATE POLICY "admin: select vsaferep reports"
    ON public.vsaferep_reports
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.vsaferep_admins
            WHERE email = auth.email()
        )
    );

-- Only admins can delete reports
DROP POLICY IF EXISTS "admin: delete vsaferep reports" ON public.vsaferep_reports;
CREATE POLICY "admin: delete vsaferep reports"
    ON public.vsaferep_reports
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.vsaferep_admins
            WHERE email = auth.email()
        )
    );

-- ============================================================

-- ── 13. MEMBER CERTIFICATIONS ────────────────────────────────
-- Stores per-member certifications (IP, FAC, CBT, etc.).
-- Used by members-roster.html (read / admin write) and
-- gradesheet.html (read).

CREATE TABLE IF NOT EXISTS public.member_certifications (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id       UUID    NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    certification   TEXT    NOT NULL,
    granted_by      TEXT,               -- admin email who granted it (optional)
    granted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (member_id, certification)
);

COMMENT ON TABLE public.member_certifications IS
    'v158th FW pilot certifications (IP, FAC, CBT, etc.) per member.';

ALTER TABLE public.member_certifications ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.member_certifications TO authenticated;
GRANT INSERT, DELETE ON public.member_certifications TO authenticated;

-- Any authenticated member can read all certifications
DROP POLICY IF EXISTS "member: read all certifications" ON public.member_certifications;
CREATE POLICY "member: read all certifications"
    ON public.member_certifications
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Only vSAFREP admins can grant or revoke certifications
DROP POLICY IF EXISTS "admin: write certifications" ON public.member_certifications;
CREATE POLICY "admin: write certifications"
    ON public.member_certifications
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.vsaferep_admins
            WHERE email = auth.email()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.vsaferep_admins
            WHERE email = auth.email()
        )
    );

-- ============================================================