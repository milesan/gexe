// supabase/functions/create-booking-securely/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { normalizeToUTCDate, formatDateOnly } from "../_shared/date_utils.ts"; // Assuming date utils are moved to shared

console.log("Create Booking Securely function booting up...");

// Helper to invoke another function (consider adding error handling/retries)
async function invokeFunction(supabaseAdmin: SupabaseClient, functionName: string, body: object) {
    const { data, error } = await supabaseAdmin.functions.invoke(functionName, { body });
    if (error) throw error; // Rethrow function invocation errors
    return data;
}

// Helper to validate discount code (can be refactored from validate-discount-code)
async function validateDiscountCodeInternal(
    supabaseAdmin: SupabaseClient,
    codeToValidate: string
): Promise<{ code: string; percentage_discount: number } | null> {
    if (!codeToValidate) return null;

    const { data, error } = await supabaseAdmin
        .from('discount_codes')
        .select('code, percentage_discount')
        .ilike('code', codeToValidate)
        .eq('is_active', true)
        .limit(1)
        .single();

    if (error) {
        if (error.code === 'PGRST116') { // Not found is not a server error here
            console.log(`[CreateBookingSecurely] Discount code "${codeToValidate}" not found or inactive.`);
            return null;
        } else {
            // Log actual DB errors
            console.error(`[CreateBookingSecurely] Error validating discount code "${codeToValidate}":`, error);
            // Decide if this should halt the booking or just ignore the discount
            // For now, let's ignore the discount but maybe throw for critical DB errors?
            // throw new Error(`Database error validating discount code: ${error.message}`);
             return null; // Treat DB errors (other than not found) as invalid code for now
        }
    }
    return data;
}

