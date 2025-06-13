import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface RequestPayload {
  email: string;
}

function getSupabaseAdminClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('BACKEND_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase URL or Service Role Key environment variables.')
    throw new Error('Server configuration error.')
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email } = await req.json() as RequestPayload

    if (!email) {
      return new Response(JSON.stringify({ error: 'Missing email' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const normalizedEmail = email.toLowerCase().trim()
    const supabaseAdmin = getSupabaseAdminClient()

    // 1. Check if email is whitelisted
    console.log(`Checking if ${normalizedEmail} is whitelisted...`)
    const { data: whitelistData, error: whitelistError } = await supabaseAdmin
      .from('whitelist')
      .select('id, email')
      .eq('email', normalizedEmail)
      .single()

    if (whitelistError || !whitelistData) {
      console.log(`Email ${normalizedEmail} is not whitelisted`)
      return new Response(JSON.stringify({ 
        message: 'Email not whitelisted',
        isWhitelisted: false 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // 2. Check if auth user already exists
    console.log(`Checking for existing auth user: ${normalizedEmail}`)
    const { data: existingUsersData, error: listUsersError } = await supabaseAdmin.auth.admin.listUsers()

    if (listUsersError) {
      console.error('Error listing users:', listUsersError)
      throw new Error(`Failed to list users: ${listUsersError.message}`)
    }

    const existingUser = existingUsersData?.users.find(u => u.email === normalizedEmail)

    if (existingUser) {
      console.log(`Auth user already exists for ${normalizedEmail}: ${existingUser.id}`)
      
      // Update user metadata to mark as whitelisted if not already
      const userMetadata = {
        ...existingUser.user_metadata,
        is_whitelisted: true,
        // PRESERVE existing has_seen_welcome value, don't reset to false
        has_seen_welcome: existingUser.user_metadata?.has_seen_welcome ?? false,
        has_completed_whitelist_signup: existingUser.user_metadata?.has_completed_whitelist_signup ?? false,
      }

      const { error: updateUserError } = await supabaseAdmin.auth.admin.updateUserById(
        existingUser.id,
        { user_metadata: userMetadata }
      )

      if (updateUserError) {
        console.error(`Error updating user metadata:`, updateUserError)
        throw new Error(`Failed to update user metadata: ${updateUserError.message}`)
      }

      // Update whitelist table to link the existing auth user
      await supabaseAdmin
        .from('whitelist')
        .update({
          has_created_account: true,
          account_created_at: new Date().toISOString(),
          user_id: existingUser.id,
        })
        .eq('id', whitelistData.id)

      return new Response(JSON.stringify({ 
        success: true, 
        userId: existingUser.id, 
        operation: 'linked',
        isWhitelisted: true 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // 3. Create new auth user
    console.log(`Creating new auth user for whitelisted email: ${normalizedEmail}`)
    const tempPassword = `temp-${crypto.randomUUID()}`
    
    const { data: newUserData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: false,
      user_metadata: {
        is_whitelisted: true,
        // For new users, default to false (they haven't seen welcome yet)
        has_seen_welcome: false,
        has_completed_whitelist_signup: false,
      },
    })

    if (createUserError) {
      console.error('Error creating user:', createUserError)
      
      // Handle the case where user exists but we couldn't find them in listUsers
      if (createUserError.message.includes('already been registered')) {
        console.log('User exists but not found in listUsers - attempting to get user by email')
        
        // Try to find the user by email using a different approach
        const { data: userByEmail, error: getUserError } = await supabaseAdmin.auth.admin.getUserByEmail(normalizedEmail)
        
        if (getUserError) {
          throw new Error(`Failed to find existing user: ${getUserError.message}`)
        }
        
        if (userByEmail?.user) {
          console.log(`Found existing user via getUserByEmail: ${userByEmail.user.id}`)
          
          // Update whitelist table to link this user
          await supabaseAdmin
            .from('whitelist')
            .update({
              has_created_account: true,
              account_created_at: new Date().toISOString(),
              user_id: userByEmail.user.id,
            })
            .eq('id', whitelistData.id)

          return new Response(JSON.stringify({ 
            success: true, 
            userId: userByEmail.user.id, 
            operation: 'linked_existing',
            isWhitelisted: true 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          })
        }
      }
      
      throw new Error(`Failed to create user: ${createUserError.message}`)
    }

    if (!newUserData?.user) {
      throw new Error('User creation failed to return expected data.')
    }

    const authUserId = newUserData.user.id
    console.log(`Successfully created new auth user: ${authUserId}`)

    // 4. Update whitelist table
    await supabaseAdmin
      .from('whitelist')
      .update({
        has_created_account: true,
        account_created_at: new Date().toISOString(),
        user_id: authUserId,
      })
      .eq('id', whitelistData.id)

    return new Response(JSON.stringify({ 
      success: true, 
      userId: authUserId, 
      operation: 'created',
      isWhitelisted: true 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in create-whitelisted-auth-user:', error)
    return new Response(JSON.stringify({ 
      error: error.message,
      isWhitelisted: false 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
}) 