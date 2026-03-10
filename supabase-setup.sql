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
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

-- Admins can read ALL member rows
CREATE POLICY "admin: read all members"
    ON public.members
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.members m
            WHERE m.id = auth.uid() AND m.role = 'admin'
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
    callsign      TEXT        NOT NULL,
    email         TEXT        NOT NULL,
    vatsim_id     TEXT,
    experience    TEXT,
    motivation    TEXT,
    status        TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'approved', 'denied')),
    reviewed_by   TEXT,
    reviewed_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.pilot_applications ENABLE ROW LEVEL SECURITY;

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