CREATE TABLE IF NOT EXISTS user_decoration_inventory (
  instance_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  product_id VARCHAR(100) NOT NULL,
  selected_variant_id VARCHAR(100) NOT NULL,
  purchase_transaction_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_decoration_inventory_purchase (purchase_transaction_id),
  UNIQUE KEY uq_decoration_inventory_instance_user (instance_id, user_id),
  INDEX idx_decoration_inventory_user (user_id, created_at),
  CONSTRAINT fk_decoration_inventory_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_decoration_inventory_purchase FOREIGN KEY (purchase_transaction_id, user_id)
    REFERENCES coin_transactions(id, user_id) ON DELETE CASCADE
) ENGINE=InnoDB;
