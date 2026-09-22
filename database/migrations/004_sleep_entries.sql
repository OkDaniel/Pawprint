CREATE TABLE IF NOT EXISTS sleep_entries (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  logical_date DATE NOT NULL,
  bedtime TIME NULL,
  wake_time TIME NULL,
  duration_minutes SMALLINT UNSIGNED NULL,
  quality_score TINYINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sleep_user_logical_date (user_id, logical_date),
  CONSTRAINT chk_sleep_duration CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 1 AND 1440),
  CONSTRAINT chk_sleep_quality CHECK (quality_score IS NULL OR quality_score BETWEEN 1 AND 5),
  CONSTRAINT chk_sleep_has_measurement CHECK (
    bedtime IS NOT NULL OR wake_time IS NOT NULL OR duration_minutes IS NOT NULL OR quality_score IS NOT NULL
  ),
  CONSTRAINT fk_sleep_entries_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
