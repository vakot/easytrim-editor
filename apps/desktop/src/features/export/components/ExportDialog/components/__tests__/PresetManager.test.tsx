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
    name: /preset actions|akcie predvoľby|действия с пресетом/i,
  });

  await userEvent.click(actions[position]!);
}

afterEach(async () => {
  await i18n.changeLanguage("en");
  localStorage.clear();
});

describe("PresetManager built-in localization", () => {
  it("localizes an untouched built-in across locales after an arguments-only edit", async () => {
    await i18n.changeLanguage("ru");
    const store = renderPresetManager();
    const russianName = "P3 · Быстрый";
    const slovakName = "P3 · Rýchly";

    expect(screen.getByRole("button", { name: russianName })).toBeInTheDocument();

    await openPresetActions(russianName, 2);
    await userEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
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

    await i18n.changeLanguage("sk");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: slovakName })).toBeInTheDocument(),
    );
  });

  it("keeps an explicitly renamed built-in name across locale changes", async () => {
    await i18n.changeLanguage("ru");
    const store = renderPresetManager();
    await openPresetActions("P3 · Быстрый", 2);
    await userEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    await userEvent.clear(screen.getByLabelText("Имя"));
    await userEvent.type(screen.getByLabelText("Имя"), "My custom preset");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await i18n.changeLanguage("sk");

    expect(screen.getByRole("button", { name: "My custom preset" })).toBeInTheDocument();
    expect(
      store.getState().exportPresets.presets.find((preset) => preset.id === "hevc-nvenc-p3"),
    ).toMatchObject({ customName: "My custom preset", kind: "builtIn" });

    await openPresetActions("My custom preset", 2);
    await userEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(screen.getByLabelText("Názov")).toHaveValue("My custom preset");
    expect(screen.getByLabelText("Názov")).toHaveAttribute("placeholder", "P3 · Rýchly");
  });

  it("uses the localized effective name in Delete confirmation", async () => {
    await i18n.changeLanguage("sk");
    renderPresetManager();
    await openPresetActions("P3 · Rýchly", 2);
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(
      screen.getByText("Odstrániť „P3 · Rýchly“? Túto akciu nemožno vrátiť späť."),
    ).toBeInTheDocument();
  });

  it("validates custom names against visible built-in names and updates state consistently", async () => {
    await i18n.changeLanguage("ru");
    const store = renderPresetManager();

    await userEvent.click(screen.getByRole("button", { name: "P3 · Быстрый" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Добавить пресет" }));
    expect(screen.getByLabelText("Имя")).toHaveValue("");
    expect(screen.getByLabelText("Имя")).toHaveAttribute("placeholder", "Preset name");
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
    await userEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(screen.getByLabelText("Имя")).toHaveValue("My preset");
    expect(screen.getByLabelText("Имя")).toHaveAttribute("placeholder", "P3 · Быстрый");
    await userEvent.clear(screen.getByLabelText("Имя"));
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(
      store.getState().exportPresets.presets.find((preset) => preset.id === "hevc-nvenc-p3"),
    ).not.toHaveProperty("customName");
    await i18n.changeLanguage("sk");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "P3 · Rýchly" })).toBeInTheDocument(),
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
    await userEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    await userEvent.clear(screen.getByLabelText("Имя"));
    await userEvent.type(screen.getByLabelText("Имя"), "P3 · Быстрый");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(
      store.getState().exportPresets.presets.find((preset) => preset.id === "hevc-nvenc-p3"),
    ).not.toHaveProperty("customName");
    await i18n.changeLanguage("sk");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "P3 · Rýchly" })).toBeInTheDocument(),
    );
  });

  it("allows a built-in reset even when a custom preset has the same visible name", async () => {
    await i18n.changeLanguage("ru");
    const store = renderPresetManager();
    act(() => store.dispatch(exportPresetCreated({ name: "P3 · Быстрый" })));

    await openPresetActions("P3 · Быстрый", 2);
    await userEvent.click(screen.getAllByRole("menuitem", { name: "Edit" })[0]!);
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
    expect(screen.getByLabelText("Имя")).toHaveAttribute("placeholder", "Preset name");
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
    await userEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(screen.getByLabelText("Имя")).toHaveValue("First");
    expect(screen.getByLabelText("Имя")).toHaveAttribute("placeholder", "Preset name");
    await userEvent.clear(screen.getByLabelText("Имя"));
    await userEvent.type(screen.getByLabelText("Имя"), "Second");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(screen.getByText("Имена пресетов должны быть уникальными.")).toBeInTheDocument();
    expect(
      store.getState().exportPresets.presets.filter((preset) => preset.kind === "custom"),
    ).toMatchObject([{ name: "First" }, { name: "Second" }]);
  });
});
