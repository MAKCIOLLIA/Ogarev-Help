export type UserRole = 'student' | 'parent' | 'child' | 'admin';
export type UserStatus = 'pending' | 'active' | 'rejected';
export type ConsultationStatus = 'pending_approval' | 'pending_payment' | 'paid' | 'completed' | 'cancelled' | 'searching';
export type PaymentStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  id: string;
  email: string;
  password?: string;
  role: UserRole;
  bio?: string;
  full_name: string;
  status: UserStatus;
  parent_id?: string;
  created_at?: string;
  profile_photo_path?: string | null;
  balance?: number;
  pending_balance?: number;
  average_rating?: number;
  total_ratings?: number;
}

export interface StudentProfile {
  user_id: string;
  grade_average: number;
  grade_book_photo?: string;
  video_greeting?: string;
  bio?: string;
  average_rating: number;
  total_ratings: number;
  recommendation_rating: number;
  skills?: string;
  anti_skills?: string;
}

export interface Child {
  id: string;
  parent_id: string;
  child_user_id: string;
  age: number;
  grade: number;
  full_name: string;
}

export interface AvailabilitySlot {
  id: string;
  student_id: string;
  day_of_week: number;
  date: string;
  start_time: string;
  end_time: string;
  is_booked: boolean;
}

export interface Consultation {
  id: string;
  student_id: string;
  child_id: string;
  parent_id?: string;
  date: string;
  start_time: string;
  duration: number;
  price: number;
  description?: string;
  status: ConsultationStatus;
  rating?: number;
  rating_comment?: string;
  private_notes?: string;
  commission_pct?: number;
  video_link?: string;
  materials_text?: string;
  is_rescheduling?: boolean;
  proposed_new_date?: string;
  proposed_new_time?: string;
  is_immediate?: boolean;
  created_at: string;
}

export interface ConsultationFile {
  id: string;
  consultation_id: string;
  file_path: string;
  display_name: string;
  uploaded_at: string;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  content: string;
  type: string;
  related_id?: string;
  read: boolean;
  created_at: string;
}

export interface PaymentRequest {
  id: string;
  consultation_id: string;
  parent_id?: string;
  status: PaymentStatus;
  created_at: string;
}

export interface Specialization {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface StudentSpecialization {
  id: string;
  student_id: string;
  specialization_id: string;
  specialization?: Specialization;
}

export interface Contact {
  id: string;
  full_name: string;
  role: UserRole;
  unreadCount: number;
  email?: string;
}