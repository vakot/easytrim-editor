import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CustomTitleBar } from "../CustomTitleBar";
import { ContextMenus } from "../ContextMenus";
import { ThemeProvider } from "@/app/theme/ThemeProvider";

const windowActions = vi.hoisted(() => ({
  closeWindow: vi.fn(() => Promise.resolve()),
  isWindowMaximized: vi.fn(() => Promise.resolve(false)),
  minimizeWindow: vi.fn(() => Promise.resolve()),
  startWindowDragging: vi.fn(() => Promise.resolve()),
  toggleWindowMaximize: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/tauri/window", () => windowActions);

describe("CustomTitleBar", () => {
  it("keeps menu controls interactive inside the title bar", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <CustomTitleBar
          onLogoClick={vi.fn()}
          menuControls={
            <ContextMenus
              isChoosingSource={false}
              canSave
              canExport
              onChooseSource={vi.fn()}
              onSave={vi.fn()}
              onExport={vi.fn()}
            />
          }
        />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole("button", { name: "File" }));

    expect(screen.getByRole("menuitem", { name: /Open File/ })).toBeInTheDocument();
  });

  it("does not toggle maximize when a menu or submenu item is double-clicked", async () => {
    const user = userEvent.setup();
    const menuRender = render(
      <ThemeProvider>
        <CustomTitleBar
          onLogoClick={vi.fn()}
          menuControls={
            <ContextMenus
              isChoosingSource={false}
              canSave
              canExport
              onChooseSource={vi.fn()}
              onSave={vi.fn()}
              onExport={vi.fn()}
            />
          }
        />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole("button", { name: "File" }));
    fireEvent.doubleClick(screen.getByRole("menuitem", { name: /Open File/ }));
    expect(windowActions.toggleWindowMaximize).not.toHaveBeenCalled();
    menuRender.unmount();

    render(
      <ThemeProvider>
        <CustomTitleBar
          onLogoClick={vi.fn()}
          menuControls={
            <ContextMenus
              isChoosingSource={false}
              canSave
              canExport
              onChooseSource={vi.fn()}
              onSave={vi.fn()}
              onExport={vi.fn()}
            />
          }
        />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole("button", { name: "View" }));
    const themeItem = screen.getByText("Theme").closest<HTMLElement>('[role="menuitem"]');
    expect(themeItem).not.toBeNull();
    themeItem?.focus();
    await user.keyboard("{ArrowRight}");
    fireEvent.doubleClick(screen.getByRole("menuitem", { name: "System" }));
    expect(windowActions.toggleWindowMaximize).not.toHaveBeenCalled();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    windowActions.isWindowMaximized.mockResolvedValue(false);
  });

  it("shows the app logo and accessible window controls", () => {
    render(<CustomTitleBar onLogoClick={vi.fn()} />);

    expect(screen.getByRole("banner", { name: "Window title bar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "EasyTrim Editor" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Minimize" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Maximize" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("places panel controls beside the native window controls", () => {
    render(
      <CustomTitleBar
        onLogoClick={vi.fn()}
        panelControls={<span data-testid="panel-controls" />}
      />,
    );

    const panelControls = screen.getByTestId("panel-controls");
    const windowControls = screen.getByRole("group", { name: "Window controls" });

    expect(panelControls.compareDocumentPosition(windowControls)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("centers status content independently of the title bar side controls", () => {
    render(
      <CustomTitleBar
        onLogoClick={vi.fn()}
        menuControls={<span data-testid="menu-controls" />}
        statusContent={<span data-testid="status-content">Media tools ready</span>}
        panelControls={<span data-testid="panel-controls" />}
      />,
    );

    const statusContent = screen.getByTestId("status-content");
    const statusSlot = statusContent.parentElement;
    expect(statusSlot).not.toBeNull();
    expect(statusSlot).toHaveClass("absolute", "left-1/2", "-translate-x-1/2");
  });

  it("delegates dragging and window controls to the native adapter", async () => {
    render(<CustomTitleBar onLogoClick={vi.fn()} />);

    const dragRegion = screen.getByRole("banner").querySelector("header > div");
    if (!dragRegion) throw new Error("Expected title bar drag region");
    fireEvent.pointerDown(dragRegion, { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(dragRegion, { clientX: 20, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(dragRegion, { pointerId: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Minimize" }));
    fireEvent.click(screen.getByRole("button", { name: "Maximize" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => {
      expect(windowActions.startWindowDragging).toHaveBeenCalledOnce();
      expect(windowActions.minimizeWindow).toHaveBeenCalledOnce();
      expect(windowActions.toggleWindowMaximize).toHaveBeenCalledOnce();
      expect(windowActions.closeWindow).toHaveBeenCalledOnce();
      expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();
    });
  });

  it("toggles maximize when the draggable title bar is double-clicked", async () => {
    render(<CustomTitleBar onLogoClick={vi.fn()} />);

    fireEvent.doubleClick(screen.getByRole("banner"));

    await waitFor(() => {
      expect(windowActions.toggleWindowMaximize).toHaveBeenCalledOnce();
      expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();
    });
  });
});
