/** Allow only safe link protocols in rendered markdown / UI. */
export function isSafeExternalUrl(href: string | undefined | null): boolean {
  if (!href) return false;
  try {
    const u = new URL(href, "https://example.invalid");
    return (
      u.protocol === "http:" ||
      u.protocol === "https:" ||
      u.protocol === "mailto:"
    );
  } catch {
    return false;
  }
}
