import { type ReactNode, useLayoutEffect } from "react";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectLayoutDensity } from "@/app/store/slices/preferences-slice";

function LayoutDensityProvider({ children }: { children: ReactNode }) {
  const layoutDensity = useAppSelector(selectLayoutDensity);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.layoutDensity = layoutDensity;

    return () => {
      delete root.dataset.layoutDensity;
    };
  }, [layoutDensity]);

  return children;
}

export { LayoutDensityProvider };
