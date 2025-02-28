-- Add policy for admin users to manage whitelist tokens
create policy "Admin users can manage whitelist tokens"
    on whitelist_tokens for all
    using (
        exists (
            select 1 from auth.users
            where auth.uid() = id
            and raw_user_meta_data->>'isAdmin' = 'true'
        )
    );
