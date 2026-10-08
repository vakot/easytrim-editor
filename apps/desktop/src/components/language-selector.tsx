import {
  BG,
  CN,
  CZ,
  DE,
  DK,
  ES,
  FI,
  FR,
  GB,
  GR,
  HR,
  HU,
  ID,
  IL,
  IN,
  IT,
  JP,
  KR,
  LT,
  LV,
  MY,
  NL,
  NO,
  PL,
  PT,
  RO,
  RS,
  RU,
  SA,
  SE,
  SI,
  SK,
  TH,
  TR,
  UA,
  VN,
} from "country-flag-icons/react/3x2";
import getCountryFlag from "country-flag-icons/unicode";
import Fuse from "fuse.js";
import { CheckIcon } from "lucide-react";
import * as React from "react";

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

import { cn } from "@/lib/class-names.utils";
import { FUZZY_SEARCH_OPTIONS } from "@/lib/fuzzy-search.consts";

interface LanguageOption {
  code: string;
  englishName: string;
  nativeName: string;
  region?: string;
}

interface LanguageSelectorContextValue {
  disabled: boolean;
  language: LanguageOption | undefined;
  options: readonly LanguageOption[];
  query: string | null;
  selectLanguage: (language: LanguageOption) => void;
  setQuery: (query: string | null) => void;
}

interface LanguageSelectorItemContextValue {
  language: LanguageOption;
  selected: boolean;
}

interface LanguageSelectorProps extends Omit<
  React.ComponentProps<typeof Combobox>,
  "defaultValue" | "label" | "onValueChange" | "shouldFilter" | "value"
> {
  defaultValue?: string | null;
  disabled?: boolean;
  label: string;
  languages: readonly LanguageOption[];
  onValueChange?: (value: string | null) => void;
  value?: string | null;
}

const REGION_FLAGS = {
  BG,
  CN,
  CZ,
  DE,
  DK,
  ES,
  FI,
  FR,
  GB,
  GR,
  HR,
  HU,
  ID,
  IL,
  IN,
  IT,
  JP,
  KR,
  LV,
  LT,
  MY,
  NL,
  NO,
  PL,
  PT,
  RO,
  RU,
  RS,
  SA,
  SE,
  SI,
  SK,
  TH,
  TR,
  UA,
  VN,
} as const;

