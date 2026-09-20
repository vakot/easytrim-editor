import { openUrl } from "@tauri-apps/plugin-opener";

async function openExternalUrl(url: string): Promise<void> {
  try {
    await openUrl(url);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export { openExternalUrl };
