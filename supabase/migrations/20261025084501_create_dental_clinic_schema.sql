/*
# Create dental clinic management schema (single-tenant, no auth)

This migration creates the core tables for a simplified dental clinic management system.
The app has no sign-in screen, so all data is intentionally shared and accessible via the
anon key. All policies use `TO anon, authenticated` with `USING (true)` because the data
is intentionally public within the clinic (single-tenant, no auth).

## Tables created
1. `doctors` - clinic dentists (name, specialty, phone, active)
2. `services` - dental services offered with prices (name, description, price, duration_minutes, active)
3. `patients` - patient records (name, phone, email, gender, birth_date, address, notes, medical_history)
4. `appointments` - bookings linking patients, doctors, services (status: pending/confirmed/completed/cancelled)
5. `visits` - records of patient visits with diagnosis and treatment notes
6. `appointment_services` - many-to-many between appointments and services (an appointment can include multiple services)
7. `ai_logs` - logs of AI agent (N8N) interactions for auditability
8. `settings` - key/value table for configurable integration URLs (N8N webhook endpoints)

## Security
- RLS enabled on every table.
- CRUD granted to `anon, authenticated` because this is a no-auth single-tenant clinic app.
- `USING (true)` / `WITH CHECK (true)` is intentional: all clinic data is shared.
*/

-- ============ doctors ============
CREATE TABLE IF NOT EXISTS doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  specialty text,
  phone text,
  email text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON doctors TO anon, authenticated;
DROP POLICY IF EXISTS "anon_select_doctors" ON doctors;
CREATE POLICY "anon_select_doctors" ON doctors FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_doctors" ON doctors;
CREATE POLICY "anon_insert_doctors" ON doctors FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_doctors" ON doctors;
CREATE POLICY "anon_update_doctors" ON doctors FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_doctors" ON doctors;
CREATE POLICY "anon_delete_doctors" ON doctors FOR DELETE TO anon, authenticated USING (true);

-- ============ services ============
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  duration_minutes integer NOT NULL DEFAULT 30,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON services TO anon, authenticated;
DROP POLICY IF EXISTS "anon_select_services" ON services;
CREATE POLICY "anon_select_services" ON services FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_services" ON services;
CREATE POLICY "anon_insert_services" ON services FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_services" ON services;
CREATE POLICY "anon_update_services" ON services FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_services" ON services;
CREATE POLICY "anon_delete_services" ON services FOR DELETE TO anon, authenticated USING (true);

-- ============ patients ============
CREATE TABLE IF NOT EXISTS patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  gender text CHECK (gender IN ('male','female','other')),
  birth_date date,
  address text,
  medical_history text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON patients TO anon, authenticated;
DROP POLICY IF EXISTS "anon_select_patients" ON patients;
CREATE POLICY "anon_select_patients" ON patients FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_patients" ON patients;
CREATE POLICY "anon_insert_patients" ON patients FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_patients" ON patients;
CREATE POLICY "anon_update_patients" ON patients FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_patients" ON patients;
CREATE POLICY "anon_delete_patients" ON patients FOR DELETE TO anon, authenticated USING (true);

