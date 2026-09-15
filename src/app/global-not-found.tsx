import type { Metadata } from "next";
import Link from "next/link";

import { applicationFontVariables } from "@/theme/fonts.server";

import styles from "./fallback.module.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Page not found | Sara Kitchen",
  robots: { index: false, follow: false },
};

export default function GlobalNotFound() {
  return (
    <html className={applicationFontVariables} lang="en" dir="ltr">
      <body>
        <main className={styles.page}>
          <section aria-labelledby="global-not-found-title" className={styles.panel}>
            <p className={styles.code}>404 · Sara Kitchen</p>
            <h1 className={styles.title} id="global-not-found-title">
              Page not found
            </h1>
            <p className={styles.description}>
              The page you requested does not exist or may have moved.
            </p>
            <Link className={styles.action} href="/">
              Return home
            </Link>
          </section>
        </main>
      </body>
    </html>
  );
}
