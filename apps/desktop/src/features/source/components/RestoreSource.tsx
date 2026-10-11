import { cloneElement, type MouseEventHandler, type ReactElement } from "react";

import { useAppDispatch } from "@/app/store/redux-hooks";
import { restoreSourceFileRequested } from "@/app/store/thunks/source-media-thunks";

type ActionElement = ReactElement<{
  disabled?: boolean;
  onClick?: MouseEventHandler;
  onSelect?: (event: Event) => void;
}>;

function RestoreSource({
  children,
  event = "select",
  itemId,
  source,
  sourcePath,
}: {
  children: ActionElement;
  event?: "click" | "select";
  itemId?: string;
  source?: {
    id: string;
    sourceAvailability: "available" | "deleted" | "missing";
    sourcePath: string;
  };
  sourcePath?: string;
}) {
  const dispatch = useAppDispatch();
  const targetId = source?.id ?? itemId;
  const targetPath = source?.sourcePath ?? sourcePath;

  if (!targetPath || (source && source.sourceAvailability !== "deleted")) return null;

  const restore = () => {
    void dispatch(
      restoreSourceFileRequested({
        ...(targetId ? { itemId: targetId } : {}),
        sourcePath: targetPath,
      }),
    );
  };

  if (event === "click") {
    return cloneElement(children, {
      onClick: (clickEvent) => {
        children.props.onClick?.(clickEvent);
        if (!clickEvent.defaultPrevented) restore();
      },
    });
  }

  return cloneElement(children, {
    onSelect: (selectEvent: Event) => {
      children.props.onSelect?.(selectEvent);
      if (!selectEvent.defaultPrevented) restore();
    },
  });
}

export { RestoreSource };
