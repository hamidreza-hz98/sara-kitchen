import { notFound } from "next/navigation";

import { hasAdminPermission } from "@/constants/admin-access";
import { requireAdminPage } from "@/server/auth/page-guards";

import { SettingsSectionEditor } from "./settings-section-editor";
import { isSettingsPageSection, SETTINGS_PAGE_REGISTRY } from "../settings-section-registry";

type PageProps = { params: Promise<{ section: string }> };

export default async function SettingsSectionPage({ params }: PageProps) {
  const { section } = await params;
  if (!isSettingsPageSection(section)) notFound();
  const admin = await requireAdminPage("settings:read");
  const permission =
    section === "terms"
      ? "settings:update-security"
      : (["homepage", "about", "faq"] as const).includes(section as "homepage" | "about" | "faq")
        ? "settings:update-content"
        : "settings:update-operations";
  const canEdit = hasAdminPermission({ role: admin.role, active: true }, permission);
  return <SettingsSectionEditor canEdit={canEdit} definition={SETTINGS_PAGE_REGISTRY[section]} />;
}
