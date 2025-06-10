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

    const isWhitelisted = !whitelistError && whitelistData
    console.log(`Email ${normalizedEmail} whitelist status: ${isWhitelisted}`)

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
      
      // Update user metadata based on whitelist status
      const userMetadata = {
        ...existingUser.user_metadata,
        is_whitelisted: isWhitelisted,
        // PRESERVE existing values
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

      // Update whitelist table if user is whitelisted
      if (isWhitelisted && whitelistData) {
        await supabaseAdmin
          .from('whitelist')
          .update({
            has_created_account: true,
            account_created_at: new Date().toISOString(),
            user_id: existingUser.id,
          })
          .eq('id', whitelistData.id)
      }

      // Generate magic link for existing user
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: normalizedEmail,
      })

      if (linkError) {
        console.error('Error generating magic link:', linkError)
        throw new Error(`Failed to generate magic link: ${linkError.message}`)
      }

      console.log(`Magic link generated for existing user: ${normalizedEmail}`)

      return new Response(JSON.stringify({ 
        success: true, 
        userId: existingUser.id, 
        operation: 'linked',
        isWhitelisted: isWhitelisted,
        message: 'Code sent! Check your email (and spam/junk folder).'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // 3. Create new auth user (for both whitelisted and non-whitelisted)
    console.log(`Creating new auth user for email: ${normalizedEmail} (whitelisted: ${isWhitelisted})`)
    const tempPassword = `temp-${crypto.randomUUID()}`
    
    const userMetadata = isWhitelisted ? {
      is_whitelisted: true,
      has_seen_welcome: false,
      has_completed_whitelist_signup: false,
      application_status: 'approved',
      has_applied: true
    } : {
      is_whitelisted: false,
      has_applied: false,
      application_status: null
    }

    const { data: newUserData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: false,
      user_metadata: userMetadata,
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
          
          // Update whitelist table if user is whitelisted
          if (isWhitelisted && whitelistData) {
            await supabaseAdmin
              .from('whitelist')
              .update({
                has_created_account: true,
                account_created_at: new Date().toISOString(),
                user_id: userByEmail.user.id,
              })
              .eq('id', whitelistData.id)
          }

          // Generate magic link
          const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email: normalizedEmail,
          })

          if (linkError) {
            console.error('Error generating magic link:', linkError)
            throw new Error(`Failed to generate magic link: ${linkError.message}`)
          }

          return new Response(JSON.stringify({ 
            success: true, 
            userId: userByEmail.user.id, 
            operation: 'linked_existing',
            isWhitelisted: isWhitelisted,
            message: 'Code sent! Check your email (and spam/junk folder).'
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

    // 4. Update whitelist table if user is whitelisted
    if (isWhitelisted && whitelistData) {
      await supabaseAdmin
        .from('whitelist')
        .update({
          has_created_account: true,
          account_created_at: new Date().toISOString(),
          user_id: authUserId,
        })
        .eq('id', whitelistData.id)
    }

    // 5. Generate magic link for the new user
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: normalizedEmail,
    })

    if (linkError) {
      console.error('Error generating magic link:', linkError)
      throw new Error(`Failed to generate magic link: ${linkError.message}`)
    }

    console.log(`Magic link generated for new user: ${normalizedEmail}`)

    return new Response(JSON.stringify({ 
      success: true, 
      userId: authUserId, 
      operation: 'created',
      isWhitelisted: isWhitelisted,
      message: 'Code sent! Check your email (and spam/junk folder).'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in create-whitelisted-user-2:', error)
    return new Response(JSON.stringify({ 
      error: error.message,
      isWhitelisted: false 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
}) 