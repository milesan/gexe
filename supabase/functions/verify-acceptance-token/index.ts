import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  console.log('Function invoked with method:', req.method);
  console.log('Request headers:', Object.fromEntries(req.headers.entries()));

  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return new Response('ok', {
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      status: 200,
    });
  }

  console.log('Processing POST request');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    console.log('SUPABASE_URL:', supabaseUrl || 'not set');
    console.log('SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? '[redacted]' : 'not set');

    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL is not set');
    }
    if (!serviceRoleKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    console.log('Supabase client initialized successfully');

    const { token } = await req.json();
    console.log('Received token:', token);
    if (!token) {
      throw new Error('Token is required');
    }

    const { data: tokenData, error: tokenError } = await supabase
      .from('acceptance_tokens')
      .select(`
        token,
        application_id,
        used_at,
        expires_at,
        applications (
          user_id,
          users (
            email
          )
        )
      `)
      .eq('token', token)
      .single();

    if (tokenError) {
      console.error('Error fetching token:', tokenError);
      throw new Error('Token verification failed: ' + tokenError.message);
    }

    if (!tokenData) {
      throw new Error('Token not found');
    }

    if (tokenData.used_at) {
      throw new Error('Token already used');
    }

    const now = new Date();
    const expiresAt = new Date(tokenData.expires_at);
    if (now > expiresAt) {
      throw new Error('Token has expired');
    }

    const email = tokenData.applications?.users?.email;
    if (!email) {
      throw new Error('No email associated with this token');
    }

    console.log('Token valid for email:', email);

    const { error: updateTokenError } = await supabase
      .from('acceptance_tokens')
      .update({ used_at: now.toISOString() })
      .eq('token', token);

    if (updateTokenError) {
      console.error('Error marking token as used:', updateTokenError);
      throw new Error('Failed to update token status');
    }

    const { error: updateAppError } = await supabase
      .from('applications')
      .update({ status: 'approved' })
      .eq('id', tokenData.application_id);

    if (updateAppError) {
      console.error('Error updating application status:', updateAppError);
      throw new Error('Failed to update application status');
    }

    // Set a temporary password and sign in
    const tempPassword = crypto.randomUUID();
    const { error: updateUserError } = await supabase.auth.admin.updateUserById(tokenData.applications.user_id, {
      password: tempPassword,
    });

    if (updateUserError) {
      console.error('Error setting temp password:', updateUserError);
      throw new Error('Failed to set temp password');
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: tempPassword,
    });

    if (authError) {
      console.error('Error signing in with temp password:', authError);
      throw new Error('Failed to sign in: ' + authError.message);
    }

    console.log('User signed in successfully:', email);
    return new Response(
      JSON.stringify({ session: authData.session }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Verification function error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});