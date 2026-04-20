export interface Resource {
  id: string;
  name: string;
  type: string;
  capacity: number;
  location: string;
  amenities: string[];
}

export interface AvailabilitySlot {
  slot_start: string;
  slot_end: string;
  status: 'AVAILABLE' | 'BOOKED';
}

export interface AvailabilityResponse {
  resource_id: string;
  date: string;
  slots: AvailabilitySlot[];
}

export interface Booking {
  booking_id: string;
  resource_id: string;
  state: string;
  qr_token: string;
  expires_at: string | null;
  slot_start: string;
  slot_end: string;
  notes: string;
}

export interface UserBookingsResponse {
  bookings: Booking[];
}

export interface AuthUser {
  id: string;
  role: string;
  email: string;
  token: string;
}
