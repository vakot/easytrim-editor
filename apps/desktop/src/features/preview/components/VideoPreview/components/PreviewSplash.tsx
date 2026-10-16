import { useState } from "react";

import { cn } from "@/lib/class-names.utils";

import { chooseSplashMessage, type SplashMessageDefinition } from "../../../lib/splash-messages";

function PreviewSplash({
  className,
  message: fixedMessage,
}: {
  className?: string;
  message?: SplashMessageDefinition;
}) {
  const [randomMessage, setRandomMessage] = useState(() => fixedMessage ?? chooseSplashMessage());

  const message = fixedMessage ?? randomMessage;

  return (
    <button
      aria-label={`${message.text} Click for another message`}
      className={cn(
        "absolute bottom-4 left-full w-md -translate-1/2 -rotate-12 animate-splash-bounce font-semibold whitespace-nowrap text-primary text-shadow-2xs motion-reduce:animate-none",
        message.className,
        className,
      )}
      data-keyboard-shortcut-ignore
      onClick={() => {
        if (!fixedMessage) setRandomMessage(chooseSplashMessage(message.id));
      }}
      onKeyDown={(event) => event.stopPropagation()}
      type="button"
    >
      {message.render ? message.render() : message.text}
    </button>
  );
}

export { PreviewSplash };
