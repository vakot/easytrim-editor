import * as React from "react";

import {
  Combobox,
  ComboboxAnchor,
  ComboboxCommand,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import { ScrollArea } from "@/components/ui/scroll-area";

import { filterLanguages, type Language, LANGUAGE_CATALOG } from "@/domain/languages";

type LanguageIdentifier = Pick<Language, "code">;

function LanguageSelector({
  languages = LANGUAGE_CATALOG,
  onValueChange,
  value,
  ...props
}: React.ComponentProps<typeof Combobox> & {
  languages?: readonly Language[];
  onValueChange?: (value: Language["code"]) => void;
  value?: Language["code"];
}) {
  const [query, setQuery] = React.useState("");
  const selectedLanguage = languages.find((language) => language.code === value);
  const filteredLanguages = React.useMemo(
    () => filterLanguages(languages, query),
    [languages, query],
  );

  const selectLanguage = (language: LanguageIdentifier) => {
    onValueChange?.(language.code);
  };

  return (
    <LanguageSelectorContext.Provider
      value={{
        selectLanguage,
        language: selectedLanguage,
        languages: filteredLanguages,
        query,
        setQuery,
      }}
    >
      <Combobox {...props} />
    </LanguageSelectorContext.Provider>
  );
}

function LanguageSelectorContent({ ...props }: React.ComponentProps<typeof ComboboxContent>) {
  return <ComboboxContent align="start" sideOffset={4} {...props} />;
}

function LanguageSelectorInput({
  onValueChange,
  ...props
}: Omit<React.ComponentProps<typeof ComboboxInput>, "value">) {
  const { query, setQuery } = useLanguageSelector();

  const handleValueChange = (search: string) => {
    setQuery(search);
    onValueChange?.(search);
  };

  return (
    <ComboboxInput autoComplete="off" onValueChange={handleValueChange} value={query} {...props} />
  );
}

function LanguageSelectorList({
  ...props
}: Omit<React.ComponentProps<typeof ComboboxList>, "children">) {
  const { languages } = useLanguageSelector();

  return (
    <ComboboxList {...props}>
      <ScrollArea>
        <ComboboxEmpty>{"No languages found. TODO: add translation"}</ComboboxEmpty>
        {languages.map((language) => (
          <LanguageSelectorItem key={language.code} />
        ))}
      </ScrollArea>
    </ComboboxList>
  );
}

function LanguageSelectorCommand({
  onValueChange,
  ...props
}: Omit<React.ComponentProps<typeof ComboboxCommand>, "value">) {
  const { language, selectLanguage } = useLanguageSelector();

  const handleValueChange = (value: string) => {
    selectLanguage({ code: value });
    onValueChange?.(value);
  };

  return (
    <ComboboxCommand
      onValueChange={handleValueChange}
      shouldFilter={false}
      value={language?.code}
      {...props}
    />
  );
}

function LanguageSelectorTrigger({
  children,
  ...props
}: Omit<React.ComponentProps<typeof ComboboxTrigger>, "children"> & {
  children: ((value: { language: Language | undefined }) => React.ReactNode) | React.ReactNode;
}) {
  const { language } = useLanguageSelector();

  return (
    <ComboboxTrigger {...props}>
      {typeof children === "function" ? children({ language }) : children}
    </ComboboxTrigger>
  );
}

function LanguageSelectorAnchor({
  children,
  ...props
}: Omit<React.ComponentProps<typeof ComboboxAnchor>, "children"> & {
  children: ((value: { language: Language | undefined }) => React.ReactNode) | React.ReactNode;
}) {
  const { language } = useLanguageSelector();

  return (
    <ComboboxAnchor {...props}>
      {typeof children === "function" ? children({ language }) : children}
    </ComboboxAnchor>
  );
}

function LanguageSelectorItem({ ...props }: React.ComponentProps<typeof ComboboxItem>) {
  return <ComboboxItem {...props} />;
}

interface LanguageSelectorContextProps {
  language: Language | undefined;
  languages: readonly Language[];
  query: string;
  selectLanguage: (value: LanguageIdentifier) => void;
  setQuery: (value: string) => void;
}

const LanguageSelectorContext = React.createContext<LanguageSelectorContextProps | null>(null);

function useLanguageSelector() {
  const context = React.useContext(LanguageSelectorContext);
  if (!context) {
    throw new Error("* must be used within LanguageSelector");
  }
  return context;
}

export {
  LanguageSelector,
  LanguageSelectorAnchor,
  LanguageSelectorCommand,
  LanguageSelectorContent,
  LanguageSelectorInput,
  LanguageSelectorItem,
  LanguageSelectorList,
  LanguageSelectorTrigger,
};
