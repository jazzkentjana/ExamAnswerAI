// Content script (runs in top frame AND iframes) - v1.5

const isTopFrame = window === window.top;

let settings = {
  enabled: false,
  blinkTarget: "webpage",
  dotSize: 4,
  dotColor: "#ff0000",
  dotOffsetTop: 3,
  dotOffsetRight: 3
};

let lastMouseX = window.innerWidth / 2;
let lastMouseY = window.innerHeight / 2;
let hasMovedMouse = false;
let activeBlinkSession = 0;
let isRequestInFlight = false;

let dotStyleSheet = null;
function ensureStyleSheet() {
  if (!isTopFrame) return;
  if (!dotStyleSheet && "adoptedStyleSheets" in document) {
    dotStyleSheet = new CSSStyleSheet();
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, dotStyleSheet];
  }
}

function setLoadingPulseVisible(visible) {
  if (!isTopFrame) return;
  ensureStyleSheet();
  if (!dotStyleSheet) return;

  if (!visible) {
    dotStyleSheet.replaceSync("");
    return;
  }

  const size = Number(settings.dotSize) || 4;
  const top = Number(settings.dotOffsetTop) || 3;
  const right = Number(settings.dotOffsetRight) || 3;

  dotStyleSheet.replaceSync(`
    @keyframes __dh_fade_pulse {
      0%, 100% { opacity: 0.12; }
      50% { opacity: 0.95; }
    }
    html::after {
      content: "" !important;
      position: fixed !important;
      top: ${top}px !important;
      right: ${right}px !important;
      width: ${size}px !important;
      height: ${size}px !important;
      background-color: #000000 !important;
      box-shadow: 0 0 1px rgba(255, 255, 255, 0.55) !important;
      border-radius: 50% !important;
      pointer-events: none !important;
      z-index: 2147483647 !important;
      display: block !important;
      animation: __dh_fade_pulse 0.85s ease-in-out infinite !important;
    }
  `);
}

function setDotVisible(visible) {
  if (!isTopFrame) return;
  ensureStyleSheet();
  if (!dotStyleSheet) return;

  if (!visible) {
    dotStyleSheet.replaceSync("");
    return;
  }

  const size = Number(settings.dotSize) || 4;
  const top = Number(settings.dotOffsetTop) || 3;
  const right = Number(settings.dotOffsetRight) || 3;
  const color = settings.dotColor || "#ff0000";

  dotStyleSheet.replaceSync(`
    html::after {
      content: "" !important;
      position: fixed !important;
      top: ${top}px !important;
      right: ${right}px !important;
      width: ${size}px !important;
      height: ${size}px !important;
      background-color: ${color} !important;
      border-radius: 50% !important;
      pointer-events: none !important;
      z-index: 2147483647 !important;
      display: block !important;
      animation: none !important;
    }
  `);
}

function stopBlinking() {
  activeBlinkSession++;
  setDotVisible(false);
}

function startLoadingPulse() {
  if (!isTopFrame) return;
  activeBlinkSession++;
  setLoadingPulseVisible(true);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startRepeatingBlinkLoop(count) {
  if (!isTopFrame) return;
  stopBlinking();
  const sessionId = activeBlinkSession;

  while (sessionId === activeBlinkSession && settings.enabled) {
    for (let i = 0; i < count; i++) {
      if (sessionId !== activeBlinkSession || !settings.enabled) {
        setDotVisible(false);
        return;
      }
      setDotVisible(true);
      await sleep(180);

      setDotVisible(false);
      if (sessionId !== activeBlinkSession || !settings.enabled) {
        return;
      }
      await sleep(180);
    }

    await sleep(2000);
  }
  setDotVisible(false);
}

chrome.storage.local.get(Object.keys(settings), (stored) => {
  settings = { ...settings, ...stored };
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") {
    for (const [key, change] of Object.entries(changes)) {
      if (key in settings) {
        settings[key] = change.newValue;
      }
    }
    if (changes.enabled && !changes.enabled.newValue) {
      stopBlinking();
    }
    if (changes.blinkTarget && changes.blinkTarget.newValue === "toolbar") {
      stopBlinking();
    }
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!isTopFrame) return;

  if (msg.type === "START_LOADING") {
    startLoadingPulse();
    sendResponse({ ok: true });
  } else if (msg.type === "START_BLINK") {
    startRepeatingBlinkLoop(msg.count || 1);
    sendResponse({ ok: true });
  } else if (msg.type === "TEST_BLINK") {
    const prevEnabled = settings.enabled;
    settings.enabled = true;
    startRepeatingBlinkLoop(msg.count || 3);
    if (!prevEnabled) {
      setTimeout(() => {
        settings.enabled = prevEnabled;
        stopBlinking();
      }, 6500);
    }
    sendResponse({ ok: true });
  } else if (msg.type === "STOP_BLINK") {
    stopBlinking();
    sendResponse({ ok: true });
  }
});

window.addEventListener(
  "mousemove",
  (e) => {
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    hasMovedMouse = true;
  },
  { passive: true, capture: true }
);

window.addEventListener(
  "mousedown",
  () => {
    if (isTopFrame) {
      stopBlinking();
    }
    chrome.runtime.sendMessage({ type: "GLOBAL_STOP_BLINK" }).catch(() => {});
  },
  { passive: true, capture: true }
);

function isTextTypingElement(el) {
  if (!el) return false;
  const tag = (el.tagName || "").toLowerCase();
  if (tag === "textarea") return true;
  if (tag === "input") {
    const textTypes = ["text", "search", "email", "password", "url", "tel", "number"];
    const inputType = (el.type || "text").toLowerCase();
    return textTypes.includes(inputType);
  }
  return Boolean(el.isContentEditable);
}

window.addEventListener(
  "keydown",
  async (e) => {
    if (!settings.enabled) return;
    if (e.key !== "Backspace" && e.code !== "Backspace") return;
    if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
    if (isTextTypingElement(document.activeElement)) return;

    if (isTopFrame) {
      stopBlinking();
    }
    chrome.runtime.sendMessage({ type: "GLOBAL_STOP_BLINK" }).catch(() => {});

    if (isRequestInFlight) return;
    isRequestInFlight = true;

    const xRatio = Math.max(0, Math.min(1, lastMouseX / Math.max(1, window.innerWidth)));
    const yRatio = Math.max(0, Math.min(1, lastMouseY / Math.max(1, window.innerHeight)));

    try {
      await chrome.runtime.sendMessage({
        type: "CAPTURE_AND_SOLVE",
        xRatio,
        yRatio,
        hasCursor: hasMovedMouse
      });
    } catch (_err) {
      if (isTopFrame) stopBlinking();
    } finally {
      isRequestInFlight = false;
    }
  },
  { capture: true }
);
