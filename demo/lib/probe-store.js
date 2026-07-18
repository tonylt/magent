const DEFAULT_ITEM_COUNT = 3;
const VALID_VIEWS = new Set(["home", "diagnostics", "transport", "voice", "composer"]);

function normalizeItemCount(value) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : DEFAULT_ITEM_COUNT;
}

function clampFocus(value, itemCount) {
  if (itemCount === 0) return 0;

  const focus = Number(value);
  const normalizedFocus = Number.isFinite(focus) ? Math.trunc(focus) : 0;
  return Math.max(0, Math.min(itemCount - 1, normalizedFocus));
}

function normalizeState(state = {}) {
  const itemCount = normalizeItemCount(state.itemCount);
  const view = VALID_VIEWS.has(state.view) ? state.view : "home";

  return {
    view,
    focus: clampFocus(state.focus, itemCount),
    itemCount,
    recording: view === "voice" && Boolean(state.recording),
    transcribing: view === "voice" && Boolean(state.transcribing),
    transcript: typeof state.transcript === "string" ? state.transcript : "",
    acceptedTranscript: Boolean(state.acceptedTranscript),
    voiceFailure: typeof state.voiceFailure === "string" ? state.voiceFailure : null,
  };
}

export function createInitialProbeState({ itemCount = DEFAULT_ITEM_COUNT } = {}) {
  return normalizeState({ itemCount });
}

export function reduceProbeState(currentState, action = {}) {
  const state = normalizeState(currentState);

  switch (action.type) {
    case "previous":
      return state.view === "home"
        ? { ...state, focus: clampFocus(state.focus - 1, state.itemCount) }
        : state;

    case "next":
      return state.view === "home"
        ? { ...state, focus: clampFocus(state.focus + 1, state.itemCount) }
        : state;

    case "focus-at":
      return state.view === "home"
        ? { ...state, focus: clampFocus(action.focus, state.itemCount) }
        : state;

    case "select":
      if (state.view === "composer") {
        return {
          ...state,
          view: "home",
          transcript: "",
          acceptedTranscript: true,
        };
      }
      if (state.view !== "home" || state.itemCount === 0) return state;
      return {
        ...state,
        view: state.focus === 2 ? "transport" : "diagnostics",
      };

    case "back":
      return {
        ...state,
        view: "home",
        recording: false,
        transcribing: false,
      };

    case "voice-started":
      if (state.view !== "home" || state.recording) return state;
      return {
        ...state,
        view: "voice",
        recording: true,
        transcribing: false,
        acceptedTranscript: false,
        voiceFailure: null,
      };

    case "voice-transcribing":
      if (state.view !== "voice") return state;
      return {
        ...state,
        recording: false,
        transcribing: true,
      };

    case "voice-transcript": {
      if (state.view !== "voice") return state;
      const transcript = typeof action.transcript === "string" ? action.transcript.trim() : "";
      return {
        ...state,
        view: "composer",
        recording: false,
        transcribing: false,
        transcript,
        acceptedTranscript: false,
        voiceFailure: null,
      };
    }

    case "voice-interrupted":
      return {
        ...state,
        view: "home",
        recording: false,
        transcribing: false,
        voiceFailure: typeof action.reason === "string" ? action.reason : "interrupted",
      };

    default:
      return state;
  }
}
