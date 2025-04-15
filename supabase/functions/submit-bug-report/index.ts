import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

console.log("Initializing submit-bug-report function v3 (with image_urls)");

interface BugReportPayload {
  description: string;
  stepsToReproduce?: string;
  pageUrl: string;
  image_urls?: string[] | null;
}

async function insertBugReport(supabaseClient: SupabaseClient, report: BugReportPayload, userId: string) {
  console.log(`Attempting to insert bug report for user: ${userId} with image URLs:`, report.image_urls);

  const { data, error } = await supabaseClient
    .from('bug_reports')
    .insert({
      user_id: userId,
      description: report.description,
      steps_to_reproduce: report.stepsToReproduce,
      page_url: report.pageUrl,
      status: 'new',
      image_urls: report.image_urls,
    })
    .select()
    .single();

  if (error) {
    console.error('Supabase insert error:', error);
    throw new Error(`Failed to insert bug report for user ${userId}: ${error.message}`);
  }

  console.log('Bug report inserted successfully:', data);
  return data;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log(`Received ${req.method} request`);
    const payload: BugReportPayload = await req.json();
    console.log('Request payload:', payload);

    // Validate payload
    if (!payload.description) {
      throw new Error('Missing required field: description');
    }
    if (!payload.pageUrl) {
      console.warn('Missing pageUrl, setting to unknown');
      payload.pageUrl = 'unknown'; // Add default if missing
    }
    if (payload.image_urls === undefined) {
        payload.image_urls = null;
    } else if (Array.isArray(payload.image_urls) && payload.image_urls.some(url => typeof url !== 'string')) {
        console.warn('Invalid image_urls format detected. Setting to null.');
        payload.image_urls = null; 
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase environment variables');
      throw new Error('Server configuration error.');
    }

    // IMPORTANT: Use the ANON key here. The user's identity comes from the
    // Authorization header passed in the fetch request from the browser.
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      // Get the Authorization header from the request
      global: { headers: { Authorization: req.headers.get('Authorization')! } },
      auth: {
         // We don't need persistSession client-side for edge functions
         persistSession: false
      }
    });
    console.log('Supabase client created for user context.');

    // --- Get User ID --- 
    console.log('Attempting to get user from token...');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError) {
        console.error('Error getting user:', userError);
        throw new Error(`Authentication error: ${userError.message}`);
    }
    if (!user) {
        console.error('No user found for the provided token.');
        throw new Error('Authentication error: User not found.');
    }
    console.log(`User ID retrieved: ${user.id}`);
    // --- End Get User ID ---

    // Insert the bug report, passing the potentially modified payload and user ID
    const insertedData = await insertBugReport(supabaseClient, payload, user.id);

    return new Response(
      JSON.stringify({ success: true, data: insertedData }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error processing request:', error);
    let status = 500;
    if (error.message.includes('Missing required field')) status = 400;
    if (error.message.includes('Authentication error')) status = 401; // Unauthorized

    return new Response(
      JSON.stringify({ success: false, error: error.message }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: status,
      }
    );
  }
});

console.log('submit-bug-report function initialized successfully (v3)'); 