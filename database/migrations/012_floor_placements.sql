CREATE TABLE IF NOT EXISTS room_floor_placements (
  inventory_instance_id BIGINT UNSIGNED PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  grid_u TINYINT UNSIGNED NOT NULL,
  grid_v TINYINT UNSIGNED NOT NULL,
  CONSTRAINT chk_room_floor_grid_u CHECK (grid_u BETWEEN 0 AND 16),
  CONSTRAINT chk_room_floor_grid_v CHECK (grid_v BETWEEN 0 AND 16),
  CONSTRAINT fk_room_floor_layout FOREIGN KEY (user_id) REFERENCES user_room_layouts(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_room_floor_inventory_owner FOREIGN KEY (inventory_instance_id, user_id)
    REFERENCES user_decoration_inventory(instance_id, user_id) ON DELETE CASCADE
) ENGINE=InnoDB;
