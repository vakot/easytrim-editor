import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import type { EditingInstance } from "@/domain/editing-instance";
import { firstSource } from "@/test/source.fixtures";

const dispatch = vi.hoisted(() => vi.fn());
const prepareThumbnails = vi.hoisted(() => vi.fn());

vi.mock("@/app/store/redux-hooks", () => ({
  useAppDispatch: () => dispatch,
}));

vi.mock("@/app/store/thunks/source-media-thunks", () => ({
  prepareImportedSourceThumbnailsRequested: prepareThumbnails,
}));

import { usePrepareSources } from "../usePrepareSources";

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function createSource(): EditingInstance {
  return {
    exportAttempts: [],
    id: "source",
    origin: "source-import",
    snapshot: createDefaultEditorSnapshot(firstSource, false),
    sourceAvailability: "available",
  };
}

function PreparationProbe({ instances }: { instances: EditingInstance[] }) {
  const isLoading = usePrepareSources(instances);

  return <output data-testid="loading">{String(isLoading)}</output>;
}

describe("usePrepareSources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stays loading until thumbnails are prepared", async () => {
    const thumbnails = createDeferred<void>();
    const thumbnailRequest = {};

    prepareThumbnails.mockReturnValue(thumbnailRequest);
    dispatch.mockImplementation((request: unknown) => {
      if (request === thumbnailRequest) return thumbnails.promise;
      throw new Error("Unexpected preparation request");
    });

    render(<PreparationProbe instances={[createSource()]} />);

    await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("loading")).toHaveTextContent("true");

    thumbnails.resolve();
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
  });
});
