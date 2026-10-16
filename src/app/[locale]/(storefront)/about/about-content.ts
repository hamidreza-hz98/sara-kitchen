import type { RichTextDocument } from "@/lib/rich-text";

export type AboutImage = Readonly<{ url: string; alt: string }>;

export type AboutContent = Readonly<{
  eyebrow: string;
  title: string;
  summary: string;
  story: RichTextDocument | null;
  hero: AboutImage | null;
  kitchen: readonly AboutImage[];
  values: readonly Readonly<{
    id: string;
    title: string;
    description: string;
    icon: AboutImage | null;
  }>[];
  sections: readonly Readonly<{
    id: string;
    title: string;
    content: RichTextDocument;
    media: AboutImage | null;
    placement: "start" | "end" | "full";
  }>[];
  team: readonly Readonly<{
    id: string;
    name: string;
    role: string;
    bio: string;
    portrait: AboutImage | null;
  }>[];
  actions: readonly Readonly<{
    id: string;
    label: string;
    href: string;
    newTab: boolean;
    variant: "primary" | "secondary";
  }>[];
  embeddedMedia: Readonly<Record<string, Readonly<{ kind: "image" | "video"; url: string }>>>;
}>;
