ALTER TABLE users
  ADD COLUMN cat_name VARCHAR(40) NOT NULL DEFAULT 'Mochi' AFTER cat_appearance_key,
  ADD COLUMN onboarding_completed_at DATETIME NULL AFTER cat_name;

-- statement-breakpoint
UPDATE users
SET onboarding_completed_at = CURRENT_TIMESTAMP
WHERE onboarding_completed_at IS NULL;
