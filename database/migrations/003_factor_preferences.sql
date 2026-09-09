CREATE TABLE IF NOT EXISTS user_factor_preferences (
  user_id BIGINT UNSIGNED NOT NULL,
  factor_id BIGINT UNSIGNED NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, factor_id),
  CONSTRAINT fk_user_factor_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_factor_preferences_factor FOREIGN KEY (factor_id) REFERENCES factors(id) ON DELETE CASCADE
) ENGINE=InnoDB;
