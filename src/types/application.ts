export interface ApplicationQuestion {
  id: string;
  order_number: number;
  text: string;
  type: 'text' | 'radio' | 'date' | 'email' | 'tel' | 'file' | 'textarea' | 'password' | 'checkbox';
  options?: string[];
  required: boolean;
  section: 'intro' | 'personal' | 'stay' | 'philosophy' | string;
  section_intro_markdown?: string;
  is_visible?: boolean;
  created_at: string;
  updated_at: string;
  file_storage_bucket?: string;
}

export interface ApplicationSection {
  id: string;
  title: string;
  description?: string;
  order: number;
}