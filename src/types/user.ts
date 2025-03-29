/**
 * Enum for user status that matches the PostgreSQL enum 'user_status_enum'
 */
export enum UserStatus {
  NO_USER = 'no_user',
  IN_APPLICATION_FORM = 'in_application_form',
  APPLICATION_SENT_PENDING = 'application_sent_pending',
  APPLICATION_SENT_REJECTED = 'application_sent_rejected',
  APPLICATION_APPROVED = 'application_approved',
  WHITELISTED = 'whitelisted',
  ADMIN = 'admin'
}

/**
 * User status information from the user_status table
 */
export interface UserStatusInfo {
  user_id: string;
  status: UserStatus;
  welcome_screen_seen: boolean;
  whitelist_signup_completed: boolean;
  is_super_admin: boolean;
  updated_at: string;
}

/**
 * Type guard to check if a string is a valid UserStatus
 */
export function isUserStatus(status: string): status is UserStatus {
  return Object.values(UserStatus).includes(status as UserStatus);
} 