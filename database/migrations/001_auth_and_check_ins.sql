CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS sessions (
  session_id VARCHAR(128) NOT NULL PRIMARY KEY,
  expires INT UNSIGNED NOT NULL,
  data MEDIUMTEXT
) ENGINE=InnoDB;

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS check_ins (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  occurred_at DATETIME NOT NULL,
  logical_date DATE NOT NULL,
  note VARCHAR(1000) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_check_ins_user_occurred (user_id, occurred_at),
  INDEX idx_check_ins_user_logical_date (user_id, logical_date),
  CONSTRAINT fk_check_ins_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS check_in_moods (
  check_in_id BIGINT UNSIGNED PRIMARY KEY,
  mood_score TINYINT UNSIGNED NOT NULL,
  CONSTRAINT chk_mood_score CHECK (mood_score BETWEEN 1 AND 5),
  CONSTRAINT fk_check_in_moods_checkin FOREIGN KEY (check_in_id) REFERENCES check_ins(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS check_in_pain (
  check_in_id BIGINT UNSIGNED PRIMARY KEY,
  pain_score TINYINT UNSIGNED NOT NULL,
  CONSTRAINT chk_pain_score CHECK (pain_score BETWEEN 0 AND 10),
  CONSTRAINT fk_check_in_pain_checkin FOREIGN KEY (check_in_id) REFERENCES check_ins(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS factors (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(60) NOT NULL,
  is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_user_id BIGINT UNSIGNED NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_factors_category (category),
  INDEX idx_factors_created_by (created_by_user_id),
  CONSTRAINT fk_factors_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS check_in_factors (
  check_in_id BIGINT UNSIGNED NOT NULL,
  factor_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (check_in_id, factor_id),
  CONSTRAINT fk_check_in_factors_checkin FOREIGN KEY (check_in_id) REFERENCES check_ins(id) ON DELETE CASCADE,
  CONSTRAINT fk_check_in_factors_factor FOREIGN KEY (factor_id) REFERENCES factors(id) ON DELETE CASCADE
) ENGINE=InnoDB;
