import * as React from "react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { cn } from "@/lib/class-names.utils";

function SegmentedControl({
  children,
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof RadioGroup>) {
  return (
    <RadioGroup className={cn("flex w-auto gap-0", className)} orientation={orientation} {...props}>
      <ButtonGroup orientation={orientation}>{children}</ButtonGroup>
    </RadioGroup>
  );
}

function SegmentedControlItem({
  className,
  ...props
}: Omit<React.ComponentProps<typeof RadioGroupItem>, "indicator">) {
  return (
    <Button asChild variant="outline">
      <RadioGroupItem
        className={cn("aspect-auto size-auto rounded-lg", className)}
        {...props}
        indicator={null}
      />
    </Button>
  );
}

export { SegmentedControl, SegmentedControlItem };
