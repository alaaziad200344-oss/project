-- Replace the 4 per-action N8N webhook settings with a single unified webhook URL,
-- and add a single API key used by the AI agent edge function.

DELETE FROM settings
WHERE key IN (
  'n8n_register_patient',
  'n8n_book_appointment',
  'n8n_confirm_appointment',
  'n8n_cancel_appointment'
);

INSERT INTO settings (key, value, description) VALUES
  ('n8n_webhook_url', '', 'Unified N8N webhook URL for ALL AI agent events (patient, appointment, confirm, cancel)'),
  ('n8n_api_key', '', 'API key sent in the Authorization header to the unified N8N webhook')
ON CONFLICT (key) DO NOTHING;
