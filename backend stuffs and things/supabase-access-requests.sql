-- ============================================================
-- 158th FW — Self-Service Access Request System
-- Run this in the Supabase SQL Editor AFTER supabase-setup.sql
-- https://supabase.com/dashboard → your project → SQL Editor
-- ============================================================


-- ── 1. Extend members.status to include 'denied' ─────────────

ALTER TABLE public.members
    DROP CONSTRAINT IF EXISTS members_status_check;

ALTER TABLE public.members
    ADD CONSTRAINT members_status_check
    CHECK (status IN ('pending', 'active', 'inactive', 'denied'));


-- ── 2. Add self-signup columns to members table ───────────────
-- real_name    — full name entered on the request form
-- motivation   — brief message entered on the request form
-- signup_type  — 'invite' (existing flow) vs 'self' (new flow)

ALTER TABLE public.members
    ADD COLUMN IF NOT EXISTS real_name   TEXT;

ALTER TABLE public.members
    ADD COLUMN IF NOT EXISTS motivation  TEXT;

ALTER TABLE public.members
    ADD COLUMN IF NOT EXISTS signup_type TEXT
        NOT NULL DEFAULT 'invite'
        CHECK (signup_type IN ('invite', 'self'));


-- ── 3. Rebuild handle_new_user trigger ───────────────────────
-- Captures real_name, motivation, signup_type from sign-up
-- metadata and keeps self-signups as 'pending' regardless of
-- email confirmation state (admin must explicitly approve them).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.members (id, email, callsign, real_name, motivation, signup_type, status)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data ->> 'callsign',
        NEW.raw_user_meta_data ->> 'real_name',
        NEW.raw_user_meta_data ->> 'motivation',
        COALESCE(NEW.raw_user_meta_data ->> 'signup_type', 'invite'),
        CASE
            -- Self-signups always start as 'pending' — admin must approve
            WHEN (NEW.raw_user_meta_data ->> 'signup_type') = 'self' THEN 'pending'
            -- Invited users: active immediately if already confirmed (e.g. magic link)
            WHEN NEW.email_confirmed_at IS NOT NULL THEN 'active'
            ELSE 'pending'
        END
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;


-- ── 4. Rebuild handle_user_confirmed trigger ─────────────────
-- Self-signups stay 'pending' even after email confirmation
-- (they need admin approval). Invite-based signups auto-activate
-- as before.

CREATE OR REPLACE FUNCTION public.handle_user_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
        -- Only auto-activate admin-invited users, NOT self-signups
        UPDATE public.members
        SET
            status     = 'active',
            updated_at = NOW()
        WHERE
            id          = NEW.id
            AND status  = 'pending'
            AND signup_type = 'invite';
    END IF;

    RETURN NEW;
END;
$$;


-- ── 5. Fix admin update policy to match admin panel auth ─────
-- The admin panel gates access via vsaferep_admins, so the RLS
-- update policy should use the same table for consistency.

DROP POLICY IF EXISTS "admin: update all members" ON public.members;

CREATE POLICY "admin: update all members"
    ON public.members
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.vsaferep_admins
            WHERE email = auth.email()
        )
    );


-- ── 6. Ensure members can read their own status ──────────────
-- (Already exists in supabase-setup.sql but safe to re-confirm)

DROP POLICY IF EXISTS "member: read own profile" ON public.members;

CREATE POLICY "member: read own profile"
    ON public.members
    FOR SELECT
    USING (auth.uid() = id);


-- ── 7. USAGE NOTES ──────────────────────────────────────────
--
-- Self-signup flow:
--   1. Prospective member fills out /request-access.html
--   2. signUp() is called with { signup_type: 'self', ... }
--   3. A 'pending' row is created in public.members via trigger
--   4. Admin sees the request under Admin Panel → Member Requests
--   5. Admin clicks Approve  → members.status set to 'active'
--      Admin clicks Deny     → members.status set to 'denied'
--   6. User can log in only when status = 'active'
--
-- Invite flow (unchanged):
--   1. Admin invites via Supabase Dashboard or admin API
--   2. User clicks link, sets password, email confirmed
--   3. Trigger auto-sets status = 'active'
