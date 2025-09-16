import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";
import Navigation from "../../components/Navigation";

export default function Home() {
  return (
    <>
      <Navigation />
      <div className={styles.page}>
        <main className={styles.main}>
          <div className={styles.hero}>
            <h1 className={styles.title}>
              <span className={styles.meet}>Meet:</span>
              <span className={styles.mate}>
                <span className={styles.stylizedM}>m</span>ate
              </span>
            </h1>
            <p className={styles.description}>
              Connect, learn, and grow together in our virtual meeting platform
            </p>
          </div>

          <div className={styles.ctas}>
            <Link href="/login" className={styles.primary}>
              <span>Member Login</span>
              <span className={styles.subtitle}>Join with invitation code</span>
            </Link>
            <Link href="/InstructorLogin" className={styles.secondary}>
              <span>Instructor Login</span>
              <span className={styles.subtitle}>Access instructor portal</span>
            </Link>
          </div>
        </main>
      </div>
    </>
  );
}
