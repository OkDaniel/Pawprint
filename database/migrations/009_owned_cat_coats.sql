CREATE TABLE IF NOT EXISTS user_cat_coats (
  user_id BIGINT UNSIGNED NOT NULL,
  coat_id VARCHAR(32) NOT NULL,
  acquired_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, coat_id),
  CONSTRAINT chk_user_cat_coats_id CHECK (
    coat_id IN ('mochi-classic', 'mochi-grey', 'mochi-orange', 'mochi-white')
  ),
  CONSTRAINT fk_user_cat_coats_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- statement-breakpoint
INSERT INTO user_cat_coats (user_id, coat_id)
SELECT id,
  CASE
    WHEN cat_appearance_key IN ('mochi-classic', 'mochi-grey', 'mochi-orange', 'mochi-white')
      THEN cat_appearance_key
    ELSE 'mochi-classic'
  END
FROM users
ON DUPLICATE KEY UPDATE user_id = VALUES(user_id);
