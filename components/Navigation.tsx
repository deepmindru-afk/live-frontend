import Link from 'next/link';
import styles from '../styles/navigation.module.scss';

export default function Navigation() {
  return (
    <nav className={styles.navigation}>
      <div className={styles.container}>
        <Link href="/" className={styles.logo}>
          Meet: mate
        </Link>
        <div className={styles.links}>
          <Link href="/login" className={styles.link}>
            Member Login
          </Link>
          <Link href="/InstructorLogin" className={styles.link}>
            Instructor Login
          </Link>
        </div>
      </div>
    </nav>
  );
}
