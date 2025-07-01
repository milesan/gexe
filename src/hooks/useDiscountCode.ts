import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { AppliedDiscount } from '../components/BookingSummary/BookingSummary.types';

export function useDiscountCode() {
  const [discountCodeInput, setDiscountCodeInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscount | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [isApplyingDiscount, setIsApplyingDiscount] = useState(false);

  const handleApplyDiscount = useCallback(async () => {
    const codeToApply = discountCodeInput.trim().toUpperCase(); // Standardize
    if (!codeToApply) return;

    console.log('[useDiscountCode] Applying discount code:', codeToApply);
    setIsApplyingDiscount(true);
    setDiscountError(null);
    setAppliedDiscount(null); // Clear previous discount first

    try {
      // Get the current session token for authorization
      const sessionResponse = await supabase.auth.getSession();
      const token = sessionResponse?.data?.session?.access_token;

      if (!token) {
        throw new Error('Authentication token not found. Please sign in.');
      }

      // Get Supabase URL from the client
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://lpsdzjvyvufwqrnuafqd.supabase.co';
      
      // Use direct fetch instead of Supabase Functions API
      console.log('[useDiscountCode] Sending discount code validation request');
      const response = await fetch(`${supabaseUrl}/functions/v1/validate-discount-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code: codeToApply })
      });
      
      // Always get the response as text first to properly handle both success and error responses
      const responseText = await response.text();
      console.log('[useDiscountCode] Raw response:', responseText);
      
      // Try to parse the response as JSON
      let responseData;
      try {
        responseData = JSON.parse(responseText);
        console.log('[useDiscountCode] Parsed response data:', responseData);
      } catch (parseError) {
        console.error('[useDiscountCode] Failed to parse response as JSON:', parseError);
        setDiscountError('Invalid response from server');
        return;
      }
      
      // If response is not ok, handle the error
      if (!response.ok) {
        const errorMessage = responseData?.error || 'Invalid code';
        console.error('[useDiscountCode] Error response:', errorMessage);
        setDiscountError(errorMessage);
        return;
      }
      
      // --- Success Case --- 
      if (responseData && responseData.code && typeof responseData.percentage_discount === 'number') {
        console.log("[useDiscountCode] code validated successfully:", responseData);
        setAppliedDiscount({
          code: responseData.code,
          percentage_discount: responseData.percentage_discount,
          applies_to: responseData.applies_to || 'total'
        });
        setDiscountCodeInput(''); // Clear input on success
      } else {
        // Malformed success response
        console.warn("[useDiscountCode] Discount validation returned unexpected data:", responseData);
        setDiscountError('Invalid response from validation service');
      }
    } catch (error) {
      // This now only catches network errors, not HTTP error responses
      console.error('[useDiscountCode] Network error during discount validation:', error);
      setDiscountError(error instanceof Error ? error.message : 'Failed to connect to validation service');
    } finally {
      setIsApplyingDiscount(false);
    }
  }, [discountCodeInput]);

  const handleRemoveDiscount = useCallback(() => {
    console.log('[useDiscountCode] Removing applied discount');
    setAppliedDiscount(null);
    setDiscountCodeInput('');
    setDiscountError(null);
  }, []);

  return {
    discountCodeInput,
    setDiscountCodeInput,
    appliedDiscount,
    discountError,
    isApplyingDiscount,
    handleApplyDiscount,
    handleRemoveDiscount
  };
} 