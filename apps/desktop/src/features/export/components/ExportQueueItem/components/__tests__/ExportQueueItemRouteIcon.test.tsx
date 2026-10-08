import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExportQueueItemRouteIcon } from "../ExportQueueItemRouteIcon";

describe("ExportQueueItemRouteIcon", () => {
  it.each([
    ["fast", "lucide-film"],
    ["optimized", "lucide-film"],
    ["gif", "lucide-image"],
  ] as const)("uses the %s route icon", (route, iconClass) => {
    const { container } = render(<ExportQueueItemRouteIcon route={route} />);

    expect(container.querySelector(`svg.${iconClass}`)).toBeInTheDocument();
  });
});
