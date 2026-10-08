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
  flag?: React.ReactNode;
  nativeName: string;
  region?: string;
}

interface LanguageSelectorContextValue {
  disabled: boolean;
  language: LanguageOption | undefined;
  languages: readonly LanguageOption[];
  query: string | null;
  selectLanguage: (language: LanguageOption) => void;
  setQuery: (query: string | null) => void;
}

interface LanguageSelectorRenderOptionContext {
  displayName: string;
  selected: boolean;
}

type LanguageSelectorListProps = Omit<React.ComponentProps<typeof ComboboxList>, "children"> & {
  emptyState: React.ReactNode;
  renderOption?: (
    language: LanguageOption,
    context: LanguageSelectorRenderOptionContext,
  ) => React.ReactNode;
};

const LanguageSelectorContext = React.createContext<LanguageSelectorContextValue | null>(null);
const LanguageSelectorContentContext = React.createContext(false);
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

function useLanguageSelector() {
  const context = React.useContext(LanguageSelectorContext);

  if (!context) {
    throw new Error("LanguageSelector components must be used within LanguageSelector");
  }

  return context;
}

function getLanguageDisplayName(language: LanguageOption): string {
  return language.nativeName === language.englishName
    ? language.nativeName
    : `${language.nativeName} (${language.englishName})`;
}

function LanguageSelector(
  selectorProps: Omit<React.ComponentProps<typeof Combobox>, "label" | "shouldFilter"> & {
    defaultValue?: string;
    disabled?: boolean;
    label: string;
    languages: readonly LanguageOption[];
    onValueChange?: (value: string) => void;
    value?: string;
  },
) {
  const {
    children,
    defaultValue,
    disabled = false,
    label,
    languages,
    onValueChange,
    value,
    ...props
  } = selectorProps;

  const isValueControlled = Object.prototype.hasOwnProperty.call(selectorProps, "value");
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
  const [query, setQuery] = React.useState<string | null>(null);

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
      languages: filteredLanguages,
      query,
      selectLanguage,
      setQuery,
    }),
    [disabled, filteredLanguages, language, query, selectLanguage],
  );

  return (
    <LanguageSelectorContext.Provider value={context}>
      <Combobox label={label} shouldFilter={false} {...props}>
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

function LanguageSelectorList({ emptyState, renderOption, ...props }: LanguageSelectorListProps) {
  const { languages, setQuery } = useLanguageSelector();

  React.useEffect(() => () => setQuery(null), [setQuery]);

  return (
    <ComboboxList {...props}>
      <ComboboxEmpty>{emptyState}</ComboboxEmpty>
      <ComboboxGroup>
        {languages.map((language) => (
          <LanguageSelectorItem
            key={language.code}
            language={language}
            renderOption={renderOption}
          />
        ))}
      </ComboboxGroup>
    </ComboboxList>
  );
}

function LanguageSelectorItem({
  language,
  renderOption,
}: {
  language: LanguageOption;
  renderOption: LanguageSelectorListProps["renderOption"];
}) {
  const { disabled, language: selectedLanguage, selectLanguage } = useLanguageSelector();

  const selected = selectedLanguage?.code === language.code;
  const displayName = getLanguageDisplayName(language);

  return (
    <ComboboxItem
      aria-label={`${displayName}, ${language.code}`}
      className={cn(
        "grid h-auto min-w-0 grid-cols-[1rem_minmax(0,1fr)_1rem] gap-x-2 px-2.5 py-2 pr-2 data-[language-selected=true]:font-medium",
        renderOption && "grid-rows-[auto_auto] gap-y-1",
      )}
      data-language-selected={selected || undefined}
      disabled={disabled}
      keywords={[language.code, language.englishName, language.nativeName]}
      onSelect={() => selectLanguage(language)}
      value={language.code}
    >
      {renderOption ? (
        renderOption(language, { displayName, selected })
      ) : (
        <>
          <LanguageSelectorFlag className="col-start-1 row-start-1" language={language} />
          <span className="col-start-2 row-start-1 min-w-0 truncate">{displayName}</span>
        </>
      )}

      {selected ? (
        <span aria-hidden="true" className="col-start-3 row-start-1 flex justify-end">
          <CheckIcon aria-hidden="true" />
        </span>
      ) : null}
    </ComboboxItem>
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

  const unicodeFlag = language.region ? getCountryFlag(language.region) : undefined;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-xs",
        className,
      )}
      {...props}
    >
      {language.flag !== undefined ? (
        language.flag
      ) : CountryFlag ? (
        <CountryFlag aria-hidden="true" className="block h-auto! w-full!" />
      ) : (
        <span className="text-xs leading-none">{unicodeFlag}</span>
      )}
    </span>
  );
}

export {
  type LanguageOption,
  LanguageSelector,
  LanguageSelectorContent,
  LanguageSelectorFlag,
  LanguageSelectorInput,
  LanguageSelectorList,
  LanguageSelectorTrigger,
  LanguageSelectorValue,
};
