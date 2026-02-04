import { readFileSync } from "fs";
import { join } from "path";

let templateCache: string | null = null;

function getTemplate(): string {
  if (!templateCache) {
    const path = join(process.cwd(), "lib", "templates", "invoice.html");
    templateCache = readFileSync(path, "utf-8");
  }
  return templateCache;
}

/**
 * Render invoice HTML from template and data.
 */
export function renderInvoice(
  data: Record<string, unknown>,
  logoDataUri: string
): string {
  const template = getTemplate();
  const merged = { ...data, logoDataUri };

  let html = template;
  for (const [key, value] of Object.entries(merged)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    html = html.replace(placeholder, String(value ?? ""));
  }

  return html;
}