function LanguageSelector({
  children,
  defaultOpen,
  defaultValue,
  disabled = false,
  label,
  languages,
  onOpenChange,
  onValueChange,
  value,
  ...props
}: LanguageSelectorProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState<string | null>(
    defaultValue ?? null,
  );

  const [query, setQuery] = React.useState<string | null>(null);

  const isValueControlled = value !== undefined;
  const selectedValue = isValueControlled ? value : uncontrolledValue;
  const language = React.useMemo(
    () => languages.find((language) => language.code === selectedValue),
    [languages, selectedValue],
  );

  const searchLanguages = React.useMemo(
    () =>
      new Fuse(languages, {
        ...FUZZY_SEARCH_OPTIONS,
        ignoreDiacritics: true,
        keys: ["code", "englishName", "nativeName"],
      }),
    [languages],
  );

  const filteredLanguages = React.useMemo(
    () =>
      query?.trim() ? searchLanguages.search(query.trim()).map(({ item }) => item) : [...languages],
    [languages, query, searchLanguages],
  );

  const selectLanguage = React.useCallback(
    (nextLanguage: LanguageOption) => {
      if (!isValueControlled) setUncontrolledValue(nextLanguage.code);
      onValueChange?.(nextLanguage.code);
      setQuery(null);
    },
    [isValueControlled, onValueChange],
  );

  const context = React.useMemo(
    () => ({
      disabled,
      language,
      options: filteredLanguages,
      query,
      selectLanguage,
      setQuery,
    }),
    [disabled, filteredLanguages, language, query, selectLanguage],
  );

  return (
    <LanguageSelectorContext.Provider value={context}>
      <Combobox
        defaultOpen={defaultOpen}
        label={label}
        onOpenChange={(open) => {
          if (!open) setQuery(null);
          onOpenChange?.(open);
        }}
        shouldFilter={false}
        {...props}
      >
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
  className,
  placeholder,
  type = "displayName",
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & {
  placeholder?: React.ReactNode;
  type?: keyof Pick<LanguageOption, "code" | "englishName" | "nativeName"> | "displayName";
}) {
  const { language } = useLanguageSelector();

  if (!language) return placeholder ?? null;
  const value = type === "displayName" ? getLanguageDisplayName(language) : language[type];

  return (
    <span className={cn("flex min-w-0 items-center truncate text-left", className)} {...props}>
      <LanguageSelectorFlag className="mr-2" language={language} />
      <span className="truncate">{value}</span>
    </span>
  );
}

function LanguageSelectorContent({
  asChild = false,
  children,
  ...props
}: React.ComponentProps<typeof ComboboxContent>) {
  return (
    <LanguageSelectorContentContext.Provider value>
      <ComboboxContent align="start" asChild={asChild} sideOffset={4} {...props}>
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

function LanguageSelectorList({ children, ...props }: React.ComponentProps<typeof ComboboxList>) {
  return <ComboboxList {...props}>{children}</ComboboxList>;
}

function LanguageSelectorEmpty(props: React.ComponentProps<typeof ComboboxEmpty>) {
  return <ComboboxEmpty {...props} />;
}

function LanguageSelectorGroup(props: React.ComponentProps<typeof ComboboxGroup>) {
  return <ComboboxGroup {...props} />;
}

function LanguageSelectorItem({
  children,
  className,
  disabled: itemDisabled,
  language,
  onSelect,
  ...props
}: Omit<React.ComponentProps<typeof ComboboxItem>, "children" | "value"> & {
  children: React.ReactNode;
  language: LanguageOption;
}) {
  const { disabled, language: selectedLanguage, selectLanguage } = useLanguageSelector();

  const selected = selectedLanguage?.code === language.code;
  const displayName = getLanguageDisplayName(language);
  return (
    <LanguageSelectorItemContext.Provider value={{ language, selected }}>
      <ComboboxItem
        {...props}
        aria-label={`${displayName}, ${language.code}`}
        className={cn(
          "grid h-auto min-w-0 grid-cols-[1rem_minmax(0,1fr)_1rem] gap-x-2 px-2.5 py-2 pr-2 data-[language-selected=true]:font-medium",
          className,
        )}
        data-language-selected={selected || undefined}
        disabled={disabled || itemDisabled}
        keywords={[language.code, language.englishName, language.nativeName]}
        onSelect={(nextValue) => {
          onSelect?.(nextValue);
          selectLanguage(language);
        }}
        value={language.code}
      >
        {children}
      </ComboboxItem>
    </LanguageSelectorItemContext.Provider>
  );
}

function LanguageSelectorItemFlag({
  className,
  ...props
}: Omit<React.ComponentProps<"span">, "children">) {
  const { language } = useLanguageSelectorItem();

  return (
    <LanguageSelectorFlag
      className={cn("col-start-1 row-start-1", className)}
      language={language}
      {...props}
    />
  );
}

function LanguageSelectorItemText({ children, className, ...props }: React.ComponentProps<"div">) {
  const { language } = useLanguageSelectorItem();

  return (
    <div className={cn("col-start-2 row-start-1 grid min-w-0 gap-y-1", className)} {...props}>
      <span className="min-w-0 truncate">{getLanguageDisplayName(language)}</span>
      {children}
    </div>
  );
}

function LanguageSelectorItemIndicator({
  className,
  ...props
}: Omit<React.ComponentProps<"span">, "children">) {
  const { selected } = useLanguageSelectorItem();

  if (!selected) return null;

  return (
    <span
      aria-hidden="true"
      className={cn("col-start-3 row-start-1 flex items-center justify-end", className)}
      {...props}
    >
      <CheckIcon aria-hidden="true" />
    </span>
  );
}

function LanguageSelectorOptions() {
  const options = useLanguageSelectorOptions();

  return (
    <LanguageSelectorGroup>
      {options.map((language) => (
        <LanguageSelectorItem key={language.code} language={language}>
          <LanguageSelectorItemFlag />
          <LanguageSelectorItemText />
          <LanguageSelectorItemIndicator />
        </LanguageSelectorItem>
      ))}
    </LanguageSelectorGroup>
  );
}

function LanguageSelectorFlag({
  className,
  language,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & { language: LanguageOption }) {
  const CountryFlag = language.region
    ? REGION_FLAGS[language.region as keyof typeof REGION_FLAGS]
    : undefined;

  const unicodeFlag =
    language.region && /^[a-z]{2}$/i.test(language.region)
      ? getCountryFlag(language.region)
      : undefined;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-xs",
        className,
      )}
      {...props}
    >
      {CountryFlag ? (
        <CountryFlag aria-hidden="true" className="block h-auto! w-full!" />
      ) : unicodeFlag ? (
        <span className="text-xs leading-none">{unicodeFlag}</span>
      ) : null}
    </span>
  );
}

const LanguageSelectorContext = React.createContext<LanguageSelectorContextValue | null>(null);
const LanguageSelectorItemContext = React.createContext<LanguageSelectorItemContextValue | null>(
  null,
);

const LanguageSelectorContentContext = React.createContext(false);

function useLanguageSelector() {
  const context = React.useContext(LanguageSelectorContext);

  if (!context) {
    throw new Error("LanguageSelector components must be used within LanguageSelector");
  }

  return context;
}

function useLanguageSelectorItem() {
  const context = React.useContext(LanguageSelectorItemContext);

  if (!context) {
    throw new Error("LanguageSelector item components must be used within LanguageSelectorItem");
  }

  return context;
}

/** Returns the selector's current options after applying its active search query. */
function useLanguageSelectorOptions(): readonly LanguageOption[] {
  return useLanguageSelector().options;
}

function getLanguageDisplayName(language: LanguageOption): string {
  return language.nativeName === language.englishName
    ? language.nativeName
    : `${language.nativeName} (${language.englishName})`;
}

export {
  type LanguageOption,
  LanguageSelector,
  LanguageSelectorContent,
  LanguageSelectorEmpty,
  LanguageSelectorGroup,
  LanguageSelectorInput,
  LanguageSelectorItem,
  LanguageSelectorItemFlag,
  LanguageSelectorItemIndicator,
  LanguageSelectorItemText,
  LanguageSelectorList,
  LanguageSelectorOptions,
  LanguageSelectorTrigger,
  LanguageSelectorValue,
  // eslint-disable-next-line react-refresh/only-export-components -- This hook exposes selector-owned filtering to custom compound consumers.
  useLanguageSelectorOptions,
};
