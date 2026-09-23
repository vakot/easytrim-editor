import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { useKeyboardShortcut } from "@/lib/hooks/useKeyboardShortcut";

import { useSourceListData } from "../contexts/SourceListContext";

const SOURCE_SEARCH_DEBOUNCE_MS = 250;

function SourceListSearch() {
  const { t } = useTranslation();
  const { setSearch, sources } = useSourceListData();
  const [searchInternal, setSearchInternal] = useState("");
  const debouncedSearch = useDebouncedValue(searchInternal, SOURCE_SEARCH_DEBOUNCE_MS);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isFiltered = debouncedSearch.trim().length > 0;

  useEffect(() => {
    setSearch(debouncedSearch);
  }, [setSearch, debouncedSearch]);

  useKeyboardShortcut(
    (event) => event.code === "KeyF" && event.ctrlKey,
    () => searchInputRef.current?.focus(),
  );

  return (
    <InputGroup>
      <InputGroupAddon>
        <Search aria-hidden="true" />
      </InputGroupAddon>
      <InputGroupInput
        aria-label={t("common.labels.search")}
        onChange={(event) => setSearchInternal(event.currentTarget.value)}
        placeholder={t("common.labels.search")}
        ref={searchInputRef}
        type="search"
        value={searchInternal}
      />
      <InputGroupAddon align="inline-end" className="gap-1 py-0 pr-1">
        {isFiltered ? (
          <>
            <InputGroupButton
              aria-label={t("common.actions.clear")}
              onClick={() => setSearchInternal("")}
              size="icon-xs"
              type="button"
              variant="ghost"
            >
              <X aria-hidden="true" />
            </InputGroupButton>
            <span className="pr-1">{sources.length} Results</span>
          </>
        ) : (
          <KbdGroup aria-label="Ctrl + F">
            <Kbd>Ctrl</Kbd>
            <Kbd>F</Kbd>
          </KbdGroup>
        )}
      </InputGroupAddon>
    </InputGroup>
  );
}

export { SourceListSearch };
