ALTER TABLE users
  ADD COLUMN cat_appearance_key VARCHAR(32) NOT NULL DEFAULT 'mochi-classic' AFTER password_hash,
  ADD CONSTRAINT chk_users_cat_appearance CHECK (
    cat_appearance_key IN ('mochi-classic', 'mochi-grey', 'mochi-orange', 'mochi-white')
  );
