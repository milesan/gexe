-- Drop existing policies and table
drop policy if exists "Authenticated users can view whitelist" on whitelist;
drop policy if exists "Authenticated users can insert into whitelist" on whitelist;
drop policy if exists "Authenticated users can update whitelist" on whitelist;
drop policy if exists "Authenticated users can delete from whitelist" on whitelist;
drop table if exists whitelist;

-- Create whitelist table
create table whitelist (
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    notes text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    last_login timestamp with time zone,
    has_seen_welcome boolean default false,
    has_created_account boolean default false,
    account_created_at timestamp with time zone,
    has_booked boolean default false,
    first_booking_at timestamp with time zone,
    last_booking_at timestamp with time zone,
    total_bookings integer default 0
);

-- Enable RLS
alter table whitelist enable row level security;

-- Create policies
create policy "Authenticated users can view whitelist"
    on whitelist for select
    using (auth.role() = 'authenticated');

create policy "Authenticated users can insert into whitelist"
    on whitelist for insert
    with check (auth.role() = 'authenticated');

create policy "Authenticated users can update whitelist"
    on whitelist for update
    using (auth.role() = 'authenticated')
    with check (auth.role() = 'authenticated');

create policy "Authenticated users can delete from whitelist"
    on whitelist for delete
    using (auth.role() = 'authenticated');

-- Grant permissions
grant usage on schema public to authenticated;
grant all on whitelist to authenticated;

-- Insert existing data
INSERT INTO "public"."whitelist" ("id", "email", "notes", "created_at", "updated_at", "last_login", "has_seen_welcome", "has_created_account", "account_created_at", "has_booked", "first_booking_at", "last_booking_at", "total_bookings") VALUES 
('180d66cb-8d2f-4850-8112-c15f26dc72f5', 'miles@miles.miles', '', '2024-11-27 08:47:44.334126+00', '2024-11-28 01:36:46.003976+00', '2024-11-27 09:21:17.503544+00', 'true', 'true', '2024-11-27 09:21:17.503544+00', 'false', null, null, '0'),
('4a6a32f4-9289-4625-9ee4-0e96de0275b8', 'mak@mako.mako', '', '2024-11-28 20:41:52.471815+00', '2024-11-28 20:43:52.213771+00', '2024-11-28 20:43:43.708177+00', 'true', 'true', '2024-11-28 20:43:43.708177+00', 'false', null, null, '0'),
('5721f7c9-0703-4b9f-bb32-c7f5f60bdd50', 'andre@thegarden.pt', '', '2024-11-26 22:39:59.851197+00', '2025-02-17 19:57:09.973049+00', '2025-02-17 19:55:30.964525+00', 'true', 'true', '2024-12-29 09:34:41.729935+00', 'true', '2024-12-26 18:07:09.744364+00', '2025-02-17 19:35:22.534406+00', '16'),
('8102f184-91f6-4ab9-a01b-af15cf0e0854', 'cv@cv.vc', '', '2024-11-26 22:03:49.022811+00', '2024-11-26 22:08:53.408654+00', '2024-11-26 22:08:43.84426+00', 'true', 'true', '2024-11-26 22:08:43.84426+00', 'false', null, null, '0'),
('8d609fbd-a7ea-4e6c-9e85-a2a17948ec7a', 'hidyandseek@fbi.ru', '', '2024-11-26 22:06:47.419909+00', '2024-11-26 22:06:47.419909+00', null, 'false', 'false', null, 'false', null, null, '0'),
('8f424f4c-c436-4e7d-a835-720e276d89df', 'leila@leila.leila', '', '2024-11-26 22:36:25.123402+00', '2024-11-27 12:49:58.270416+00', '2024-11-27 12:49:48.327905+00', 'true', 'true', '2024-11-27 12:49:48.327905+00', 'false', null, null, '0'),
('b46a9a70-d3c1-46bd-9d95-ea3254ff4174', 'redis213@gmail.com', null, '2025-02-25 12:53:04.821045+00', '2025-02-25 12:58:07.60139+00', '2025-02-25 12:57:16.398107+00', 'true', 'true', '2025-02-25 12:57:16.398107+00', 'true', null, null, '0'),
('d5b2dd4d-23f2-474b-934b-b8e6c087ccd4', 'simone@simone.simone', '', '2024-11-26 22:40:26.749843+00', '2024-11-26 22:42:29.20835+00', '2024-11-26 22:42:21.006416+00', 'true', 'true', '2024-11-26 22:42:21.006416+00', 'false', null, null, '0'),
('d5f5b4c5-39a0-4e7b-a1bd-a26b83f00ff6', 'dad@dad.dad', '', '2024-11-27 08:32:37.76666+00', '2024-11-27 08:33:22.210267+00', '2024-11-27 08:33:17.414652+00', 'true', 'true', '2024-11-27 08:33:17.414652+00', 'false', null, null, '0'),
('e05af399-e2fb-4bb1-b9b8-78f078d7f433', 'simone@thegarden.pt', '', '2024-11-26 22:39:54.598213+00', '2024-11-26 22:39:54.598213+00', null, 'false', 'false', null, 'false', null, null, '0'),
('e95f4147-d244-4c3a-9be6-095e4733989f', 'squpty@gmail.com', '', '2024-11-26 22:24:09.096405+00', '2024-11-27 11:39:00.610003+00', '2024-11-27 11:38:53.309682+00', 'true', 'true', '2024-11-27 11:38:53.309682+00', 'false', null, null, '0');
