import styles from './HomePage.module.css';

export function HomePage() {
  return (
    <section className={styles.home!} aria-labelledby="cat-room-title">
      <div className={styles.room!}>
        {/* TODO: Cat-room art and animation are deferred. */}
        <h1 id="cat-room-title">Cat Room</h1>
      </div>
    </section>
  );
}
