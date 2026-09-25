import { describe, expect, it } from "vitest";

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import {
  activeEditingInstanceChanged,
  editingInstancesAdded,
} from "@/app/store/slices/editing-instances-slice";
import { createAppStore } from "@/app/store/store";
import { firstSource, media } from "@/test/source.fixtures";

import {
  createSelectSourceCardActive,
  createSelectSourceCardStatus,
} from "../source-card-selectors";

describe("SourceCard selectors", () => {
  it("limits active and loading/ready selector changes to the relevant card", () => {
    const store = createAppStore();
    const instances = ["one", "two", "other"].map((id) => ({
      exportAttempts: [],
      id,
      origin: "source-import" as const,
      snapshot: createDefaultEditorSnapshot(firstSource, false),
      sourceAvailability: "available" as const,
    }));

    store.dispatch(editingInstancesAdded(instances));
    store.dispatch(activeEditingInstanceChanged("one"));

    const selectors = Object.fromEntries(
      instances.map(({ id }) => [
        id,
        { active: createSelectSourceCardActive(id), status: createSelectSourceCardStatus(id) },
      ]),
    );

    const beforeSelection = store.getState();
    expect(selectors.one?.active(beforeSelection)).toBe(true);
    expect(selectors.two?.active(beforeSelection)).toBe(false);
    expect(selectors.other?.active(beforeSelection)).toBe(false);

    store.dispatch(activeEditingInstanceChanged("two"));
    const afterSelection = store.getState();
    expect(selectors.one?.active(afterSelection)).toBe(false);
    expect(selectors.two?.active(afterSelection)).toBe(true);
    expect(selectors.other?.active(afterSelection)).toBe(false);
    expect(selectors.one?.status(afterSelection)).toBe("idle");
    expect(selectors.two?.status(afterSelection)).toBe("idle");

    store.dispatch(sourceSelected({ loadToken: 1, source: firstSource }));
    const loading = store.getState();
    expect(selectors.one?.status(loading)).toBe("idle");
    expect(selectors.two?.status(loading)).toBe("loading-source");
    expect(selectors.other?.status(loading)).toBe("idle");

    store.dispatch(sourceReady({ loadToken: 1, media: media(firstSource.sourcePath) }));
    const ready = store.getState();
    expect(selectors.one?.status(ready)).toBe("idle");
    expect(selectors.two?.status(ready)).toBe("ready");
    expect(selectors.other?.status(ready)).toBe("idle");
  });
});
