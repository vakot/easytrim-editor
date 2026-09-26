import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../dialog";

const longFilename =
  "render-output-2026-09-25-super-high-resolution-source-with-a-very-long-filename.mp4";

const longPath =
  "C:\\Media\\Projects\\Archive\\GeneratedIdentifiers\\job_01J8QZ0A7V9Y4K2M6N3P5R8T1W0X9Y7Z6A4B2C8D5E3F1G.mp4";

const multilineText =
  "This description contains ordinary text across multiple lines. It should keep normal word wrapping while long unbroken names wrap inside the dialog.";

describe("dialog content overflow", () => {
  it("keeps Dialog content constrained and wraps long user text", () => {
    render(
      <Dialog defaultOpen>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{longFilename}</DialogTitle>
            <DialogDescription>{longPath}</DialogDescription>
            <DialogDescription>{multilineText}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );

    const content = screen.getByRole("dialog");
    const { getByText } = within(content);
    const header = content.querySelector("[data-slot='dialog-header']");
    const title = content.querySelector("[data-slot='dialog-title']");
    const descriptions = content.querySelectorAll("[data-slot='dialog-description']");

    expect(content).toHaveClass("w-full", "min-w-0", "max-w-[calc(100%-2rem)]", "sm:max-w-sm");
    expect(content).toHaveClass("*:min-w-0");
    expect(content).not.toHaveClass("overflow-hidden");
    expect(header).toHaveClass("min-w-0");
    expect(title).toHaveClass("min-w-0", "wrap-anywhere");
    expect(descriptions).toHaveLength(2);
    descriptions.forEach((description) => expect(description).toHaveClass("wrap-anywhere"));
    expect(getByText(longFilename)).toBeInTheDocument();
    expect(getByText(longPath)).toBeInTheDocument();
    expect(getByText(multilineText)).toBeInTheDocument();
  });

  it("keeps AlertDialog content constrained and wraps long user text", () => {
    render(
      <AlertDialog defaultOpen>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{longFilename}</AlertDialogTitle>
            <AlertDialogDescription>{longPath}</AlertDialogDescription>
            <AlertDialogDescription>{multilineText}</AlertDialogDescription>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>,
    );

    const content = screen.getByRole("alertdialog");
    const { getByText } = within(content);
    const header = content.querySelector("[data-slot='alert-dialog-header']");
    const title = content.querySelector("[data-slot='alert-dialog-title']");
    const descriptions = content.querySelectorAll("[data-slot='alert-dialog-description']");

    expect(content).toHaveClass("w-full", "min-w-0", "max-w-[calc(100%-2rem)]", "sm:max-w-sm");
    expect(content).toHaveClass("*:min-w-0");
    expect(content).not.toHaveClass("overflow-hidden");
    expect(header).toHaveClass("min-w-0");
    expect(title).toHaveClass("min-w-0", "wrap-anywhere");
    expect(descriptions).toHaveLength(2);
    descriptions.forEach((description) => expect(description).toHaveClass("wrap-anywhere"));
    expect(getByText(longFilename)).toBeInTheDocument();
    expect(getByText(longPath)).toBeInTheDocument();
    expect(getByText(multilineText)).toBeInTheDocument();
  });
});
