-- Create an enum for week customization status
create type week_status as enum ('visible', 'hidden', 'deleted');

-- Create calendar_config table with single row constraint
create table calendar_config (
    id uuid primary key default uuid_generate_v4(),
    check_in_day smallint not null check (check_in_day between 0 and 6),
    check_out_day smallint not null check (check_out_day between 0 and 6),
    created_at timestamptz default now()
);

-- Add constraint to ensure only one row exists
create unique index single_calendar_config on calendar_config ((true));

-- Create week_customizations table
create table week_customizations (
    id uuid primary key default uuid_generate_v4(),
    start_date date not null,
    end_date date not null,
    name text,
    status week_status not null default 'visible',
    created_by uuid references auth.users(id),
    created_at timestamptz default now()
);

-- Insert initial default configuration (Sunday check-in, Saturday check-out)
insert into calendar_config (check_in_day, check_out_day)
values (0, 6);

-- Add RLS policies
alter table calendar_config enable row level security;
alter table week_customizations enable row level security;

-- Only authenticated users can read calendar_config
create policy "Calendar config is viewable by authenticated users"
on calendar_config for select
to authenticated
using (true);

-- Only admin can modify calendar_config
create policy "Calendar config is modifiable by admin"
on calendar_config for all
to authenticated
using (auth.jwt() ->> 'role' = 'admin')
with check (auth.jwt() ->> 'role' = 'admin');

-- Week customizations are viewable by all authenticated users
create policy "Week customizations are viewable by authenticated users"
on week_customizations for select
to authenticated
using (true);

-- Week customizations are modifiable by admin
create policy "Week customizations are modifiable by admin"
on week_customizations for all
to authenticated
using (auth.jwt() ->> 'role' = 'admin')
with check (auth.jwt() ->> 'role' = 'admin');
