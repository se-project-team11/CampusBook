import axios, { AxiosError } from 'axios';
import type { AxiosInstance } from 'axios';
import type { AvailabilityResponse, Booking, Resource, UserBookingsResponse } from '../types';

const authHttp = axios.create();

// Maps login page account keys → emails that trigger the right role on the backend
const ACCOUNT_EMAILS: Record<string, string> = {
  student:  'student@campus.edu',
  faculty:  'faculty@campus.edu',
  admin:    'admin@campus.edu',
  staff:    'facilities@campus.edu',
};

function createAxiosInstance(): AxiosInstance {
  const instance = axios.create({ baseURL: '/api' });

  instance.interceptors.request.use((config) => {
    const token = localStorage.getItem('campusbook_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  instance.interceptors.response.use(
    (r) => r,
    (error: AxiosError) => {
      if (error.response?.status === 401 || error.response?.status === 403) {
        const isLoginPage = window.location.pathname === '/login';
        if (!isLoginPage) {
          localStorage.removeItem('campusbook_token');
          localStorage.removeItem('campusbook_user');
          window.location.href = '/login';
        }
      }
      return Promise.reject(error);
    },
  );

  return instance;
}

const http = createAxiosInstance();

export const apiClient = {
  auth: {
    login: (account: string) =>
      authHttp.post<{ access_token: string; role: string; email: string; user_id: string }>(
        '/api/auth/login',
        { email: ACCOUNT_EMAILS[account] ?? `${account}@campus.edu`, password: 'secret123' },
      ),
  },

  resources: {
    search: (params?: { type?: string; capacity?: number; location?: string }) =>
      http.get<Resource[]>('/resources', { params }),

    availability: (resourceId: string, date: string) =>
      http.get<AvailabilityResponse>(`/resources/${resourceId}/availability`, {
        params: { date },
      }),
  },

  bookings: {
    create: (resource_id: string, slot_start: string, slot_end: string, notes: string) =>
      http.post<Booking>('/bookings/', { resource_id, slot_start, slot_end, notes }),

    myBookings: () => http.get<UserBookingsResponse>('/bookings/user/me'),

    get: (bookingId: string) => http.get<Booking>(`/bookings/${bookingId}`),

    cancel: (bookingId: string) => http.delete(`/bookings/${bookingId}`),
  },

  checkin: {
    checkin: (qrToken: string) => http.post(`/checkin/${qrToken}`, {}),
  },
};
