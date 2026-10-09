"use client";

import * as React from "react";

import {
  Combobox,
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

function Autocomplete({ ...props }: React.ComponentProps<typeof Combobox>) {
  const [value, setValue] = React.useState<string>("");

  return (
    <AutocompleteContext.Provider value={{ value, setValue }}>
      <Combobox {...props} />
    </AutocompleteContext.Provider>
  );
}

function AutocompleteAnchor({ ...props }: React.ComponentProps<typeof ComboboxAnchor>) {
  return <ComboboxAnchor {...props} />;
}

function AutocompleteInputGroup({ ...props }: React.ComponentProps<typeof ComboboxInput>) {
  return <ComboboxInputGroup {...props} />;
}

function AutocompleteInput({
  onValueChange,
  value,
  ...props
}: React.ComponentProps<typeof ComboboxInput>) {
  const { setValue, value: uncontrolledValue } = useAutocomplete();

  React.useEffect(() => {
    if (value !== uncontrolledValue) setValue(value ?? "");
  }, [setValue, uncontrolledValue, value]);

  return (
    <ComboboxInput
      {...props}
      onValueChange={(nextValue) => {
        setValue(nextValue);
        onValueChange?.(nextValue);
      }}
      value={uncontrolledValue}
    />
  );
}

function AutocompleteContent({ ...props }: React.ComponentProps<typeof ComboboxContent>) {
  return <ComboboxContent {...props} />;
}

function AutocompleteEmpty({ ...props }: React.ComponentProps<typeof ComboboxEmpty>) {
  return <ComboboxEmpty {...props} />;
}

function AutocompleteList({ children, ...props }: React.ComponentProps<typeof ComboboxList>) {
  return (
    <ComboboxList {...props}>
      <ComboboxGroup>{children}</ComboboxGroup>
    </ComboboxList>
  );
}

function AutocompleteItem({
  onSelect,
  value,
  ...props
}: React.ComponentProps<typeof ComboboxItem> & { value: string }) {
  const { setValue } = useAutocomplete();

  return (
    <ComboboxItem
      className="px-2.5"
      onSelect={() => {
        setValue(value);
        onSelect?.(value);
      }}
      value={value}
      {...props}
    />
  );
}

const AutocompleteContext = React.createContext<{
  setValue: (newValue: string) => void;
  value: string;
} | null>(null);

function useAutocomplete() {
  const context = React.useContext(AutocompleteContext);

  if (!context) {
    throw new Error();
  }

  return context;
}

export {
  Autocomplete,
  AutocompleteAnchor,
  AutocompleteContent,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteInputGroup,
  AutocompleteItem,
  AutocompleteList,
};
