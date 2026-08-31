import { cva, type VariantProps } from "class-variance-authority";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";

import { cn } from "@/lib/class-names.utils";

const segmentedControlCheckedVariants = cva("w-auto", {
  variants: {
    variant: {
      default:
        "data-checked:bg-primary data-checked:hover:bg-primary/80 dark:data-checked:bg-primary/40 dark:data-checked:hover:bg-primary/30",
      destructive:
        "not-data-checked:bg-destructive/10 not-data-checked:hover:bg-destructive/20 dark:not-data-checked:bg-destructive/20 dark:not-data-checked:hover:bg-destructive/30 data-checked:bg-destructive/30 data-checked:hover:bg-destructive/40 dark:data-checked:bg-destructive/40 dark:data-checked:hover:bg-destructive/50",
      success:
        "not-data-checked:bg-success/10 not-data-checked:hover:bg-success/20 dark:not-data-checked:bg-success/20 dark:not-data-checked:hover:bg-success/30 data-checked:bg-success/30 data-checked:hover:bg-success/40 dark:data-checked:bg-success/40 dark:data-checked:hover:bg-success/50",
    },
    size: {
      default: "",
      xs: "",
      sm: "",
      lg: "",
      icon: "size-8",
      "icon-xs": "size-6",
      "icon-sm": "size-7",
      "icon-lg": "size-9",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "sm",
  },
});

function SegmentedControl({
  children,
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      className={cn("flex w-auto gap-0", className)}
      orientation={orientation}
      {...props}
    >
      <ButtonGroup orientation={orientation}>{children}</ButtonGroup>
    </RadioGroupPrimitive.Root>
  );
}

function SegmentedControlItem({
  children,
  className,
  size = "sm",
  variant = "default",
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item> &
  Pick<React.ComponentProps<typeof Button>, "size"> &
  VariantProps<typeof segmentedControlCheckedVariants>) {
  return (
    <Button
      asChild
      className="border-border dark:border-input"
      size={size}
      variant={variant === "default" ? "outline" : variant}
    >
      <RadioGroupPrimitive.Item
        className={cn(segmentedControlCheckedVariants({ variant, size, className }))}
        {...props}
      >
        {children}
      </RadioGroupPrimitive.Item>
    </Button>
  );
}

export { SegmentedControl, segmentedControlCheckedVariants, SegmentedControlItem };
