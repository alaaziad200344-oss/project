export type AppointmentStatus = "pending" | "confirmed" | "completed" | "cancelled";

export interface Doctor {
  id: string;
  name: string;
  specialty: string | null;
  phone: string | null;
  email: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Patient {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  gender: "male" | "female" | "other" | null;
  birth_date: string | null;
  address: string | null;
  medical_history: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  appointment_date: string;
  status: AppointmentStatus;
  notes: string | null;
  source: "manual" | "ai";
  created_at: string;
  updated_at: string;
  patients?: Patient | null;
  doctors?: Doctor | null;
}

export interface AppointmentService {
  id: string;
  appointment_id: string;
  service_id: string;
  services?: Service | null;
}

export interface Visit {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  appointment_id: string | null;
  visit_date: string;
  diagnosis: string | null;
  treatment: string | null;
  prescription: string | null;
  cost: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  patients?: Patient | null;
  doctors?: Doctor | null;
}

export interface AiLog {
  id: string;
  action: string;
  payload: unknown;
  result: unknown;
  status: "success" | "error";
  message: string | null;
  created_at: string;
}

export interface Setting {
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
}
