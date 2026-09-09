CREATE TABLE IF NOT EXISTS feelings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(100) NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_user_id BIGINT UNSIGNED NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_feelings_created_by (created_by_user_id),
  CONSTRAINT fk_feelings_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS user_feeling_preferences (
  user_id BIGINT UNSIGNED NOT NULL,
  feeling_id BIGINT UNSIGNED NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, feeling_id),
  CONSTRAINT fk_user_feeling_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_feeling_preferences_feeling FOREIGN KEY (feeling_id) REFERENCES feelings(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS check_in_feelings (
  check_in_id BIGINT UNSIGNED NOT NULL,
  feeling_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (check_in_id, feeling_id),
  CONSTRAINT fk_check_in_feelings_checkin FOREIGN KEY (check_in_id) REFERENCES check_ins(id) ON DELETE CASCADE,
  CONSTRAINT fk_check_in_feelings_feeling FOREIGN KEY (feeling_id) REFERENCES feelings(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS symptoms (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(120) NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  category VARCHAR(40) NOT NULL,
  is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_user_id BIGINT UNSIGNED NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_symptoms_category (category),
  INDEX idx_symptoms_created_by (created_by_user_id),
  CONSTRAINT chk_symptom_category CHECK (category IN ('Physical Pain', 'Physical Other', 'Mental', 'Cognitive')),
  CONSTRAINT fk_symptoms_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS user_symptom_preferences (
  user_id BIGINT UNSIGNED NOT NULL,
  symptom_id BIGINT UNSIGNED NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, symptom_id),
  CONSTRAINT fk_user_symptom_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_symptom_preferences_symptom FOREIGN KEY (symptom_id) REFERENCES symptoms(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS symptom_entries (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  check_in_id BIGINT UNSIGNED NOT NULL,
  symptom_id BIGINT UNSIGNED NOT NULL,
  severity TINYINT UNSIGNED NOT NULL,
  UNIQUE KEY uq_checkin_symptom (check_in_id, symptom_id),
  CONSTRAINT chk_symptom_severity CHECK (severity BETWEEN 0 AND 4),
  CONSTRAINT fk_symptom_entries_checkin FOREIGN KEY (check_in_id) REFERENCES check_ins(id) ON DELETE CASCADE,
  CONSTRAINT fk_symptom_entries_symptom FOREIGN KEY (symptom_id) REFERENCES symptoms(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- statement-breakpoint
ALTER TABLE check_in_factors
  ADD COLUMN intensity TINYINT UNSIGNED NULL,
  ADD CONSTRAINT chk_factor_intensity CHECK (intensity BETWEEN 1 AND 3);
