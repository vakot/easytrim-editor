import { ArrowDown, ArrowUp } from "lucide-react";

function getSizeChangePresentation(difference: number) {
  return {
    className:
      difference < 0
        ? "text-green-500"
        : difference > 0
          ? "text-destructive"
          : "text-muted-foreground",
    icon: difference < 0 ? ArrowDown : difference > 0 ? ArrowUp : undefined,
    sign: difference < 0 ? "-" : difference > 0 ? "+" : "",
  };
}

export { getSizeChangePresentation };
