import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it } from "vitest";

import {
  exportPresetCreated,
  exportPresetSelected,
  exportPresetUpdated,
} from "@/app/store/slices/export-presets-slice";
import { createAppStore } from "@/app/store/store";
import { i18n } from "@/i18n/config";

import { PresetManager } from "../PresetManager";

const testStorage = {
  getItem: async () => null,
  removeItem: async () => undefined,
  setItem: async () => undefined,
};

function presetActionLabel(english: string, russian: string) {
  return i18n.language === "ru" ? russian : english;
}

function renderPresetManager() {
  const store = createAppStore(testStorage);
  render(
    <Provider store={store}>
      <PresetManager />
    </Provider>,
  );
  return store;
}

async function openPresetActions(presetName: string, position: number) {
  await userEvent.click(screen.getByRole("button", { name: presetName }));
  const actions = screen.getAllByRole("menuitem", {
    name: presetActionLabel("Preset actions", "Действия с пресетом"),
  });

  await userEvent.click(actions[position]!);
}

afterEach(async () => {
  await i18n.changeLanguage("en");
  localStorage.clear();
});

const customNamePlaceholderCases = [
  {
    language: "en",
    builtInName: "P3 · Fast",
    placeholder: "Preset name",
    nameLabel: "Name",
    addLabel: "Add new preset",
    saveLabel: "Save",
  },
  {
    language: "ru",
    builtInName: "P3 · Быстрый",
    placeholder: "Имя пресета",
    nameLabel: "Имя",
    addLabel: "Добавить пресет",
    saveLabel: "Сохранить",
  },
];

