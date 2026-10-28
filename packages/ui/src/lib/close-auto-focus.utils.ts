/**
 * Close-auto-focus handler for layers (menus, dialogs): the layer returns focus to its trigger
 * only when focus was lost with it. When the layer closed because its action opened another
 * layer that has already taken focus, such as a menu item opening a dialog whose field
 * autofocuses, returning focus to the trigger would pull it back out of that new layer.
 *
 * Calls `onCloseAutoFocus` first, so a caller can still decide where focus goes.
 */
function keepMovedFocusOnClose(onCloseAutoFocus?: (event: Event) => void) {
  return (event: Event) => {
    onCloseAutoFocus?.(event);
    if (event.defaultPrevented) return;

    const focused = document.activeElement;
    if (focused && focused !== document.body) event.preventDefault();
  };
}

export { keepMovedFocusOnClose };
