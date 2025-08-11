export interface Booking {
  id: string;
  check_in: Date;
  check_out: Date;
  status: string;
  guest_email?: string;
  guest_name?: string;
  first_name?: string;
  last_name?: string;
  user_id?: string;
  application_id?: string;
  accommodation_id: string;
  accommodation_title?: string;
  accommodation_item_id?: string;
  item_tag?: string;
}

export interface AccommodationItem {
  id: string;
  accommodation_id: string;
  full_tag: string;
  accommodation_title: string;
  type: string;
  item_id: number;
}

export interface AccommodationRow {
  id: string;
  label: string;
  accommodation_title: string;
  accommodation_id: string;
  item_id?: string;
  is_bed?: boolean;
  bed_number?: number;
  is_assigned?: boolean;
}

export type ViewMode = 'week' | 'month';