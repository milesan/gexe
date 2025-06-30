-- Manual Application Submission for Bryan Jeffs
-- This script manually creates a user and submits their application
-- IMPORTANT: Replace 'bryanjeffs@example.com' with Bryan's actual email address

DO $$
DECLARE
    v_user_id uuid;
    v_email text := 'bryanjeffs@example.com'; -- REPLACE WITH ACTUAL EMAIL
    v_application_data jsonb;
BEGIN
    -- Check if user already exists
    SELECT id INTO v_user_id 
    FROM auth.users 
    WHERE email = v_email;

    IF v_user_id IS NULL THEN
        -- Generate new user ID
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

    -- Application data with all Bryan's answers
    v_application_data := '{
        "0397b9b1-39b9-4fee-914f-25c16f3ddd9a": "I welded together a chin up bar one evening for a friend. It was a spirited and resourceful clamouring process.\\n\\nA key design philosophy and aesthetic I natively employ celebrates structure as beauty in pursuit of the essential and elegant. \\n\\n My friend is a poet who cherishes my embodiment virtues as a beacon.\\n\\nI recycled steel from an old cattle truck.\\n",
        "0d216f74-ad4c-4d02-bba7-d54853a6b07b": "Oh I just mentioned this. \\nIt is a comprehensive lens to consider the aspects of self or god in procession. It helps articulate the gnosis of cyclical nature and relationality.",
        "0efef050-aedb-4f28-8380-f5e09f20c4c6": [{"url": "https://guquxpxxycfmmlqajdyw.supabase.co/storage/v1/object/public/application-photos/photos/1751105777778-IMG1477.jpeg", "fileName": "1751105777778-IMG1477.jpeg"}, {"url": "https://guquxpxxycfmmlqajdyw.supabase.co/storage/v1/object/public/application-photos/photos/1751105777778-IMG1152.jpeg", "fileName": "1751105777778-IMG1152.jpeg"}, {"url": "https://guquxpxxycfmmlqajdyw.supabase.co/storage/v1/object/public/application-photos/photos/1751105777778-IMG1064.jpeg", "fileName": "1751105777778-IMG1064.jpeg"}],
        "1346d368-b560-44c8-b026-14776c1b9a79": "Oh the poor civilians. I am grieved that we suffer a cultural wound at the loss of Gaza. I am not sure exac",
        "18fdf65b-a5c9-414d-bbfa-3057a7e2fba7": "No not logical but it is not excluding the possibility either. ",
        "241d9c89-0323-4003-9a20-7c19309ba488": "When I was 17 I was enfj but very close to estj so I am not sure how it stacks up however I can go deep on my astrology for a thorough being assessment",
        "246d0acf-25cd-4e4e-9434-765e6ea679cb": "Jeffs",
        "36d8768e-938c-4287-b434-b7d3da6dd8d8": "I quite like this fellow bassforge and this other gent er charlie solis.\\n\\nThe theories and research they cover are largely regarding resonance. seismic schuman ELF waves oscillating our earth and minds with architecture built as capacitors and other tremendous things.",
        "3744486e-edf6-460b-9021-2450743da2d9": "Yes, I know how to garden",
        "39f455d1-0de8-438f-8f34-10818eaec15e": "Bryan",
        "3ccd4d31-f706-4715-b6a3-134e7beaf85d": "No",
        "4b108d7c-d05e-4036-b060-cd18323a0f6f": "Yes, I definitely will not bring an animal with me even though it is super cute.",
        "54d02288-6d35-46e2-884b-f2479fb93e75": "Astrology. Under the pretense that a marvellous constellar choreography is whipping up our curious experience by mechanical resonance. \\n\\nAaand I believe in exceptions to rules. ",
        "5d9383fa-0f22-46d1-b612-76a5df303d29": "Zali gee",
        "6a15976b-c98e-49e2-874a-ce1a7239d4c9": "Confidence. Confiding in myself. Allowing my own goodness and intentionality and inspiration to be the governing principle for my life.",
        "702ae994-6f64-4e81-a2b3-2593fbc0c937": "Passport or drivers licence usually. Haha. But ah I am guessing you mean in terms of gender identity. So I am a man.",
        "73d367b8-2238-452b-83eb-808e96e2be21": "As you wish.",
        "74edfb7a-458e-4dca-bed5-90dd5ccc1bb7": "@bryanjeffs - insta",
        "790d2581-67ff-40a0-b59e-fab7aaf3e55e": "38 single father about to relocate home (fortuitous gap) living in Australia..\\n\\n My two daughters could come with me or stay with their mother in Australia.\\n\\nMy inner life and social sphere is rich. My carpentry and landscaping business is in an early iterative stage. I have divorced from the hamster wheel and beginning to land creative opportunities in meaningful relationships.",
        "8039351b-c928-46bc-9389-3ca354033580": "I do not know them if there are any. ",
        "862413b2-5753-4020-bffc-4c8fd71b0568": "+61481862118",
        "91c501fe-954e-47bf-823e-106637b96194": "Have you experienced an inconvenient delight recently or been surprised by happenstance. \\n\\nWhat is your most cherished restorative activity.\\n\\nDid you see the sun rise this morning!?",
        "ae5cc5b2-e2ec-4126-9e53-7ab7fc495324": "2025-07-08T00:00:00.000Z",
        "b57ef1b4-612f-4e1c-b88b-eefe0211ba5e": "Not inherently. If I have hurt feelings they are mine to process and I will discern whether to invite the other party to consider my experience. ",
        "d2565ce6-c5b8-4969-b17d-b1232f270f18": "I am chuckling to myself because it is not beliefs that have changed but how to integrate them. For instance I believe when I am confronted or offended by something or someone there will be a misalignment of values or a misunderstanding. In that case I can make an enquiry and register/consider my values. How I respond determines whether I am integrated and able to act with agency and respect. If I defer and compromise I forfeit harmony and my value.",
        "e0e50caf-fdc0-4476-a424-c250ada6d962": "I am refining and expanding my artistic placemaking practice and seeking collaboration with people of substance and depth. I am engaged with spiritual and material values as they converse and I am on a mission to find friends and opportunities to develop. ",
        "ea59d026-9f24-4b22-b06e-8a3221d9b95c": "It is all in what we do and say and how we move. The body tells the truth. How we cook and clean and dance. Many people open at different rates on different terms. So getting to know someone is generally on their terms :P",
        "ee251d40-6354-44f7-b1eb-4245c04d1de6": "If you knew me you would know that I wish to play. That my depth of inquiry is to make a safe place for the nourishing wisdom of play.  ",
        "bfde0ed9-319a-45e4-8b0d-5c694ca2c850": "No <3"
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
    );

    RAISE NOTICE 'Successfully submitted application for Bryan Jeffs (User ID: %)', v_user_id;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error submitting application: %', SQLERRM;
END $$; 