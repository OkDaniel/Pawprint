import type { CSSProperties, ReactNode } from 'react';
import { ROOM_SCENE_SIZE, type FloorPlacement } from '@capstone/shared';
import room5 from '../../assets/room/room5.png';
import { floorDecorationAsset } from '../decorations/assetManifest';
import { CAT_SCENE_CENTER, sceneObjects } from './sceneModel';
import styles from './RoomScene.module.css';

export function RoomScene({ placements = [], cat, children, selectedId, onSelect, selectionLabels, testId = 'cat-room-scene' }: {
  placements?: readonly FloorPlacement[]; cat: ReactNode; children?: ReactNode;
  selectedId?: number | null; onSelect?(id: number): void; testId?: string;
  selectionLabels?: ReadonlyMap<number, string>;
}) {
  return <div className={styles.scene} data-testid={testId}>
    <img className={styles.background} src={room5} alt="" aria-hidden="true" data-testid="room-background" />
    <div className={styles.objects}>
      {sceneObjects(placements).map((object, index) => object.kind === 'cat'
        ? <div key="cat" className={styles.cat} data-scene-object="cat" data-depth={object.depth}
          style={{ left: percent(CAT_SCENE_CENTER[0] - 48), top: percent(CAT_SCENE_CENTER[1] - 48), zIndex: index + 1 }}>{cat}</div>
        : <div key={object.key} className={`${styles.decoration} ${selectedId === object.key ? styles.selected : ''}`}
          data-scene-object={object.key} data-depth={object.depth} data-variant={object.variant.id}
          style={{ left: percent(object.x), top: percent(object.y), width: percent(object.variant.width), height: percent(object.variant.height), zIndex: index + 1 } as CSSProperties}>
          <img src={floorDecorationAsset(object.product.id, object.variant.id)} alt={object.product.displayName}
            onError={event => { event.currentTarget.style.visibility = 'hidden'; }} />
          {onSelect && <button type="button" className={styles.hitTarget} aria-label={`Select ${selectionLabels?.get(object.key) ?? object.product.displayName}`}
            onClick={() => onSelect(object.key)} aria-pressed={selectedId === object.key} />}
        </div>)}
    </div>
    {children}
  </div>;
}

function percent(value: number) { return `${value / ROOM_SCENE_SIZE * 100}%`; }
