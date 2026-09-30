"use client";

import { EventType } from "@ag-ui/core";
import { create } from "zustand";
import { streamUtterance, type UtteranceStreamHandle } from "@/lib/chunker";
import { apiUrl } from "@/lib/endpoints";
import { createTransport, type Transport } from "@/lib/transport";
import { applyAgUiEvent } from "@/store/reducer";
import { createTokenBatcher, type TokenBatcher } from "@/store/tokenBatcher";
import { createTraceSlice, type TraceSlice } from "@/store/traceSlice";
import type { AppState } from "@/store/types";
import { createUiSlice, type UiSlice } from "@/store/uiSlice";
import { bindUrlSync } from "@/store/urlSync";
import type { ClientEvent, FixtureInfo } from "@/types/events";

interface AppActions {
  /** Open the engine connection. Safe to call twice; the second call is a no-op. */
  connect: () => void;
  disconnect: () => void;

  /** Stream a typed utterance out as timed chunks, exactly like speech. */
  sendUtterance: (text: string) => void;
  /** Cut an in-flight utterance short without emitting `utterance.end`. */
  stopStreaming: () => void;
  replayFixture: (fixture: string, speed?: number) => void;
  newSession: () => void;

  setActiveVersion: (turnId: string, version: number) => void;
  setHoveredChunk: (chunkId: string | null) => void;
  toggleSidebar: (open?: boolean) => void;
  dismissError: () => void;
}

/** Everything the composed store exposes: the conversation (P0–P4), trace enrichment (P5-F10) and UI/route state (P5-F11). */
export type AppStore = AppState & AppActions & TraceSlice & UiSlice;

const INITIAL_STATE: AppState = {
  sessions: [],
  activeSessionId: null,
  turns: [],
  phase: "idle",
  isListening: false,
  draftTranscript: "",
  sidebarOpen: true,
  hoveredChunkId: null,
  corpus: null,
  fixtures: [],
  connection: "connecting",
  lastError: null,
  shared: null,
  openRun: null,
  calls: {},
};

/*
 * Connection singletons live outside the store: they are imperative handles, not
 * rendered state, and keeping them here stops a re-render from re-creating them.
 */
let transport: Transport | null = null;
let batcher: TokenBatcher | null = null;
let utterance: UtteranceStreamHandle | null = null;
let stopUrlSync: (() => void) | null = null;

export const useAppStore = create<AppStore>()((set, get, api) => {
  const emit = (event: ClientEvent) => transport?.send(event);

  const loadFixtures = async () => {
    try {
      const response = await fetch(apiUrl("/fixtures"));
      if (!response.ok) return;
      const body = (await response.json()) as { fixtures?: FixtureInfo[] };
      set({ fixtures: body.fixtures ?? [] });
    } catch {
      // No list means no suggestion chips; typing still works.
    }
  };

  const traceSlice = createTraceSlice(
    (updater) => set((state) => updater(state)),
    () => get(),
  );
  const uiSlice = createUiSlice(
    (updater) => set((state) => updater(state)),
    () => get(),
  );

  /** Client-only, once per app: components read and write routing through `uiSlice`, never `location.hash` directly. */
  const ensureUrlSync = () => {
    if (stopUrlSync || typeof window === "undefined") return;
    stopUrlSync = bindUrlSync({
      getState: () => get(),
      subscribe: (listener) => api.subscribe((state) => listener(state)),
      setView: (view) => get().setView(view),
      selectTurn: (turn) => get().selectTurn(turn),
      setInspectorTab: (tab) => get().setInspectorTab(tab),
      setFilters: (filters) => get().setFilters(filters),
    });
  };

  return {
    ...INITIAL_STATE,
    ...traceSlice,
    ...uiSlice,

    connect: () => {
      ensureUrlSync();
      if (transport) return;
      batcher = createTokenBatcher((event) => {
        set((state) => applyAgUiEvent(state, event));
        // Auto-enrich (P5-F10): the moment a turn's run finishes, its `/trace` record
        // exists on the engine — fetch it in the background so the Inspector opens instantly.
        if (event.type === EventType.RUN_FINISHED) {
          const state = get();
          const sessionId = state.activeSessionId;
          const turnId = event.runId;
          if (sessionId && state.turns.some((turn) => turn.sessionId === sessionId && turn.id === turnId)) {
            state.ensureTrace(sessionId, turnId);
          }
        }
      });
      transport = createTransport({
        onEvent: (event) => batcher?.push(event),
        onStatus: (connection) => {
          set({ connection });
          // The engine may have restarted on another corpus; fetch its test cases once it answers.
          if (connection === "open" && get().fixtures.length === 0) void loadFixtures();
        },
      });
      transport.connect();
    },

    disconnect: () => {
      utterance?.cancel();
      utterance = null;
      transport?.close();
      transport = null;
      batcher?.dispose();
      batcher = null;
    },

    sendUtterance: (text) => {
      const trimmed = text.trim();
      if (!trimmed || get().isListening) return;

      utterance?.cancel();
      set({ isListening: true, draftTranscript: "", phase: "active", lastError: null });
      emit({ type: "utterance.start" });

      utterance = streamUtterance({
        text: trimmed,
        onChunk: (chunk) => {
          emit({ type: "utterance.chunk", text: chunk.text });
          set((state) => ({
            draftTranscript: state.draftTranscript
              ? `${state.draftTranscript} ${chunk.text}`
              : chunk.text,
          }));
        },
        onEnd: () => {
          emit({ type: "utterance.end" });
          utterance = null;
          set({ isListening: false });
        },
      });
    },

    stopStreaming: () => {
      utterance?.cancel();
      utterance = null;
      set({ isListening: false, draftTranscript: "" });
    },

    replayFixture: (fixture, speed) => {
      set({ phase: "active", lastError: null });
      emit({ type: "replay", fixture, ...(speed === undefined ? {} : { speed }) });
    },

    newSession: () => {
      utterance?.cancel();
      utterance = null;
      emit({ type: "session.new" });
      set({
        turns: [],
        phase: "idle",
        isListening: false,
        draftTranscript: "",
        hoveredChunkId: null,
        lastError: null,
        openRun: null,
        calls: {},
      });
    },

    setActiveVersion: (turnId, version) =>
      set((state) => ({
        turns: state.turns.map((turn) =>
          turn.id === turnId ? { ...turn, activeVersion: version } : turn,
        ),
      })),

    setHoveredChunk: (hoveredChunkId) => set({ hoveredChunkId }),
    toggleSidebar: (open) => set((state) => ({ sidebarOpen: open ?? !state.sidebarOpen })),
    dismissError: () => set({ lastError: null }),
  };
});
