import type { FloorPlacement, FloorPlacementInput } from '@capstone/shared';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { getDatabasePool } from '../db/pool.js';

export interface OwnedDecoration {
  instanceId: number;
  productId: string;
  selectedVariantId: string;
}

interface OwnedDecorationRow extends RowDataPacket {
  instance_id: number | string;
  product_id: string;
  selected_variant_id: string;
}

interface PlacementRow extends OwnedDecorationRow {
  grid_u: number | string;
  grid_v: number | string;
}

export class RoomRepository {
  constructor(private readonly pool: Pool = getDatabasePool()) {}

  async floorLayout(userId: number): Promise<FloorPlacement[]> {
    const [rows] = await this.pool.execute<PlacementRow[]>(
      `SELECT p.inventory_instance_id AS instance_id, p.grid_u, p.grid_v,
              i.product_id, i.selected_variant_id
       FROM room_floor_placements p
       JOIN user_decoration_inventory i
         ON i.instance_id = p.inventory_instance_id AND i.user_id = p.user_id
       WHERE p.user_id = ?
       ORDER BY p.inventory_instance_id`, [userId],
    );
    return rows.map(toPlacement);
  }

  async replaceFloorLayout(
    userId: number,
    placements: FloorPlacementInput[],
    validate: (owned: OwnedDecoration[]) => void,
  ): Promise<void> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        `INSERT INTO user_room_layouts (user_id) VALUES (?)
         ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)`, [userId],
      );
      await connection.execute('SELECT user_id FROM user_room_layouts WHERE user_id = ? FOR UPDATE', [userId]);
      let owned: OwnedDecoration[] = [];
      if (placements.length > 0) {
        const placeholders = placements.map(() => '?').join(', ');
        const [rows] = await connection.execute<OwnedDecorationRow[]>(
          `SELECT instance_id, product_id, selected_variant_id
           FROM user_decoration_inventory
           WHERE user_id = ? AND instance_id IN (${placeholders})
           FOR UPDATE`,
          [userId, ...placements.map(({ inventoryInstanceId }) => inventoryInstanceId)],
        );
        owned = rows.map((row) => ({
          instanceId: Number(row.instance_id),
          productId: row.product_id,
          selectedVariantId: row.selected_variant_id,
        }));
      }
      validate(owned);
      await connection.execute('DELETE FROM room_floor_placements WHERE user_id = ?', [userId]);
      for (const placement of placements) {
        await connection.execute(
          `INSERT INTO room_floor_placements (inventory_instance_id, user_id, grid_u, grid_v)
           VALUES (?, ?, ?, ?)`,
          [placement.inventoryInstanceId, userId, placement.gridU, placement.gridV],
        );
      }
      await connection.execute(
        'UPDATE user_room_layouts SET updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [userId],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

function toPlacement(row: PlacementRow): FloorPlacement {
  return {
    inventoryInstanceId: Number(row.instance_id),
    productId: row.product_id,
    selectedVariantId: row.selected_variant_id,
    gridU: Number(row.grid_u),
    gridV: Number(row.grid_v),
  };
}
