CREATE TABLE IF NOT EXISTS user_wallets (
  user_id BIGINT UNSIGNED PRIMARY KEY,
  coin_balance BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_wallets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS coin_transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  amount BIGINT NOT NULL,
  transaction_type VARCHAR(32) NOT NULL,
  idempotency_key VARCHAR(100) NOT NULL,
  logical_date DATE NULL,
  product_id VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_coin_transactions_user_idempotency (user_id, idempotency_key),
  UNIQUE KEY uq_coin_transactions_daily_reward (user_id, transaction_type, logical_date),
  UNIQUE KEY uq_coin_transactions_id_user (id, user_id),
  INDEX idx_coin_transactions_user_created (user_id, created_at),
  CONSTRAINT chk_coin_transaction_type CHECK (
    transaction_type IN ('DAILY_CHECKIN_REWARD', 'PURCHASE', 'DEV_GRANT')
  ),
  CONSTRAINT chk_coin_transaction_shape CHECK (
    (transaction_type = 'DAILY_CHECKIN_REWARD' AND amount = 1 AND logical_date IS NOT NULL AND product_id IS NULL)
    OR (transaction_type = 'PURCHASE' AND amount < 0 AND logical_date IS NULL AND product_id IS NOT NULL)
    OR (transaction_type = 'DEV_GRANT' AND amount > 0 AND logical_date IS NULL AND product_id IS NULL)
  ),
  CONSTRAINT fk_coin_transactions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- statement-breakpoint
INSERT INTO user_wallets (user_id, coin_balance)
SELECT id, 0 FROM users
ON DUPLICATE KEY UPDATE user_id = VALUES(user_id);