describe("PresetManager built-in localization", () => {
  it.each(customNamePlaceholderCases)(
    "uses the localized generic placeholder in $language custom Create and Edit dialogs",
    async ({ addLabel, builtInName, language, nameLabel, placeholder, saveLabel }) => {
      await i18n.changeLanguage(language);
      renderPresetManager();

      await userEvent.click(screen.getByRole("button", { name: builtInName }));
      await userEvent.click(screen.getByRole("menuitem", { name: addLabel }));
      expect(screen.getByLabelText(nameLabel)).toHaveAttribute("placeholder", placeholder);
      await userEvent.type(screen.getByLabelText(nameLabel), "Custom");
      await userEvent.click(screen.getByRole("button", { name: saveLabel }));

      await openPresetActions("Custom", 7);
      await userEvent.click(
        screen.getByRole("menuitem", { name: presetActionLabel("Edit", "Изменить") }),
      );
      expect(screen.getByLabelText(nameLabel)).toHaveValue("Custom");
      expect(screen.getByLabelText(nameLabel)).toHaveAttribute("placeholder", placeholder);
    },
  );

  it("localizes an untouched built-in across locales after an arguments-only edit", async () => {
    await i18n.changeLanguage("ru");
    const store = renderPresetManager();
    const russianName = "P3 · Быстрый";
    const englishName = "P3 · Fast";

    expect(screen.getByRole("button", { name: russianName })).toBeInTheDocument();

    await openPresetActions(russianName, 2);
    await userEvent.click(
      screen.getByRole("menuitem", { name: presetActionLabel("Edit", "Изменить") }),
    );
    expect(screen.getByLabelText("Имя")).toHaveValue("");
    expect(screen.getByLabelText("Имя")).toHaveAttribute("placeholder", russianName);
    fireEvent.change(screen.getByLabelText("Аргументы FFmpeg"), {
      target: { value: "-c:v hevc_nvenc -preset p3 -cq 20" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    const editedPreset = store
      .getState()
      .exportPresets.presets.find((preset) => preset.id === "hevc-nvenc-p3");

    expect(editedPreset).toMatchObject({
      argumentsText: "-c:v hevc_nvenc -preset p3 -cq 20",
      id: "hevc-nvenc-p3",
      kind: "builtIn",
    });
    expect(editedPreset).not.toHaveProperty("customName");

    await i18n.changeLanguage("en");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: englishName })).toBeInTheDocument(),
    );
  });

  it("keeps an explicitly renamed built-in name across locale changes", async () => {
    await i18n.changeLanguage("ru");
    const store = renderPresetManager();
    await openPresetActions("P3 · Быстрый", 2);
    await userEvent.click(
      screen.getByRole("menuitem", { name: presetActionLabel("Edit", "Изменить") }),
    );
    await userEvent.clear(screen.getByLabelText("Имя"));
    await userEvent.type(screen.getByLabelText("Имя"), "My custom preset");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await i18n.changeLanguage("en");

    expect(screen.getByRole("button", { name: "My custom preset" })).toBeInTheDocument();
    expect(
      store.getState().exportPresets.presets.find((preset) => preset.id === "hevc-nvenc-p3"),
    ).toMatchObject({ customName: "My custom preset", kind: "builtIn" });

    await openPresetActions("My custom preset", 2);
    await userEvent.click(
      screen.getByRole("menuitem", { name: presetActionLabel("Edit", "Изменить") }),
    );
    expect(screen.getByLabelText("Name")).toHaveValue("My custom preset");
    expect(screen.getByLabelText("Name")).toHaveAttribute("placeholder", "P3 · Fast");
  });

  it("uses the localized effective name in Delete confirmation", async () => {
    await i18n.changeLanguage("en");
    renderPresetManager();
    await openPresetActions("P3 · Fast", 2);
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(screen.getByText("Delete “P3 · Fast”? This cannot be undone.")).toBeInTheDocument();
  });

  it("validates custom names against visible built-in names and updates state consistently", async () => {
    await i18n.changeLanguage("ru");
    const store = renderPresetManager();

    await userEvent.click(screen.getByRole("button", { name: "P3 · Быстрый" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Добавить пресет" }));
    expect(screen.getByLabelText("Имя")).toHaveValue("");
    expect(screen.getByLabelText("Имя")).toHaveAttribute("placeholder", "Имя пресета");
    await userEvent.type(screen.getByLabelText("Имя"), "P3 · Fast");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(screen.getByRole("button", { name: "P3 · Fast" })).toBeInTheDocument();
    expect(
      store.getState().exportPresets.presets.filter((preset) => preset.kind === "custom"),
    ).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: "P3 · Fast" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Добавить пресет" }));
    await userEvent.type(screen.getByLabelText("Имя"), "P3 · Быстрый");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(screen.getByText("Имена пресетов должны быть уникальными.")).toBeInTheDocument();
    expect(
      store.getState().exportPresets.presets.filter((preset) => preset.kind === "custom"),
    ).toHaveLength(1);
  });

  it("clears an explicit built-in name when the field is emptied", async () => {
    await i18n.changeLanguage("ru");
    const store = renderPresetManager();
    act(() => {
      store.dispatch(exportPresetSelected("hevc-nvenc-p3"));
      store.dispatch(
        exportPresetUpdated({
          presetKind: "builtIn",
          customName: "My preset",
          argumentsText: store.getState().exportPresets.argumentsText,
        }),
      );
    });

    await openPresetActions("My preset", 2);
    await userEvent.click(
      screen.getByRole("menuitem", { name: presetActionLabel("Edit", "Изменить") }),
    );
    expect(screen.getByLabelText("Имя")).toHaveValue("My preset");
    expect(screen.getByLabelText("Имя")).toHaveAttribute("placeholder", "P3 · Быстрый");
    await userEvent.clear(screen.getByLabelText("Имя"));
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(
      store.getState().exportPresets.presets.find((preset) => preset.id === "hevc-nvenc-p3"),
    ).not.toHaveProperty("customName");
    await i18n.changeLanguage("en");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "P3 · Fast" })).toBeInTheDocument(),
    );
  });

  it("clears a built-in override when the localized system name is submitted", async () => {
    await i18n.changeLanguage("ru");
    const store = renderPresetManager();
    act(() => {
      store.dispatch(exportPresetSelected("hevc-nvenc-p3"));
      store.dispatch(
        exportPresetUpdated({
          presetKind: "builtIn",
          customName: "My preset",
          argumentsText: store.getState().exportPresets.argumentsText,
        }),
      );
    });

    await openPresetActions("My preset", 2);
    await userEvent.click(
      screen.getByRole("menuitem", { name: presetActionLabel("Edit", "Изменить") }),
    );
    await userEvent.clear(screen.getByLabelText("Имя"));
    await userEvent.type(screen.getByLabelText("Имя"), "P3 · Быстрый");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(
      store.getState().exportPresets.presets.find((preset) => preset.id === "hevc-nvenc-p3"),
    ).not.toHaveProperty("customName");
    await i18n.changeLanguage("en");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "P3 · Fast" })).toBeInTheDocument(),
    );
  });

  it("allows a built-in reset even when a custom preset has the same visible name", async () => {
    await i18n.changeLanguage("ru");
    const store = renderPresetManager();
    act(() => store.dispatch(exportPresetCreated({ name: "P3 · Быстрый" })));

    await openPresetActions("P3 · Быстрый", 2);
    await userEvent.click(
      screen.getAllByRole("menuitem", {
        name: presetActionLabel("Edit", "Изменить"),
      })[0]!,
    );
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(
      store.getState().exportPresets.presets.find((preset) => preset.id === "hevc-nvenc-p3"),
    ).not.toHaveProperty("customName");
    expect(
      store
        .getState()
        .exportPresets.presets.filter(
          (preset) => preset.kind === "custom" && preset.name === "P3 · Быстрый",
        ),
    ).toHaveLength(1);
  });

  it("uses the generic placeholder and required validation for custom names", async () => {
    await i18n.changeLanguage("ru");
    const store = renderPresetManager();

    await userEvent.click(screen.getByRole("button", { name: "P3 · Быстрый" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Добавить пресет" }));
    expect(screen.getByLabelText("Имя")).toHaveAttribute("placeholder", "Имя пресета");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(screen.getByText("Введите имя пресета.")).toBeInTheDocument();
    expect(store.getState().exportPresets.presets).toHaveLength(7);
  });

  it("uses the generic placeholder and validates duplicate custom renames", async () => {
    await i18n.changeLanguage("ru");
    const store = renderPresetManager();

    await userEvent.click(screen.getByRole("button", { name: "P3 · Быстрый" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Добавить пресет" }));
    await userEvent.type(screen.getByLabelText("Имя"), "First");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    await userEvent.click(screen.getByRole("button", { name: "First" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Добавить пресет" }));
    await userEvent.type(screen.getByLabelText("Имя"), "Second");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await openPresetActions("Second", 7);
    await userEvent.click(
      screen.getByRole("menuitem", { name: presetActionLabel("Edit", "Изменить") }),
    );
    expect(screen.getByLabelText("Имя")).toHaveValue("First");
    expect(screen.getByLabelText("Имя")).toHaveAttribute("placeholder", "Имя пресета");
    await userEvent.clear(screen.getByLabelText("Имя"));
    await userEvent.type(screen.getByLabelText("Имя"), "Second");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(screen.getByText("Имена пресетов должны быть уникальными.")).toBeInTheDocument();
    expect(
      store.getState().exportPresets.presets.filter((preset) => preset.kind === "custom"),
    ).toMatchObject([{ name: "First" }, { name: "Second" }]);
  });
});
