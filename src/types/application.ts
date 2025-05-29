export interface ApplicationQuestion {
  id: string;
  order_number: number;
  text: string;
  type: 'text' | 'radio' | 'date' | 'email' | 'tel' | 'file' | 'textarea' | 'password' | 'checkbox' | 'markdown_text' | 'arrival_date_selector';
  options?: string[] | null;
  required?: boolean | null;
  section: 'intro' | 'personal' | 'stay' | 'philosophy' | string;
  created_at: string;
  updated_at: string;
  file_storage_bucket?: string;

  visibility_rules?: VisibilityRules | null;
}

export interface ApplicationSection {
  id: string;
  title: string;
  description?: string;
  order: number;
}

export interface VisibilityRule {
  question_id: string;
  answer: any;
  operator?: 'equals' | 'not_equals' | 'contains' | 'not_contains';
}

export interface VisibilityRules {
  condition?: 'AND' | 'OR';
  rules?: VisibilityRule[];
  visible?: boolean;
}