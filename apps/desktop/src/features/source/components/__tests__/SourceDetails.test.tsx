import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import { createAppStore } from "@/app/store/store";
import { media } from "@/test/source.fixtures";

import { SourceDetails } from "../SourceDetails";

describe("SourceDetails", () => {
  it("renders source creation and update timestamps", () => {
    const store = createAppStore();
    const source = {
      createdAtMicros: Date.UTC(2026, 0, 2, 15, 4) * 1_000,
      displayName: "clip.mp4",
      sourcePath: "C:/Media/clip.mp4",
      updatedAtMicros: Date.UTC(2026, 0, 3, 16, 5) * 1_000,
    };

    store.dispatch(sourceSelected({ loadToken: 1, source }));
    store.dispatch(sourceReady({ loadToken: 1, media: media(source.sourcePath) }));

    render(
      <Provider store={store}>
        <SourceDetails />
      </Provider>,
    );

    expect(screen.getByText("Created at")).toBeInTheDocument();
    expect(screen.getByText("Updated at")).toBeInTheDocument();
    expect(
      screen.getByText(
        new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
          new Date(source.createdAtMicros / 1_000),
        ),
      ),
    ).toBeInTheDocument();
  });
});
