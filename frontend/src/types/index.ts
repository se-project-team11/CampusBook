export type ResourceType = 'STUDY_ROOM' | 'LAB' | 'SPORTS' | 'SEMINAR';

export type BookingState = 'RESERVED' | 'CONFIRMED' | 'CHECKED_IN' | 'NO_SHOW' | 'RELEASED';

export type SlotStatus = 'AVAILABLE' | 'BOOKED';

export type UserRole =
  | 'ROLE_STUDENT'
  | 'ROLE_FACULTY'
  | 'ROLE_DEPT_ADMIN'
  | 'ROLE_FACILITIES';

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  capacity: number;
  location: string;
  amenities: string[];
}

export interface AvailabilitySlot {
  slot_start: string;
  slot_end: string;
  status: SlotStatus;
  waitlist_count?: number;
}

export interface AvailabilityResponse {
  resource_id: string;
  date: string;
  slots: AvailabilitySlot[];
}

export interface Booking {
  booking_id: string;
  resource_id: string;
  state: BookingState;
  qr_token: string;
  expires_at: string | null;
  slot_start: string;
  slot_end: string;
  notes: string;
  requires_approval: boolean;
  user_email?: string;
}

export interface ActiveBookingOverview {
  booking_id: string;
  resource_id: string;
  resource_name: string;
  resource_location: string;
  resource_type: string;
  slot_start: string;
  slot_end: string;
  state: BookingState;
  user_email: string;
}

export interface UserBookingsResponse {
  bookings: Booking[];
}

export interface AuthUser {
  id: string;
  role: UserRole;
  email: string;
  token: string;
}

export interface ResourceFilter {
  type?: ResourceType | 'all';
  capacity?: number;
  location?: string;
  date?: string;
}

export interface WsBookingEvent {
  event: 'BookingCreated' | 'SlotReleased' | 'CheckInCompleted' | 'NoShowTriggered';
  resource_id: string;
  slot_start?: string;
  booking_id?: string;
  promoted_user_id?: string;
  timestamp?: string;
}

export interface WaitlistEntry {
  waitlist_id: string;
  resource_id: string;
  slot_start: string;
  slot_end: string;
  position: number;
}
