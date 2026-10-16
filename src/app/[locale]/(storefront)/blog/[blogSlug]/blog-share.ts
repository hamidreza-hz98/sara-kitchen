/** Encode a canonical article URL once at the social-provider boundary. */
export function createBlogShareLinks(canonicalUrl: string, title: string) {
  const encodedUrl = encodeURIComponent(canonicalUrl);
  const encodedText = encodeURIComponent(`${title} ${canonicalUrl}`);
  return {
    whatsapp: `https://api.whatsapp.com/send?text=${encodedText}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent(title)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
  } as const;
}
