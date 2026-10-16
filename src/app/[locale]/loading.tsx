import { RouteLoading } from "@/components/feedback";
import Link from "next/link";

export default function Loading() {
  return (
    <>
      <RouteLoading />
      <noscript>
        <p style={{ padding: "1rem", textAlign: "center" }}>
          <Link href="/api/contact-submissions/form">
            Contact form / Formulário de contacto / فرم تماس
          </Link>
        </p>
      </noscript>
    </>
  );
}
