import { describe, expect, it } from "vitest";

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import type { EditingInstance } from "@/domain/editing-instance";
import { firstSource } from "@/test/source.fixtures";

import { getSourceTreeNodes } from "../source-tree.utils";

function instance(id: string, displayName: string, sourcePath: string): EditingInstance {
  return {
    exportAttempts: [],
    id,
    origin: "source-import",
    snapshot: createDefaultEditorSnapshot({ displayName, sourcePath }, false),
    sourceAvailability: "available",
  };
}

describe("getSourceTreeNodes", () => {
  it("merges paths and sorts folders before alphabetized files at every level", () => {
    const nodes = getSourceTreeNodes(
      [
        instance("zeta", "Zeta.mp4", "C:/Media/Zeta.mp4"),
        instance("nested", "nested.mp4", "C:/Media/Folder/nested.mp4"),
        instance("alpha", "alpha.mp4", "C:/Media/alpha.mp4"),
      ],
      { compact: false },
    );

    const drive = nodes[0];
    const media = drive?.kind === "folder" ? drive.children[0] : undefined;

    expect(media?.kind).toBe("folder");
    if (!media || media.kind !== "folder") return;

    expect(
      media.children.map((node) => (node.kind === "folder" ? node.name : node.instance.id)),
    ).toEqual(["Folder", "alpha", "zeta"]);
    expect(media.children[0]).toMatchObject({ kind: "folder", path: "C:/Media/Folder" });
  });

  it("keeps source instances attached to their merged folder paths", () => {
    const nodes = getSourceTreeNodes([
      instance("first", firstSource.displayName, firstSource.sourcePath),
      instance("second", "second.mp4", "C:/Media/second.mp4"),
    ]);

    const media = nodes[0];
    expect(media?.kind).toBe("folder");
    if (!media || media.kind !== "folder") return;

    expect(media.name).toBe("C:\\Media");
    expect(
      media.children.map((node) => (node.kind === "instance" ? node.instance.id : node.name)),
    ).toEqual(["first", "second"]);
  });
});
