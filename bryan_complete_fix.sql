-- Complete fix for Bryan's application and acceptance token
-- Run this entire script in Supabase SQL Editor

DO $$
DECLARE
    v_user_id uuid;
    v_email text := 'redis213+bryanjeffsart@gmail.com';
    v_application_id uuid;
    v_token text := '11e3533f-47ec-4f02-94a0-5e735f6cc199';
    v_application_data jsonb;
BEGIN
    RAISE NOTICE 'Starting Bryan application and token setup...';

    -- Step 1: Create acceptance_tokens table if it doesn't exist
    CREATE TABLE IF NOT EXISTS acceptance_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        application_id uuid REFERENCES applications(id) ON DELETE CASCADE NOT NULL,
        token text NOT NULL UNIQUE,
        expires_at timestamp with time zone NOT NULL,
        used_at timestamp with time zone,
        created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
    );

    -- Step 2: Check if user already exists
    SELECT id INTO v_user_id 
    FROM auth.users 
    WHERE email = v_email;

    IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid();
        
        -- Create the user in auth.users
        INSERT INTO auth.users (
            id,
            instance_id,
            email,
            encrypted_password,
            email_confirmed_at,
            aud,
            role,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at
        ) VALUES (
            v_user_id,
            '00000000-0000-0000-0000-000000000000',
            v_email,
            crypt('temp_password_123', gen_salt('bf')),
            now(),
            'authenticated',
            'authenticated',
            '{"provider": "email", "providers": ["email"]}'::jsonb,
            '{"has_applied": true, "application_status": "pending"}'::jsonb,
            now(),
            now()
        );

        -- Create identity record
        INSERT INTO auth.identities (
            id,
            user_id,
            provider_id,
            provider,
            identity_data,
            last_sign_in_at,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            v_user_id,
            v_email,
            'email',
            jsonb_build_object(
                'sub', v_user_id::text,
                'email', v_email,
                'email_verified', true,
                'provider', 'email'
            ),
            now(),
            now(),
            now()
        );

        -- Create profile
        INSERT INTO profiles (id, email, first_name, last_name)
        VALUES (v_user_id, v_email, 'Bryan', 'Jeffs')
        ON CONFLICT (id) DO UPDATE SET
            first_name = 'Bryan',
            last_name = 'Jeffs';

        RAISE NOTICE 'Created new user with ID: %', v_user_id;
    ELSE
        RAISE NOTICE 'User already exists with ID: %', v_user_id;
    END IF;

    -- Step 3: Check if application exists
    SELECT id INTO v_application_id
    FROM applications
    WHERE user_id = v_user_id;

    IF v_application_id IS NULL THEN
        -- Application data with all Bryan's answers
        v_application_data := '{
            "39f455d1-0de8-438f-8f34-10818eaec15e": "Bryan",
            "246d0acf-25cd-4e4e-9434-765e6ea679cb": "Jeffs",
            "5d9383fa-0f22-46d1-b612-76a5df303d29": "Zali gee",
            "862413b2-5753-4020-bffc-4c8fd71b0568": "+61481862118",
            "74edfb7a-458e-4dca-bed5-90dd5ccc1bb7": "@bryanjeffs - insta",
            "790d2581-67ff-40a0-b59e-fab7aaf3e55e": "38 single father about to relocate home (fortuitous gap) living in Australia.. My two daughters could come with me or stay with their mother in Australia. My inner life and social sphere is rich. My carpentry and landscaping business is in an early iterative stage. I have divorced from the hamster wheel and beginning to land creative opportunities in meaningful relationships.",
            "e0e50caf-fdc0-4476-a424-c250ada6d962": "I am refining and expanding my artistic placemaking practice and seeking collaboration with people of substance and depth. I am engaged with spiritual and material values as they converse and I am on a mission to find friends and opportunities to develop.",
            "0efef050-aedb-4f28-8380-f5e09f20c4c6": [{"url": "https://guquxpxxycfmmlqajdyw.supabase.co/storage/v1/object/public/application-photos/photos/1751105777778-IMG1477.jpeg", "fileName": "1751105777778-IMG1477.jpeg"}, {"url": "https://guquxpxxycfmmlqajdyw.supabase.co/storage/v1/object/public/application-photos/photos/1751105777778-IMG1152.jpeg", "fileName": "1751105777778-IMG1152.jpeg"}, {"url": "https://guquxpxxycfmmlqajdyw.supabase.co/storage/v1/object/public/application-photos/photos/1751105777778-IMG1064.jpeg", "fileName": "1751105777778-IMG1064.jpeg"}],
            "0397b9b1-39b9-4fee-914f-25c16f3ddd9a": "I welded together a chin up bar one evening for a friend. It was a spirited and resourceful clamouring process. A key design philosophy and aesthetic I natively employ celebrates structure as beauty in pursuit of the essential and elegant. My friend is a poet who cherishes my embodiment virtues as a beacon. I recycled steel from an old cattle truck.",
            "241d9c89-0323-4003-9a20-7c19309ba488": "When I was 17 I was enfj but very close to estj so I am not sure how it stacks up however I can go deep on my astrology for a thorough being assessment",
            "3ccd4d31-f706-4715-b6a3-134e7beaf85d": "No",
            "ae5cc5b2-e2ec-4126-9e53-7ab7fc495324": "2025-07-08T00:00:00.000Z",
            "4b108d7c-d05e-4036-b060-cd18323a0f6f": "Yes, I definitely will not bring an animal with me even though it is super cute.",
            "3744486e-edf6-460b-9021-2450743da2d9": "Yes, I know how to garden",
            "bfde0ed9-319a-45e4-8b0d-5c694ca2c850": "No <3",
            "73d367b8-2238-452b-83eb-808e96e2be21": "As you wish.",
            "b57ef1b4-612f-4e1c-b88b-eefe0211ba5e": "Not inherently. If I have hurt feelings they are mine to process and I will discern whether to invite the other party to consider my experience.",
            "d2565ce6-c5b8-4969-b17d-b1232f270f18": "I am chuckling to myself because it is not beliefs that have changed but how to integrate them. For instance I believe when I am confronted or offended by something or someone there will be a misalignment of values or a misunderstanding. In that case I can make an enquiry and register/consider my values. How I respond determines whether I am integrated and able to act with agency and respect. If I defer and compromise I forfeit harmony and my value.",
            "ee251d40-6354-44f7-b1eb-4245c04d1de6": "If you knew me you would know that I wish to play. That my depth of inquiry is to make a safe place for the nourishing wisdom of play.",
            "6a15976b-c98e-49e2-874a-ce1a7239d4c9": "Confidence. Confiding in myself. Allowing my own goodness and intentionality and inspiration to be the governing principle for my life.",
            "ea59d026-9f24-4b22-b06e-8a3221d9b95c": "It is all in what we do and say and how we move. The body tells the truth. How we cook and clean and dance. Many people open at different rates on different terms. So getting to know someone is generally on their terms :P",
            "91c501fe-954e-47bf-823e-106637b96194": "Have you experienced an inconvenient delight recently or been surprised by happenstance. What is your most cherished restorative activity. Did you see the sun rise this morning!?",
            "702ae994-6f64-4e81-a2b3-2593fbc0c937": "Passport or drivers licence usually. Haha. But ah I am guessing you mean in terms of gender identity. So I am a man.",
            "8039351b-c928-46bc-9389-3ca354033580": "I do not know them if there are any.",
            "36d8768e-938c-4287-b434-b7d3da6dd8d8": "I quite like this fellow bassforge and this other gent er charlie solis. The theories and research they cover are largely regarding resonance. seismic schuman ELF waves oscillating our earth and minds with architecture built as capacitors and other tremendous things.",
            "54d02288-6d35-46e2-884b-f2479fb93e75": "Astrology. Under the pretense that a marvellous constellar choreography is whipping up our curious experience by mechanical resonance. Aaand I believe in exceptions to rules.",
            "0d216f74-ad4c-4d02-bba7-d54853a6b07b": "Oh I just mentioned this. It is a comprehensive lens to consider the aspects of self or god in procession. It helps articulate the gnosis of cyclical nature and relationality.",
            "18fdf65b-a5c9-414d-bbfa-3057a7e2fba7": "No not logical but it is not excluding the possibility either.",
            "1346d368-b560-44c8-b026-14776c1b9a79": "Oh the poor civilians. I am grieved that we suffer a cultural wound at the loss of Gaza. I am not sure exac"
        }'::jsonb;

        -- Insert the application
        INSERT INTO applications (
            user_id,
            data,
            status,
            created_at,
            updated_at
        ) VALUES (
            v_user_id,
            v_application_data,
            'pending',
            now(),
            now()
        ) RETURNING id INTO v_application_id;

        RAISE NOTICE 'Created application with ID: %', v_application_id;
    ELSE
        RAISE NOTICE 'Application already exists with ID: %', v_application_id;
    END IF;

    -- Step 4: Create the get_application_token_data function if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_application_token_data') THEN
        CREATE OR REPLACE FUNCTION get_application_token_data(token_text text)
        RETURNS TABLE(
            token text,
            application_id uuid,
            user_id uuid,
            user_email text,
            expires_at timestamp with time zone,
            used_at timestamp with time zone
        ) AS $$
        BEGIN
            RETURN QUERY
            SELECT 
                at.token,
                at.application_id,
                a.user_id,
                u.email as user_email,
                at.expires_at,
                at.used_at
            FROM acceptance_tokens at
            JOIN applications a ON at.application_id = a.id
            JOIN auth.users u ON a.user_id = u.id
            WHERE at.token = token_text;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;

        RAISE NOTICE 'Created get_application_token_data function';
    END IF;

    -- Step 5: Create/update the acceptance token
    INSERT INTO acceptance_tokens (
        application_id,
        token,
        expires_at,
        created_at
    ) VALUES (
        v_application_id,
        v_token,
        now() + interval '14 days',
        now()
    )
    ON CONFLICT (token) DO UPDATE SET
        application_id = EXCLUDED.application_id,
        expires_at = EXCLUDED.expires_at;

    RAISE NOTICE 'Created/updated acceptance token: %', v_token;

    -- Step 6: Enable RLS and create policies if needed
    DO $POLICY$
    BEGIN
        -- Enable RLS on acceptance_tokens if not already enabled
        IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'acceptance_tokens' AND relrowsecurity = true) THEN
            ALTER TABLE acceptance_tokens ENABLE ROW LEVEL SECURITY;
        END IF;

        -- Create policy for admin access
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'acceptance_tokens' AND policyname = 'Admin full access to acceptance_tokens') THEN
            CREATE POLICY "Admin full access to acceptance_tokens"
                ON acceptance_tokens FOR ALL
                USING (public.is_admin());
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Policies already exist or error creating them: %', SQLERRM;
    END $POLICY$;

    -- Step 7: Grant permissions
    GRANT ALL ON acceptance_tokens TO authenticated;
    GRANT EXECUTE ON FUNCTION get_application_token_data TO authenticated, anon;

    RAISE NOTICE 'Successfully set up Bryan application and acceptance token!';
    RAISE NOTICE 'User ID: %, Application ID: %, Token: %', v_user_id, v_application_id, v_token;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error in setup: %', SQLERRM;
END $$; 