-- ============ appointments ============
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES doctors(id) ON DELETE SET NULL,
  appointment_date timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','completed','cancelled')),
  notes text,
  source text DEFAULT 'manual' CHECK (source IN ('manual','ai')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON appointments TO anon, authenticated;
DROP POLICY IF EXISTS "anon_select_appointments" ON appointments;
CREATE POLICY "anon_select_appointments" ON appointments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_appointments" ON appointments;
CREATE POLICY "anon_insert_appointments" ON appointments FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_appointments" ON appointments;
CREATE POLICY "anon_update_appointments" ON appointments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_appointments" ON appointments;
CREATE POLICY "anon_delete_appointments" ON appointments FOR DELETE TO anon, authenticated USING (true);

-- ============ appointment_services ============
CREATE TABLE IF NOT EXISTS appointment_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE appointment_services ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON appointment_services TO anon, authenticated;
DROP POLICY IF EXISTS "anon_select_appointment_services" ON appointment_services;
CREATE POLICY "anon_select_appointment_services" ON appointment_services FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_appointment_services" ON appointment_services;
CREATE POLICY "anon_insert_appointment_services" ON appointment_services FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_appointment_services" ON appointment_services;
CREATE POLICY "anon_update_appointment_services" ON appointment_services FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_appointment_services" ON appointment_services;
CREATE POLICY "anon_delete_appointment_services" ON appointment_services FOR DELETE TO anon, authenticated USING (true);

-- ============ visits ============
CREATE TABLE IF NOT EXISTS visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES doctors(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  visit_date timestamptz NOT NULL DEFAULT now(),
  diagnosis text,
  treatment text,
  prescription text,
  cost numeric(10,2) DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON visits TO anon, authenticated;
DROP POLICY IF EXISTS "anon_select_visits" ON visits;
CREATE POLICY "anon_select_visits" ON visits FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_visits" ON visits;
CREATE POLICY "anon_insert_visits" ON visits FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_visits" ON visits;
CREATE POLICY "anon_update_visits" ON visits FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_visits" ON visits;
CREATE POLICY "anon_delete_visits" ON visits FOR DELETE TO anon, authenticated USING (true);

-- ============ ai_logs ============
CREATE TABLE IF NOT EXISTS ai_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  payload jsonb,
  result jsonb,
  status text DEFAULT 'success' CHECK (status IN ('success','error')),
  message text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE ai_logs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_logs TO anon, authenticated;
DROP POLICY IF EXISTS "anon_select_ai_logs" ON ai_logs;
CREATE POLICY "anon_select_ai_logs" ON ai_logs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_ai_logs" ON ai_logs;
CREATE POLICY "anon_insert_ai_logs" ON ai_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_ai_logs" ON ai_logs;
CREATE POLICY "anon_update_ai_logs" ON ai_logs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_ai_logs" ON ai_logs;
CREATE POLICY "anon_delete_ai_logs" ON ai_logs FOR DELETE TO anon, authenticated USING (true);

-- ============ settings ============
CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON settings TO anon, authenticated;
DROP POLICY IF EXISTS "anon_select_settings" ON settings;
CREATE POLICY "anon_select_settings" ON settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_settings" ON settings;
CREATE POLICY "anon_insert_settings" ON settings FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_settings" ON settings;
CREATE POLICY "anon_update_settings" ON settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_settings" ON settings;
CREATE POLICY "anon_delete_settings" ON settings FOR DELETE TO anon, authenticated USING (true);

-- ============ indexes ============
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_doctor ON visits(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointment_services_appt ON appointment_services(appointment_id);

-- ============ updated_at triggers ============
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_doctors_updated ON doctors;
CREATE TRIGGER trg_doctors_updated BEFORE UPDATE ON doctors FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_services_updated ON services;
CREATE TRIGGER trg_services_updated BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_patients_updated ON patients;
CREATE TRIGGER trg_patients_updated BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_appointments_updated ON appointments;
CREATE TRIGGER trg_appointments_updated BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_visits_updated ON visits;
CREATE TRIGGER trg_visits_updated BEFORE UPDATE ON visits FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_settings_updated ON settings;
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============ seed settings (N8N webhook URLs) ============
INSERT INTO settings (key, value, description) VALUES
  ('n8n_register_patient', '', 'Webhook URL for AI agent to register a new patient'),
  ('n8n_book_appointment', '', 'Webhook URL for AI agent to book a new appointment'),
  ('n8n_confirm_appointment', '', 'Webhook URL for AI agent to confirm an appointment'),
  ('n8n_cancel_appointment', '', 'Webhook URL for AI agent to cancel an appointment'),
  ('clinic_name', 'عيادة الأسنان', 'Clinic name shown in the app header'),
  ('clinic_phone', '', 'Clinic contact phone number')
ON CONFLICT (key) DO NOTHING;

-- ============ seed sample data ============
INSERT INTO doctors (name, specialty, phone, email) VALUES
  ('د. أحمد العلي', 'تقويم الأسنان', '0501234567', 'ahmed@clinic.com'),
  ('د. سارة محمد', 'جراحة الفم', '0507654321', 'sara@clinic.com')
ON CONFLICT DO NOTHING;

INSERT INTO services (name, description, price, duration_minutes) VALUES
  ('كشف وتشخيص', 'فحص شامل للأسنان واللثة', 100.00, 30),
  ('تنظيف الأسنان', 'إزالة الجير وتلميع الأسنان', 250.00, 45),
  ('حشو الأسنان', 'حشو تجميلي للأسنان المصابة بالتسوس', 350.00, 60),
  ('خلع الأسنان', 'خلع بسيط أو جراحي', 400.00, 45),
  ('تبييض الأسنان', 'تبييض احترافي للأسنان', 800.00, 60),
  ('تركيب طربوش', 'تركيب طربوش (تاج) للأسنان', 600.00, 90),
  ('زراعة الأسنان', 'زراعة أسنان كاملة', 2500.00, 120),
  ('تقويم الأسنان', 'تقويم معدني أو شفاف', 5000.00, 60)
ON CONFLICT DO NOTHING;
