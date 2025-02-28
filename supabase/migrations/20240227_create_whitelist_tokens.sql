-- Create whitelist_tokens table
create table whitelist_tokens (
    id uuid primary key default gen_random_uuid(),
    whitelist_id uuid references whitelist(id) not null,
    token text not null unique,
    expires_at timestamp with time zone not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    used_at timestamp with time zone
);

-- Enable RLS
alter table whitelist_tokens enable row level security;

-- Create policies
create policy "Authenticated users can view whitelist tokens"
    on whitelist_tokens for select
    using (auth.role() = 'authenticated');

create policy "Service role can manage whitelist tokens"
    on whitelist_tokens for all
    using (auth.jwt()->>'role' = 'service_role');

-- Grant permissions
grant usage on schema public to authenticated;
grant all on whitelist_tokens to authenticated;
