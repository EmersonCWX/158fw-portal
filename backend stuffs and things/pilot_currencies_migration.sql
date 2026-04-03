-- Run this in the Supabase SQL editor to create the pilot_currencies table
-- This table stores the last-accomplished date and exception status for each
-- currency type per pilot.

create table if not exists public.pilot_currencies (
    id                uuid         primary key default gen_random_uuid(),
    member_id         uuid         not null references public.members(id) on delete cascade,
    currency_type     text         not null,
    last_accomplished date,
    exception_granted boolean      not null default false,
    updated_by        text,
    updated_at        timestamptz  default now(),

    constraint pilot_currencies_unique unique (member_id, currency_type)
);

-- Enable Row Level Security
alter table public.pilot_currencies enable row level security;

-- Allow authenticated users to read all currency records
create policy "authenticated users can read currencies"
    on public.pilot_currencies for select
    using (auth.role() = 'authenticated');

-- Allow admins to insert/update/delete currency records
create policy "admins can write currencies"
    on public.pilot_currencies for all
    using (
        exists (
            select 1 from public.vsaferep_admins
            where email = auth.email()
        )
    )
    with check (
        exists (
            select 1 from public.vsaferep_admins
            where email = auth.email()
        )
    );

-- Index for fast lookups by member
create index if not exists idx_pilot_currencies_member
    on public.pilot_currencies (member_id);
