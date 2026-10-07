import GB from "country-flag-icons/react/3x2/GB";
import RU from "country-flag-icons/react/3x2/RU";
import SK from "country-flag-icons/react/3x2/SK";
import { CheckIcon } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";

import {
  createLanguageSearcher,
  getLanguageDisplayName,
  type Language,
  SUPPORTED_LANGUAGES,
} from "@/domain/languages";
import { translationCoverage } from "@/i18n/resources";
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

const LANGUAGE_REGION_FLAGS: Record<Language["region"], typeof GB> = {
  GB,
  RU,
  SK,
};

function useLanguageSelector() {
  const context = React.useContext(LanguageSelectorContext);

  if (!context) {
    throw new Error("LanguageSelector components must be used within LanguageSelector");
  }

  return context;
}

function LanguageSelector({
  children,
  defaultValue,
  disabled = false,
  label,
  languages = SUPPORTED_LANGUAGES,
  onValueChange,
  value,
  ...props
}: Omit<React.ComponentProps<typeof Combobox>, "shouldFilter"> & {
  defaultValue?: Language["code"];
  disabled?: boolean;
  languages?: readonly Language[];
  onValueChange?: (value: Language["code"]) => void;
  value?: Language["code"];
}) {
  const { t } = useTranslation();
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
  const [query, setQuery] = React.useState<string | null>(null);

  const selectedValue = value === undefined ? uncontrolledValue : value;
  const language = React.useMemo(
    () => languages.find((language) => language.code === selectedValue),
    [languages, selectedValue],
  );

  const searchLanguages = React.useMemo(() => createLanguageSearcher(languages), [languages]);
  const filteredLanguages = React.useMemo(
    () => searchLanguages(query ?? ""),
    [query, searchLanguages],
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
      <Combobox
        label={label ?? t("settings.general.language.search")}
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
  type?: keyof Language | "displayName";
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

function LanguageSelectorList({
  ...props
}: Omit<React.ComponentProps<typeof ComboboxList>, "children">) {
  const { t } = useTranslation();
  const { languages, setQuery } = useLanguageSelector();

  React.useEffect(() => () => setQuery(null), [setQuery]);

  return (
    <ComboboxList {...props}>
      <ComboboxEmpty>{t("settings.general.language.noResults")}</ComboboxEmpty>
      <ComboboxGroup>
        {languages.map((language) => (
          <LanguageSelectorItem key={language.code} language={language} />
        ))}
      </ComboboxGroup>
    </ComboboxList>
  );
}

function LanguageSelectorItem({ language }: { language: Language }) {
  const { t } = useTranslation();
  const { disabled, language: selectedLanguage, selectLanguage } = useLanguageSelector();

  const selected = selectedLanguage?.code === language.code;
  const percentage = translationCoverage[language.code].percentage;

  return (
    <ComboboxItem
      aria-label={`${getLanguageDisplayName(language)}, ${language.code}`}
      className="grid h-auto min-w-0 grid-cols-[1rem_minmax(0,1fr)_1rem] grid-rows-[auto_auto] gap-x-2 gap-y-1 px-2.5 py-2 pr-2 data-[language-selected=true]:font-medium"
      data-language-selected={selected || undefined}
      disabled={disabled}
      keywords={[language.code, language.englishName, language.nativeName]}
      onSelect={() => selectLanguage(language)}
      value={language.code}
    >
      <LanguageSelectorFlag className="col-start-1 row-start-1" language={language} />

      <span className="col-start-2 row-start-1 min-w-0 truncate">
        {getLanguageDisplayName(language)}
      </span>

      <div className="col-start-2 row-start-2 flex items-center gap-1">
        <Progress
          aria-label={t("settings.general.language.coverageAccessibleLabel", {
            language: language.nativeName,
            percentage,
          })}
          className="h-1"
          value={percentage}
        />
        <span aria-hidden="true" className="w-[4ch] shrink-0 text-right text-xs tabular-nums">
          {percentage}%
        </span>
      </div>

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
}: Omit<React.ComponentProps<"span">, "children"> & { language: Language }) {
  const Flag = LANGUAGE_REGION_FLAGS[language.region];

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-xs",
        className,
      )}
      {...props}
    >
      <Flag aria-hidden="true" className="block h-auto! w-full!" />
    </span>
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
