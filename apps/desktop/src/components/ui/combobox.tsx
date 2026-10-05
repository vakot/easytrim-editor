import * as React from "react";

import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { cn } from "@/lib/class-names.utils";

function Combobox({ ...props }: React.ComponentProps<typeof Popover>) {
  return <Popover {...props} />;
}

function ComboboxTrigger({ ...props }: React.ComponentProps<typeof PopoverTrigger>) {
  return <PopoverTrigger {...props} />;
}

function ComboboxAnchor({ ...props }: React.ComponentProps<typeof PopoverAnchor>) {
  return <PopoverAnchor {...props} />;
}

function ComboboxContent({ className, ...props }: React.ComponentProps<typeof PopoverContent>) {
  return (
    <PopoverContent className={cn("w-(--radix-popover-trigger-width) p-0", className)} {...props} />
  );
}

function ComboboxCommand({ ...props }: React.ComponentProps<typeof Command>) {
  return <Command {...props} />;
}

function ComboboxInput({ ...props }: React.ComponentProps<typeof CommandInput>) {
  return <CommandInput {...props} />;
}

function ComboboxList({ ...props }: React.ComponentProps<typeof CommandList>) {
  return <CommandList {...props} />;
}

function ComboboxEmpty({ ...props }: React.ComponentProps<typeof CommandEmpty>) {
  return <CommandEmpty {...props} />;
}

function ComboboxItem({ ...props }: React.ComponentProps<typeof CommandItem>) {
  return <CommandItem {...props} />;
}

export {
  Combobox,
  ComboboxAnchor,
  ComboboxCommand,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
};
