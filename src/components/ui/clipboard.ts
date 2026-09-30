/**
 * Copies text to the clipboard. The async Clipboard API needs a secure context (https
 * or localhost) and the reader's permission; where it is missing or refuses, this falls
 * back to a hidden textarea and `execCommand("copy")`, which the console still needs
 * when it is served over plain http on a lab network. Returns whether the copy worked.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Refused (permission, or not focused): try the fallback.
  }
  return copyWithSelection(text);
}

function copyWithSelection(text: string): boolean {
  if (typeof document === "undefined") return false;
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.setAttribute("aria-hidden", "true");
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.left = "0";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  area.remove();
  previous?.focus({ preventScroll: true });
  return copied;
}
