import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface RequestPayload {
  email: string;
  whitelistId: string;
}

// Function to get Supabase Admin client
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
    const { email, whitelistId } = await req.json() as RequestPayload

    if (!email || !whitelistId) {
      return new Response(JSON.stringify({ error: 'Missing email or whitelistId' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Normalize email to lowercase to match Supabase Auth behavior
    const normalizedEmail = email.toLowerCase().trim()

    const supabaseAdmin = getSupabaseAdminClient()
    let authUserId: string
    let userExists = false

    // 1. Check if user exists in auth.users
    console.log(`Checking for existing user with email: ${normalizedEmail}`)
    const { data: existingUsersData, error: listUsersError } = await supabaseAdmin.auth.admin.listUsers({
      // The listUsers filter by email is a substring match, so we need to be careful
      // However, Supabase enforces email uniqueness in auth.users by default.
      // If email is not unique for some reason, this needs refinement.
    });

    if (listUsersError) {
        console.error('Error listing users:', listUsersError);
        throw new Error(`Failed to list users: ${listUsersError.message}`);
    }

    const existingUser = existingUsersData?.users.find(u => u.email === normalizedEmail);

    const userMetadata = {
      is_whitelisted: true,
      has_seen_welcome: false,
      has_completed_whitelist_signup: false, // The new flag!
    }

    if (existingUser) {
      console.log(`User ${existingUser.id} found. Updating metadata.`)
      authUserId = existingUser.id
      userExists = true
      const { error: updateUserError } = await supabaseAdmin.auth.admin.updateUserById(
        authUserId,
        { user_metadata: { ...existingUser.user_metadata, ...userMetadata } } // Merge with existing metadata
      )
      if (updateUserError) {
        console.error(`Error updating user ${authUserId} metadata:`, updateUserError)
        throw new Error(`Failed to update user metadata: ${updateUserError.message}`)
      }
      console.log(`Successfully updated metadata for user: ${authUserId}`)
    } else {
      console.log(`No existing user found for ${normalizedEmail}. Creating new user.`)
      const tempPassword = `temp-${crypto.randomUUID()}` // Secure random temporary password
      const { data: newUserData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password: tempPassword,
        email_confirm: false, // Don't send confirmation email
        user_metadata: userMetadata,
      })

      if (createUserError) {
        console.error('Error creating user:', createUserError)
        if (createUserError.message.includes('User already registered')) {
          throw new Error(`User registration conflict for email: ${normalizedEmail}`)
        }
        throw new Error(`Failed to create user: ${createUserError.message}`)
      }
      if (!newUserData || !newUserData.user) {
        console.error('User creation did not return user data.')
        throw new Error('User creation failed to return expected data.')
      }
      authUserId = newUserData.user.id
      console.log(`Successfully created new user: ${authUserId} for email: ${normalizedEmail}`)
    }

    // 2. Update the whitelist table
    console.log(`Updating whitelist entry ID: ${whitelistId} with user_id: ${authUserId}`)
    const { error: whitelistUpdateError } = await supabaseAdmin
      .from('whitelist')
      .update({
        has_created_account: true,
        account_created_at: new Date().toISOString(),
        user_id: authUserId, // Changed from auth_user_id to user_id
      })
      .eq('id', whitelistId)

    if (whitelistUpdateError) {
      console.error(`Error updating whitelist table for ID ${whitelistId}:`, whitelistUpdateError)
      throw new Error(`Failed to update whitelist entry: ${whitelistUpdateError.message}`)
    }
    console.log(`Successfully updated whitelist entry: ${whitelistId}`)

    return new Response(
      JSON.stringify({ success: true, userId: authUserId, operation: userExists ? 'updated' : 'created' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Overall error in setup-whitelisted-auth-user:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: error.message.includes('User registration conflict') ? 409 : 500,
      }
    )
  }
}) 