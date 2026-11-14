import styles from './Screen.module.css'

/** Placeholder for the tabs whose screens arrive in later iterations. */
export function ComingSoonScreen({ title }: { title: string }) {
  return (
    <section className={styles.screen}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.empty}>Próximamente. Esta pantalla llega en una próxima versión.</p>
    </section>
  )
}
