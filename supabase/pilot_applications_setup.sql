-- ============================================================
-- pilot_applications table — run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS pilot_applications (
    id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    real_name    TEXT,
    callsign     TEXT        NOT NULL,
    email        TEXT        NOT NULL,
    vatsim_id    TEXT,
    experience   TEXT,
    motivation   TEXT,
    status       TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'approved', 'denied')),
    reviewed_by  TEXT,
    reviewed_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE pilot_applications ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous visitors) can submit an application
CREATE POLICY "Public can insert applications"
    ON pilot_applications FOR INSERT
    WITH CHECK (true);

-- Only admins can read applications
CREATE POLICY "Admins can read applications"
    ON pilot_applications FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM vsaferep_admins
            WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    );

-- Only admins can update (approve / deny)
CREATE POLICY "Admins can update applications"
    ON pilot_applications FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM vsaferep_admins
            WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    );
