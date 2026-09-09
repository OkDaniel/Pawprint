import styles from './HomePage.module.css';
import { Link } from 'react-router-dom';
import checkInHeart from '../../assets/ui/check-in-heart.png';
import { CheckInPixelLabel } from '../../components/PixelGlyph';

export function HomePage() {
  return (
    <section className={styles.home!} aria-labelledby="cat-room-title">
      <div className={styles.leftActions!}>
        <Link className={styles.checkIn!} to="/app/check-in">
          <img src={checkInHeart} alt="" aria-hidden="true" />
          <span className={styles.accessibleLabel!}>Check In</span>
          <CheckInPixelLabel />
        </Link>
      </div>
      <div className={styles.room!}>
        {/* TODO: Cat-room art and animation are deferred. */}
        <h1 id="cat-room-title">Cat Room</h1>
      </div>
      <div className={styles.rightSpace!} aria-hidden="true" />
    </section>
  );
}
