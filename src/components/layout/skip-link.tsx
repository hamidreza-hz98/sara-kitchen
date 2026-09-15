"use client";

import type { MouseEvent } from "react";

import styles from "./storefront-shell.module.css";

export function SkipLink({ label, targetId }: { label: string; targetId: string }) {
  const focusTarget = (event: MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById(targetId);

    if (target) {
      event.preventDefault();
      target.focus();
      target.scrollIntoView({ block: "start" });
      window.history.replaceState(null, "", `#${targetId}`);
    }
  };

  return (
    <a className={styles.skipLink} href={`#${targetId}`} onClick={focusTarget}>
      {label}
    </a>
  );
}
