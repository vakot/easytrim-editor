import { CheckIcon } from "lucide-react";
import { Slot } from "radix-ui";
import * as React from "react";
import { useTranslation } from "react-i18next";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import { MenuIcon } from "@/components/ui/menu";

import {
  filterLanguages,
  getLanguageDisplayName,
  type Language,
  LANGUAGE_CATALOG,
} from "@/domain/languages";
import { cn } from "@/lib/class-names.utils";

interface LanguageSelectorContextValue {
  disabled: boolean;
  language: Language | undefined;
  languages: readonly Language[];
  query: string | null;
  selectLanguage: (language: Language) => void;
  setQuery: (query: string | null) => void;
}

const LanguageSelectorContext = React.createContext<LanguageSelectorContextValue | null>(null);
const LanguageSelectorContentContext = React.createContext(false);

function useLanguageSelector() {
  const context = React.useContext(LanguageSelectorContext);

  if (!context) {
    throw new Error("LanguageSelector components must be used within LanguageSelector");
  }

  return context;
}

type LanguageSelectorProps = Omit<React.ComponentProps<typeof Combobox>, "shouldFilter"> & {
  defaultValue?: Language["code"];
  disabled?: boolean;
  languages?: readonly Language[];
  onValueChange?: (value: Language["code"]) => void;
  value?: Language["code"];
};

function LanguageSelector({
  children,
  defaultValue,
  disabled = false,
  label,
  languages = LANGUAGE_CATALOG,
  onValueChange,
  value,
  ...props
}: LanguageSelectorProps) {
  const { t } = useTranslation();
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
  const [query, setQuery] = React.useState<string | null>(null);

  const selectedValue = value === undefined ? uncontrolledValue : value;
  const language = React.useMemo(
    () => languages.find((language) => language.code === selectedValue),
    [languages, selectedValue],
  );

  const filteredLanguages = React.useMemo(
    () => filterLanguages(languages, query ?? ""),
    [languages, query],
  );

  const selectLanguage = React.useCallback(
    (nextLanguage: Language) => {
      if (value === undefined) setUncontrolledValue(nextLanguage.code);
      onValueChange?.(nextLanguage.code);
      setQuery(null);
    },
    [onValueChange, value],
  );

  const context = React.useMemo(
    () => ({
      disabled,
      language,
      languages: filteredLanguages,
      query,
      selectLanguage,
      setQuery,
    }),
    [disabled, filteredLanguages, language, query, selectLanguage],
  );

  return (
    <LanguageSelectorContext.Provider value={context}>
      <Combobox label={label ?? t("common.labels.searchLanguages")} shouldFilter={false} {...props}>
        {children}
      </Combobox>
    </LanguageSelectorContext.Provider>
  );
}

function LanguageSelectorTrigger(props: React.ComponentProps<typeof ComboboxTrigger>) {
  const { disabled } = useLanguageSelector();

  return <ComboboxTrigger {...props} disabled={disabled || props.disabled} />;
}

function LanguageSelectorValue({
  placeholder,
  type = "displayName",
}: {
  placeholder?: React.ReactNode;
  type?: keyof Language | "displayName";
}) {
  const { language } = useLanguageSelector();

  if (!language) return placeholder ?? null;
  if (type === "displayName") return getLanguageDisplayName(language);
  return language[type];
}

const languageSelectorContentClassName =
  "flex max-h-[min(24rem,var(--radix-popover-content-available-height,24rem))] w-[max(var(--radix-popover-trigger-width,16rem),16rem)] min-w-[min(16rem,calc(100vw-2rem))] max-w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden p-0";

function LanguageSelectorContent({
  asChild = false,
  children,
  className,
  ...props
}: React.ComponentProps<typeof ComboboxContent>) {
  const mergedClassName = cn(languageSelectorContentClassName, className);

  if (asChild) {
    return (
      <LanguageSelectorContentContext.Provider value>
        <Slot.Root className={mergedClassName}>{children}</Slot.Root>
      </LanguageSelectorContentContext.Provider>
    );
  }

  return (
    <LanguageSelectorContentContext.Provider value>
      <ComboboxContent align="start" className={mergedClassName} sideOffset={4} {...props}>
        {children}
      </ComboboxContent>
    </LanguageSelectorContentContext.Provider>
  );
}

function LanguageSelectorInput({
  disabled,
  onValueChange,
  ...props
}: Omit<React.ComponentProps<typeof ComboboxInput>, "value">) {
  const insideContent = React.useContext(LanguageSelectorContentContext);
  const { disabled: selectorDisabled, language, query, setQuery } = useLanguageSelector();
  const value = insideContent
    ? (query ?? "")
    : (query ?? (language ? getLanguageDisplayName(language) : ""));

  return (
    <ComboboxInput
      autoComplete="off"
      disabled={selectorDisabled || disabled}
      onValueChange={(nextQuery) => {
        setQuery(nextQuery);
        onValueChange?.(nextQuery);
      }}
      value={value}
      {...props}
    />
  );
}

function LanguageSelectorList({
  className,
  ...props
}: Omit<React.ComponentProps<typeof ComboboxList>, "children">) {
  const { t } = useTranslation();
  const {
    disabled,
    language: selectedLanguage,
    languages,
    selectLanguage,
    setQuery,
  } = useLanguageSelector();

  React.useEffect(() => () => setQuery(null), [setQuery]);

  return (
    <ComboboxList className={className} {...props}>
      <ComboboxEmpty>{t("common.messages.noLanguagesFound")}</ComboboxEmpty>
      <ComboboxGroup>
        {languages.map((language) => {
          const selected = selectedLanguage?.code === language.code;

          return (
            <ComboboxItem
              aria-label={`${getLanguageDisplayName(language)}, ${language.code}`}
              className={cn("min-w-0 px-8 data-[language-selected=true]:font-medium")}
              data-language-selected={selected || undefined}
              disabled={disabled}
              key={language.code}
              keywords={[language.code, language.englishName, language.nativeName]}
              onSelect={() => selectLanguage(language)}
              value={language.code}
            >
              {selected ? (
                <MenuIcon>
                  <CheckIcon aria-hidden="true" />
                </MenuIcon>
              ) : null}
              <span className="min-w-0 flex-1 truncate">{getLanguageDisplayName(language)}</span>
              <MenuIcon side="right">
                <span className="shrink-0 text-xs text-muted-foreground">{language.code}</span>
              </MenuIcon>
            </ComboboxItem>
          );
        })}
      </ComboboxGroup>
    </ComboboxList>
  );
}

export {
  LanguageSelector,
  LanguageSelectorContent,
  LanguageSelectorInput,
  LanguageSelectorList,
  LanguageSelectorTrigger,
  LanguageSelectorValue,
};
