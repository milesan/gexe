// supabase/functions/validate-discount-code/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts' // Assuming you have a shared CORS config

console.log('Validate Discount Code function booting up...')

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return new Response('ok', { headers: corsHeaders })
  }

  let codeToValidate: string | null = null;

  // --- Get code from request body ---
  try {
    const body = await req.json();
    console.log('Request body received:', body);
    if (body && typeof body.code === 'string') {
      codeToValidate = body.code.trim();
      console.log('Code extracted from body:', codeToValidate);
    } else {
       console.warn('Request body missing "code" string.');
       throw new Error('Missing "code" in request body.');
    }
  } catch (error) {
    console.error('Error parsing request body:', error);
    return new Response(
      JSON.stringify({ error: 'Invalid request body. Expecting JSON with a "code" field.' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400, // Bad Request
      }
    );
  }

  // --- Validate input ---
  if (!codeToValidate || codeToValidate.length === 0) {
    console.log('Validation failed: Code is empty.');
    return new Response(
      JSON.stringify({ error: 'Discount code cannot be empty.' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400, // Bad Request
      }
    );
  }

  console.log(`Validating code: "${codeToValidate}"`);

  // --- Query Supabase ---
  try {
    // Create Supabase client with service role key for unrestricted access within the function
    const supabaseClient = createClient(
      // Get Supabase URL and anon key from environment variables
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      // Create client server-side by passing auth details.
      {
         global: { headers: { Authorization: req.headers.get('Authorization')! } }
       }
    );

    console.log('Querying discount_codes table...');
    const { data: codeData, error: codeError } = await supabaseClient
      .from('discount_codes')
      .select('id, code, percentage_discount, is_active, description, applies_to')
      .eq('code', codeToValidate)
      .single();

    if (codeError) {
      // Differentiate between "not found" and actual errors
      if (codeError.code === 'PGRST116') { // PostgREST code for "Resource not found"
        console.log(`Code "${codeToValidate}" not found or inactive.`);
        return new Response(
          JSON.stringify({ error: 'Invalid or inactive discount code.' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400, // Changed from 404 to 400 Bad Request
          }
        );
      } else {
        // Other database error
        console.error('Supabase query error:', codeError);
        throw new Error(codeError.message || 'Database query failed.');
      }
    }

    // --- Success Case ---
    if (codeData) {
      // Check if the discount code is active
      if (!codeData.is_active) {
        console.log(`Code "${codeToValidate}" is inactive.`);
        return new Response(
          JSON.stringify({ error: 'This discount code is no longer active.' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400, // Bad Request
          }
        );
      }

      console.log(`Code "${codeToValidate}" validated successfully:`, codeData);
      return new Response(
        JSON.stringify({
          id: codeData.id,
          code: codeData.code,
          percentage_discount: codeData.percentage_discount,
          description: codeData.description,
          applies_to: codeData.applies_to || 'total'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200, // OK
        }
      );
    } else {
       // This case should technically be caught by PGRST116, but acts as a fallback
       console.warn(`Code "${codeToValidate}" query returned no data and no specific error.`);
        return new Response(
          JSON.stringify({ error: 'Invalid or inactive discount code.' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400, // Bad Request
          }
        );
    }

  } catch (error: any) {
    console.error('Unexpected error during validation:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to validate discount code due to an internal error.' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500, // Internal Server Error
      }
    );
  }
}); 