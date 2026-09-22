import styles from './HomePage.module.css';
import { Link } from 'react-router-dom';
import checkInHeart from '../../assets/ui/check-in-heart.png';
import historyGameboy from '../../assets/ui/history-gameboy.png';
import { CheckInPixelLabel, HistoryPixelLabel } from '../../components/PixelGlyph';
import { CatSprite } from './CatSprite';

export function HomePage() {
  return (
    <section className={styles.home!} aria-labelledby="cat-room-title">
      <div className={styles.leftActions!}>
        <Link className={styles.homeAction!} to="/app/check-in">
          <img src={checkInHeart} alt="" aria-hidden="true" />
          <span className={styles.accessibleLabel!}>Check In</span>
          <CheckInPixelLabel />
        </Link>
      </div>
      <div className={styles.room!}>
        <h1 id="cat-room-title" className={styles.roomTitle!}>Cat Room</h1>
        <div className={styles.scene!} data-testid="cat-room-scene">
          <div className={styles.leftWall!} aria-hidden="true" />
          <div className={styles.rightWall!} aria-hidden="true" />
          <div className={styles.floorEdge!} aria-hidden="true" />
          <div className={styles.floor!} aria-hidden="true" />
          <div className={styles.leftBaseboard!} aria-hidden="true" />
          <div className={styles.rightBaseboard!} aria-hidden="true" />
          {/* Future furniture and cat positions should use this room-relative layer. */}
          <div className={styles.objectLayer!}>
            <div className={styles.catPosition!}>
              <CatSprite />
            </div>
          </div>
        </div>
      </div>
      <div className={styles.rightActions!}>
        <Link className={styles.homeAction!} to="/app/history" data-history-trigger>
          <img src={historyGameboy} alt="" aria-hidden="true" />
          <span className={styles.accessibleLabel!}>History</span>
          <HistoryPixelLabel />
        </Link>
      </div>
    </section>
  );
}
