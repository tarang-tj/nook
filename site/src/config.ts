/**
 * Paste a Google Form link here. Leave it empty until the form exists.
 * The form should be set so anyone with the link can respond.
 * Submissions stay in Google Forms. Do not commit anyone's answers.
 */
export const GOOGLE_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLScxBBiMzPYah7h4blyUXlNx8SOCa6cmxgfghsGNTfU6qBu8TA/viewform";

export function googleFormEmbed(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  const host = parsed.hostname;
  if (host !== "docs.google.com" && host !== "forms.gle") return null;
  if (host === "docs.google.com" && !parsed.searchParams.has("embedded")) {
    parsed.searchParams.set("embedded", "true");
  }
  return parsed.toString();
}
