-- Create a function to return debug information about the database
create or replace function debug_db_info()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
    result json;
begin
    -- Get table information
    with table_info as (
        select 
            table_name,
            (select count(*) from information_schema.columns where table_name = t.table_name) as column_count,
            (select count(*) from information_schema.table_privileges where table_name = t.table_name) as privilege_count,
            has_table_privilege(current_user, quote_ident(table_name), 'SELECT') as can_select,
            has_table_privilege(current_user, quote_ident(table_name), 'INSERT') as can_insert,
            exists(
                select 1 
                from pg_catalog.pg_policy p 
                join pg_catalog.pg_class c on p.polrelid = c.oid 
                where c.relname = t.table_name
            ) as has_rls
        from information_schema.tables t
        where table_schema = 'public'
    )
    select json_build_object(
        'tables', json_agg(json_build_object(
            'name', table_name,
            'column_count', column_count,
            'privilege_count', privilege_count,
            'permissions', json_build_object(
                'can_select', can_select,
                'can_insert', can_insert
            ),
            'has_rls', has_rls
        )),
        'current_user', current_user,
        'current_database', current_database()
    ) into result
    from table_info;

    return result;
end;
$$;
