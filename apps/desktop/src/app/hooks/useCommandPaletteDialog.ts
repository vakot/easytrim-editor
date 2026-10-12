import { useAppDialog } from "@/app/hooks/useAppDialog";

function useCommandPaletteDialog() {
  return useAppDialog("command-palette");
}

export { useCommandPaletteDialog };
