import Button from "@mui/material/Button";
import Image from "next/image";
import { useTranslations } from "next-intl";

import styles from "./page.module.css";

export default function Home() {
  const translations = useTranslations("storefront.home");

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <Image
          className={styles.logo}
          src="/next.svg"
          alt="Next.js logo"
          width={100}
          height={20}
          priority
        />
        <div className={styles.intro}>
          <p>{translations("eyebrow")}</p>
          <h1>{translations("title")}</h1>
          <p>{translations("description")}</p>
        </div>
        <div className={styles.ctas}>
          <Button className={styles.primary} href="/theme-showcase">
            {translations("showcase")}
          </Button>
        </div>
      </main>
    </div>
  );
}