serve(async (req: Request) => {
    // --- CORS Handling ---
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    let bookingPayload: any;
    let userId: string | null = null;
    let userEmail: string | null = null;

    // --- Get Auth Context & Parse Payload ---
    try {
        // IMPORTANT: Use Supabase Admin client for trusted operations
        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "" // Use Service Role Key!
        );

        // Retrieve user information from the request's Authorization header
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) throw new Error("Missing Authorization header.");

        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
        if (userError || !user) {
            console.error("[CreateBookingSecurely] Auth error:", userError);
            throw new Error("Authentication failed or user not found.");
        }
        userId = user.id;
        userEmail = user.email ?? null;
        console.log(`[CreateBookingSecurely] Authenticated user: ${userId}`);

        bookingPayload = await req.json();
        console.log("[CreateBookingSecurely] Received payload:", bookingPayload);
        if (!bookingPayload || typeof bookingPayload !== "object") throw new Error("Invalid JSON payload.");

        // Basic payload validation (add more specific checks as needed)
        const requiredFields = ["accommodationId", "checkIn", "checkOut", "foodContribution"]; // Expect foodContribution now
        for (const field of requiredFields) {
            if (!(field in bookingPayload)) {
                throw new Error(`Missing required field in payload: ${field}`);
            }
        }

    } catch (error: any) {
        console.error("[CreateBookingSecurely] Error during setup:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400, // Bad Request for auth or parsing errors
        });
    }

    // --- Main Booking Logic ---
    try {
        // Format dates needed for multiple steps early on
        const checkInISO = formatDateOnly(normalizeToUTCDate(new Date(bookingPayload.checkIn)));
        const checkOutISO = formatDateOnly(normalizeToUTCDate(new Date(bookingPayload.checkOut)));

        // 1. Re-calculate Price (using the other function)
        console.log("[CreateBookingSecurely] Calling calculate-booking-price function...");
         const priceCalcPayload = {
            accommodationId: bookingPayload.accommodationId,
            checkInDate: checkInISO, // Use already formatted date
            checkOutDate: checkOutISO, // Use already formatted date
            foodContribution: bookingPayload.foodContribution // Pass it through
         };
        // Need Admin client to invoke functions internally if RLS restricts anon/auth
         const supabaseAdminForInvoke = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "" // Service role needed
        );
        const priceResult = await invokeFunction(supabaseAdminForInvoke, "calculate-booking-price", priceCalcPayload);
        console.log("[CreateBookingSecurely] Price calculation result:", priceResult);
        if (!priceResult || typeof priceResult.subtotal !== 'number') {
            throw new Error("Failed to calculate booking subtotal server-side.");
        }
        const serverSubtotal = priceResult.subtotal;

        // 2. Validate Discount Code (if provided)
        let finalTotalPrice = serverSubtotal;
        let discountAmount = 0;
        let validatedDiscountCode: string | null = null;
        const codeFromPayload = bookingPayload.appliedDiscountCode?.trim();

        if (codeFromPayload) {
            console.log(`[CreateBookingSecurely] Validating provided discount code: ${codeFromPayload}`);
            const discountDetails = await validateDiscountCodeInternal(supabaseAdminForInvoke, codeFromPayload);

            if (discountDetails) {
                console.log(`[CreateBookingSecurely] Discount code ${discountDetails.code} validated. Applying ${discountDetails.percentage_discount}%`);
                const percentage = discountDetails.percentage_discount / 100;
                discountAmount = parseFloat((serverSubtotal * percentage).toFixed(2));
                finalTotalPrice = parseFloat((serverSubtotal - discountAmount).toFixed(2));
                // Ensure non-negative
                if (finalTotalPrice < 0) finalTotalPrice = 0;
                validatedDiscountCode = discountDetails.code; // Store the validated code (correct casing)
            } else {
                console.warn(`[CreateBookingSecurely] Provided discount code ${codeFromPayload} was invalid or inactive. Proceeding without discount.`);
                // Optional: throw an error here if an invalid code should HALT the booking?
                // throw new Error(`The provided discount code '${codeFromPayload}' is invalid or has expired.`);
            }
        }

        // 3. Re-check Availability (Crucial!) - Use admin client
        console.log(`[CreateBookingSecurely] Re-checking availability for ${bookingPayload.accommodationId} from ${checkInISO} to ${checkOutISO}...`);
        const { data: availabilityResults, error: availabilityError } = await supabaseAdminForInvoke
            .rpc("get_accommodation_availability", {
                check_in_date: checkInISO,
                check_out_date: checkOutISO,
            });

        if (availabilityError) {
             console.error("[CreateBookingSecurely] Error checking availability:", availabilityError);
             throw new Error(`Server error checking availability: ${availabilityError.message}`);
        }

        // Find the specific accommodation in the results
        const accommodationAvailability = (availabilityResults as any[])?.find(
            (a) => a.accommodation_id === bookingPayload.accommodationId
        );

        // Check if it exists and if it's available OR if it's unlimited capacity
        const isAvailable = accommodationAvailability?.is_available;
        const isUnlimited = accommodationAvailability?.is_unlimited; // Assuming RPC returns this

        if (!isUnlimited && !isAvailable) {
             console.warn(`[CreateBookingSecurely] Availability check FAILED for ${bookingPayload.accommodationId} on ${checkInISO} to ${checkOutISO}.`);
             // Use a specific, user-friendly error message
             throw new Error("Sorry, this accommodation is no longer available for the selected dates. Please try different dates.");
        }
        console.log(`[CreateBookingSecurely] Availability check passed for ${bookingPayload.accommodationId}. Unlimited: ${isUnlimited}, Available: ${isAvailable}`);
        // --- End Availability Check ---

        // 4. Insert Booking using SERVER-CALCULATED price
        const bookingToInsert = {
            accommodation_id: bookingPayload.accommodationId,
            user_id: userId,
            check_in: checkInISO,
            check_out: checkOutISO,
            total_price: finalTotalPrice, // Use server-calculated price!
            applied_discount_code: validatedDiscountCode, // Store validated code
            discount_amount: discountAmount > 0 ? discountAmount : null, // Store discount amount
            status: 'confirmed', // Default status
            // Add other necessary fields (e.g., food_contribution if you add that column)
            // created_at/updated_at have defaults
        };
        console.log("[CreateBookingSecurely] Inserting booking record:", bookingToInsert);

        const { data: newBooking, error: insertError } = await supabaseAdminForInvoke
            .from('bookings')
            .insert(bookingToInsert)
            .select('*') // Select the fields needed by the frontend
            .single();

        if (insertError) {
            console.error("[CreateBookingSecurely] Error inserting booking:", insertError);
            // TODO: Handle specific DB errors, e.g., constraint violations (like overlapping bookings if you have checks)
            throw new Error(`Database error creating booking: ${insertError.message}`);
        }

        if (!newBooking) {
            throw new Error("Booking record was not returned after insert.");
        }
        console.log("[CreateBookingSecurely] Booking created successfully:", newBooking.id);

        // 5. Trigger Confirmation Email
        if (userEmail) {
            console.log(`[CreateBookingSecurely] Triggering confirmation email for ${userEmail}`);
            try {
                // Get accommodation title for email
                const { data: accommodation } = await supabaseAdminForInvoke
                    .from('accommodations')
                    .select('title')
                    .eq('id', bookingPayload.accommodationId)
                    .single();

                const accommodationTitle = accommodation?.title || 'Accommodation';
                
                // Determine frontend URL based on environment
                const frontendUrl = Deno.env.get('FRONTEND_URL') || 
                                  Deno.env.get('DEPLOY_URL') || 
                                  Deno.env.get('APP_URL') || 
                                  'https://in.thegarden.pt';
                
                console.log(`[CreateBookingSecurely] Sending email with details:`, {
                    email: userEmail,
                    bookingId: newBooking.id,
                    checkIn: checkInISO,
                    checkOut: checkOutISO,
                    accommodation: accommodationTitle,
                    totalPrice: finalTotalPrice,
                    frontendUrl
                });

                const { error: emailError } = await supabaseAdminForInvoke.functions.invoke(
                    'send-booking-confirmation',
                    {
                        body: {
                            email: userEmail,
                            bookingId: newBooking.id,
                            checkIn: checkInISO,
                            checkOut: checkOutISO,
                            accommodation: accommodationTitle,
                            totalPrice: finalTotalPrice,
                            frontendUrl
                        }
                    }
                );

                if (emailError) {
                    console.error(`[CreateBookingSecurely] Error sending confirmation email:`, emailError);
                    // Don't throw - booking was created successfully, just log the email error
                } else {
                    console.log(`[CreateBookingSecurely] Confirmation email sent successfully`);
                }
            } catch (emailErr) {
                console.error(`[CreateBookingSecurely] Exception sending confirmation email:`, emailErr);
                // Don't throw - booking was created successfully, just log the email error
            }
        }

        // 6. Return Success Response (only return necessary fields)
        return new Response(JSON.stringify(newBooking), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error: any) {
        console.error("[CreateBookingSecurely] Error processing booking:", error);
        // Ensure specific errors (like validation, availability) provide useful messages
        return new Response(JSON.stringify({ error: error.message || "Failed to process booking." }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: error.message.includes("not found") ? 404 : 500, // Adjust status based on error type
        });
    }
}); 