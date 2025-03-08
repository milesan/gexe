export interface Database {
  public: {
    Tables: {
      accommodations: {
        Row: {
          id: string;
          title: string;
          base_price: number;
          type: string;
          capacity: number;
          has_wifi: boolean;
          has_electricity: boolean;
          image_url: string | null;
          is_unlimited: boolean;
          is_fungible: boolean;
          parent_accommodation_id: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          base_price: number;
          type: string;
          capacity: number;
          has_wifi?: boolean;
          has_electricity?: boolean;
          image_url?: string | null;
          is_unlimited?: boolean;
          is_fungible?: boolean;
          parent_accommodation_id?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          base_price?: number;
          type?: string;
          capacity?: number;
          has_wifi?: boolean;
          has_electricity?: boolean;
          image_url?: string | null;
          is_unlimited?: boolean;
          is_fungible?: boolean;
          parent_accommodation_id?: string | null;
        };
      };
      bookings: {
        Row: {
          id: string;
          user_id: string;
          accommodation_id: string;
          start_date: string;
          end_date: string;
          status: string;
          created_at: string;
          updated_at: string;
          total_price: number;
          stripe_session_id: string | null;
          stripe_payment_intent_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          accommodation_id: string;
          start_date: string;
          end_date: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
          total_price: number;
          stripe_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          accommodation_id?: string;
          start_date?: string;
          end_date?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
          total_price?: number;
          stripe_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
        };
      };
      calendar_config: {
        Row: {
          id: string;
          check_in_day: number;
          check_out_day: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          check_in_day: number;
          check_out_day: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          check_in_day?: number;
          check_out_day?: number;
          created_at?: string;
        };
      };
      week_customizations: {
        Row: {
          id: string;
          start_date: string;
          end_date: string;
          name: string | null;
          status: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          start_date: string;
          end_date: string;
          name?: string | null;
          status?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          start_date?: string;
          end_date?: string;
          name?: string | null;
          status?: string;
          created_by?: string | null;
          created_at?: string;
        };
      };
      flexible_checkins: {
        Row: {
          id: string;
          week_customization_id: string;
          allowed_checkin_date: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          week_customization_id: string;
          allowed_checkin_date: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          week_customization_id?: string;
          allowed_checkin_date?: string;
          created_by?: string | null;
          created_at?: string;
        };
      };
      availability: {
        Row: {
          id: string;
          accommodation_id: string;
          date: string;
          status: 'AVAILABLE' | 'HOLD' | 'BOOKED';
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['availability']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['availability']['Insert']>;
      };
      credits: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          description: string;
          booking_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['credits']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['credits']['Insert']>;
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          credits: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
    };
    Functions: {
      get_accommodation_availability: {
        Args: {
          check_in_date: string;
          check_out_date: string;
        };
        Returns: {
          accommodation_id: string;
          title: string;
          is_available: boolean;
          available_capacity: number | null;
        }[];
      };
      create_confirmed_booking: {
        Args: {
          p_accommodation_id: string;
          p_user_id: string;
          p_check_in: string;
          p_check_out: string;
          p_total_price: number;
        };
        Returns: Database['public']['Tables']['bookings']['Row'];
      };
      modify_booking: {
        Args: {
          p_booking_id: string;
          p_new_check_in: string;
          p_new_check_out: string;
        };
        Returns: {
          status: string;
          amount?: number;
          booking?: Database['public']['Tables']['bookings']['Row'];
          credit_added?: number;
        };
      };
      delete_booking: {
        Args: {
          p_booking_id: string;
        };
        Returns: {
          status: string;
          credit_added: number;
        };
      };
    };
  };
}