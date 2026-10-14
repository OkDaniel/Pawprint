ALTER TABLE check_ins
  ADD COLUMN IF NOT EXISTS client_request_id CHAR(36) NULL AFTER note,
  ADD COLUMN IF NOT EXISTS create_request_hash BINARY(32) NULL AFTER client_request_id;

-- statement-breakpoint
ALTER TABLE check_ins
  ADD CONSTRAINT IF NOT EXISTS chk_check_ins_create_request_pair CHECK (
    (client_request_id IS NULL AND create_request_hash IS NULL)
    OR (client_request_id IS NOT NULL AND create_request_hash IS NOT NULL)
  ),
  ADD UNIQUE KEY IF NOT EXISTS uq_check_ins_user_client_request (user_id, client_request_id);
