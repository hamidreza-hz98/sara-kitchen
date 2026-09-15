"use client";

import { useEffect } from "react";

import styles from "./fallback.module.css";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" dir="ltr">
      <body>
        <main className={styles.page}>
          <section aria-labelledby="global-error-title" className={styles.panel} role="alert">
            <p className={styles.code}>Sara Kitchen</p>
            <h1 className={styles.title} id="global-error-title">
              Something went wrong
            </h1>
            <p className={styles.description}>
              The application could not recover this screen. Your saved data is safe; please try
              again.
            </p>
            <button className={styles.action} type="button" onClick={reset}>
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
