-- Create emails table for handling email sending
create table if not exists emails (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  recipient_email text not null,
  subject text not null,
  html text not null,
  sent boolean default false,
  error text
);

-- Set up RLS policies
alter table emails enable row level security;

-- Allow service role to insert
create policy "Service role can insert emails"
  on emails for insert
  to service_role
  with check (true);

-- Allow service role to update sent status
create policy "Service role can update sent status"
  on emails for update
  to service_role
  using (true)
  with check (true);
