"use client";

import "sonner/dist/styles.css";

import { CircleCheckIcon, InfoIcon, OctagonXIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

import { Spinner } from "@/components/ui/spinner";

const appTopOffset = 90;
const sonnerDefaultOffset = 24;
const exportDropdownToastGap = 8;

const exportDropdownSelector = '[data-export-actions-dropdown][data-state="open"]';
const toasterSelector = "[data-sonner-toaster]";
const visibleToastSelector = '[data-sonner-toast][data-visible="true"][data-mounted="true"]';

function Toaster({ ...props }: ToasterProps) {
  const [theme, setTheme] = useState<ToasterProps["theme"]>(() =>
    document.documentElement.dataset.theme === "dark" ? "dark" : "light",
  );

  const [exportDropdownOffset, setExportDropdownOffset] = useState(0);
  const appliedOffset = useRef(0);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setTheme(root.dataset.theme === "dark" ? "dark" : "light");
    });

    observer.observe(root, { attributeFilter: ["data-theme"], attributes: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let animationFrame: number | undefined;

    const resizeObserver = new ResizeObserver(scheduleMeasure);
    const mutationObserver = new MutationObserver((mutations) => {
      if (mutations.some(isToastPositionMutation)) scheduleMeasure();
    });

    function measurePosition() {
      animationFrame = undefined;
      resizeObserver.disconnect();

      const dropdown = document.querySelector<HTMLElement>(exportDropdownSelector);
      const toaster = document.querySelector<HTMLElement>(toasterSelector);
      if (toaster) resizeObserver.observe(toaster);
      if (dropdown) resizeObserver.observe(dropdown);

      const toastElements = toaster?.querySelectorAll<HTMLElement>(visibleToastSelector) ?? [];
      for (const toastElement of toastElements) resizeObserver.observe(toastElement);

      if (!dropdown || !toaster || toastElements.length === 0) {
        updateOffset(0);
        return;
      }

      const dropdownBounds = dropdown.getBoundingClientRect();
      const toastOffset = appliedOffset.current;
      let requiredOffset = 0;

      for (const toastElement of toastElements) {
        if (toastElement.dataset.removed === "true") continue;

        const toastBounds = toastElement.getBoundingClientRect();
        const overlapsHorizontally =
          toastBounds.left < dropdownBounds.right && toastBounds.right > dropdownBounds.left;

        if (!overlapsHorizontally) continue;

        const defaultToastTop = toastBounds.top - toastOffset;
        const defaultToastBottom = defaultToastTop + toastBounds.height;
        const overlapsVertically =
          defaultToastTop < dropdownBounds.bottom + exportDropdownToastGap &&
          defaultToastBottom > dropdownBounds.top;

        if (overlapsVertically) {
          requiredOffset = Math.max(
            requiredOffset,
            dropdownBounds.bottom + exportDropdownToastGap - defaultToastTop,
          );
        }
      }

      updateOffset(Math.ceil(requiredOffset));
    }

    function scheduleMeasure() {
      if (animationFrame === undefined) animationFrame = requestAnimationFrame(measurePosition);
    }

    function updateOffset(offset: number) {
      if (appliedOffset.current === offset) return;
      appliedOffset.current = offset;
      setExportDropdownOffset(offset);
    }

    function isToastPositionMutation(mutation: MutationRecord) {
      if (mutation.type === "attributes") {
        return (
          mutation.target instanceof Element &&
          mutation.target.matches("[data-export-actions-dropdown], [data-sonner-toast]")
        );
      }

      if (
        mutation.target instanceof Element &&
        (mutation.target.matches(toasterSelector) || mutation.target.closest(toasterSelector))
      ) {
        return true;
      }

      return [...mutation.addedNodes, ...mutation.removedNodes].some(
        (node) =>
          node instanceof Element &&
          (node.matches(`${toasterSelector}, [data-export-actions-dropdown]`) ||
            node.querySelector(`${toasterSelector}, [data-export-actions-dropdown]`)),
      );
    }

    function onToastTransitionEnd(event: TransitionEvent) {
      if (event.target instanceof Element && event.target.matches("[data-sonner-toast]")) {
        scheduleMeasure();
      }
    }

    mutationObserver.observe(document.body, {
      attributeFilter: ["data-state", "data-visible", "data-mounted", "data-removed"],
      attributes: true,
      childList: true,
      subtree: true,
    });
    document.addEventListener("transitionend", onToastTransitionEnd, true);
    window.addEventListener("resize", scheduleMeasure);
    scheduleMeasure();

    return () => {
      if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener("transitionend", onToastTransitionEnd, true);
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, []);

  return (
    <Sonner
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Spinner aria-hidden="true" className="size-4" />,
      }}
      mobileOffset={{ top: appTopOffset + sonnerDefaultOffset + exportDropdownOffset }}
      offset={{ top: appTopOffset + sonnerDefaultOffset + exportDropdownOffset }}
      position="top-right"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      theme={theme}
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
