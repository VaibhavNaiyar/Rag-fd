"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { LAYER_ROOT_ID, registerLayer } from "@/components/ui/layerStack";

/**
 * The element every floating layer renders into. AppFrame renders it; anywhere that
 * does not (the kit page, a test) gets one appended to <body> on first use. It sits
 * outside the app, so a layer is never clipped by an overflow or a stacking context
 * of the thing that opened it.
 */
export function ensureLayerRoot(): HTMLElement {
  let root = document.getElementById(LAYER_ROOT_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = LAYER_ROOT_ID;
    document.body.appendChild(root);
  }
  return root;
}

const NEVER_CHANGES = () => () => undefined;

/**
 * Renders its children into the layer root. Renders nothing on the server and during
 * hydration, then the portal on the client, which is why it needs no effect.
 * A layer must have exactly one root element, so the stack can tell which part of
 * the page belongs to it.
 */
export function Portal({ children }: { children: ReactNode }) {
  const root = useSyncExternalStore(NEVER_CHANGES, ensureLayerRoot, () => null);
  return root ? createPortal(children, root) : null;
}

export interface UseLayerOptions {
  /** The layer is on the stack while this is true. */
  open: boolean;
  /** Blocks the page behind it: inert, no scroll. */
  modal: boolean;
  /** Escape was pressed while this layer was on top. */
  onEscape: () => void;
  /** The layer's root element. */
  elementRef: RefObject<HTMLElement | null>;
}

/** Puts a layer on the stack while it is open. See layerStack.ts for what that buys. */
export function useLayer({ open, modal, onEscape, elementRef }: UseLayerOptions): void {
  const escape = useRef(onEscape);
  useEffect(() => {
    escape.current = onEscape;
  });

  useEffect(() => {
    if (!open) return;
    const layer = registerLayer({ modal, getElement: () => elementRef.current, onEscape: () => escape.current() });
    return layer.unregister;
  }, [open, modal, elementRef]);
}
