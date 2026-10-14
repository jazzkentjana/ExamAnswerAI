// Background Service Worker for Edge (macOS & Windows) - v1.5

const DEFAULT_SETTINGS = {
  enabled: false,
  apiKey: "",
  model: "auto",
  cachedWorkingModel: "",
  blinkTarget: "webpage", // "webpage" | "toolbar" | "both"
  dotSize: 4,             // 2, 3, 4, 5, or 6 px
  dotColor: "#ff0000",    // Answer blink color (default Bright Red)
  dotOffsetTop: 3,
  dotOffsetRight: 3,
  lastStatus: "Ready"
};

const CANDIDATE_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3-flash",
  "gemini-3-flash-preview",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-flash-latest"
];

let toolbarBlinkSession = 0;

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  const merged = { ...DEFAULT_SETTINGS, ...current };
  if (merged.model === "gemini-2.5-flash") {
    merged.model = "auto";
  }
  await chrome.storage.local.set(merged);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.enabled && !changes.enabled.newValue) {
    stopToolbarBlinking();
  }
});

async function setStatus(msg) {
  const timeStr = new Date().toLocaleTimeString();
  await chrome.storage.local.set({ lastStatus: `[${timeStr}] ${msg}` });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createToolbarIconImageData(size, isLit, dotColor, alpha = 1.0) {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const pad = Math.max(2, Math.floor(size / 8));
  const c = size / 2;
  const outerR = c - pad;

  ctx.beginPath();
  ctx.arc(c, c, outerR, 0, Math.PI * 2);
  ctx.fillStyle = "#5a626e";
  ctx.fill();
  ctx.lineWidth = Math.max(1, Math.floor(size / 16));
  ctx.strokeStyle = "#8c96a5";
  ctx.stroke();

  if (isLit) {
    ctx.save();
    ctx.globalAlpha = Math.max(0.15, Math.min(1.0, alpha));

    ctx.beginPath();
    ctx.arc(c, c, Math.max(3, Math.floor(size * 0.28)), 0, Math.PI * 2);
    ctx.fillStyle = dotColor || "#ff0000";
    ctx.fill();

    const badgeR = Math.max(2.5, Math.floor(size * 0.22));
    ctx.beginPath();
    ctx.arc(size - badgeR - 1, badgeR + 1, badgeR, 0, Math.PI * 2);
    ctx.fillStyle = dotColor || "#ff0000";
    ctx.fill();
    ctx.restore();
  } else {
    ctx.beginPath();
    ctx.arc(c, c, Math.max(2, Math.floor(size / 6)), 0, Math.PI * 2);
    ctx.fillStyle = "#e1e6ee";
    ctx.fill();
  }

  return ctx.getImageData(0, 0, size, size);
}

async function setToolbarSignalVisible(visible, dotColor, alpha = 1.0) {
  try {
    const color = dotColor || "#ff0000";
    if (visible) {
      const img16 = createToolbarIconImageData(16, true, color, alpha);
      const img32 = createToolbarIconImageData(32, true, color, alpha);
      await chrome.action.setIcon({ imageData: { 16: img16, 32: img32 } });
      await chrome.action.setBadgeBackgroundColor({ color });
      await chrome.action.setBadgeText({ text: " " });
    } else {
      await chrome.action.setBadgeText({ text: "" });
      await chrome.action.setIcon({
        path: {
          16: "icons/icon16.png",
          48: "icons/icon48.png",
          128: "icons/icon128.png"
        }
      });
    }
  } catch (_e) {
    // Ignore icon errors
  }
}

function stopToolbarBlinking() {
  toolbarBlinkSession++;
  setToolbarSignalVisible(false, "#787878");
}

async function startToolbarLoadingLoop() {
  stopToolbarBlinking();
  const sessionId = toolbarBlinkSession;
  const alphas = [0.25, 0.55, 0.85, 1.0, 0.85, 0.55];
  let idx = 0;

  while (sessionId === toolbarBlinkSession) {
    const alpha = alphas[idx % alphas.length];
    idx++;
    await setToolbarSignalVisible(alpha >= 0.5, "#000000", alpha);
    await sleep(140);
  }
}

async function startToolbarBlinkLoop(count, dotColor, autoStopMs = 0) {
  stopToolbarBlinking();
  const sessionId = toolbarBlinkSession;
  const startTime = Date.now();

  while (sessionId === toolbarBlinkSession) {
    const current = await chrome.storage.local.get(["enabled", "dotColor"]);
    if (!autoStopMs && !current.enabled) {
      await setToolbarSignalVisible(false, dotColor);
      return;
    }
    if (autoStopMs > 0 && Date.now() - startTime >= autoStopMs) {
      await setToolbarSignalVisible(false, dotColor);
      return;
    }

    const activeColor = current.dotColor || dotColor || "#ff0000";

    for (let i = 0; i < count; i++) {
      if (sessionId !== toolbarBlinkSession) {
        await setToolbarSignalVisible(false, activeColor);
        return;
      }
      await setToolbarSignalVisible(true, activeColor, 1.0);
      await sleep(180);

      await setToolbarSignalVisible(false, activeColor, 1.0);
      if (sessionId !== toolbarBlinkSession) {
        return;
      }
      await sleep(180);
    }

    await sleep(2000);
  }
  await setToolbarSignalVisible(false, dotColor);
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "trigger-solve") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;
    handleCaptureAndSolve({ xRatio: 0.5, yRatio: 0.5, hasCursor: false }, tab);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "CAPTURE_AND_SOLVE") {
    handleCaptureAndSolve(message, sender.tab)
      .then((res) => sendResponse(res))
      .catch((err) => {
        stopToolbarBlinking();
        if (sender.tab && sender.tab.id) {
          chrome.tabs.sendMessage(sender.tab.id, { type: "STOP_BLINK" }, { frameId: 0 }).catch(() => {});
        }
        setStatus(`Error: ${err.message || String(err)}`);
        sendResponse({ ok: false, error: err.message || String(err) });
      });
    return true;
  } else if (message.type === "GLOBAL_STOP_BLINK") {
    stopToolbarBlinking();
    if (sender.tab && sender.tab.id) {
      chrome.tabs.sendMessage(sender.tab.id, { type: "STOP_BLINK" }, { frameId: 0 }).catch(() => {});
    }
    sendResponse({ ok: true });
  } else if (message.type === "TRIGGER_TEST_BLINK") {
    handleTestBlink(message.count || 3, message.tabId)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
});

async function handleTestBlink(count, tabId) {
  const settings = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  const target = settings.blinkTarget || "webpage";
  const color = settings.dotColor || "#ff0000";

  stopToolbarBlinking();
  if (tabId) {
    chrome.tabs.sendMessage(tabId, { type: "STOP_BLINK" }, { frameId: 0 }).catch(() => {});
  }

  if (target === "toolbar" || target === "both") {
    startToolbarBlinkLoop(count, color, 6500);
  }
  if ((target === "webpage" || target === "both") && tabId) {
    await chrome.tabs.sendMessage(tabId, { type: "TEST_BLINK", count }, { frameId: 0 });
  }
}

async function handleCaptureAndSolve(payload, tab) {
  const settings = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  if (!settings.enabled) {
    await setStatus("Ignored trigger (Switch is OFF)");
    return { ok: false, reason: "disabled" };
  }
  if (!settings.apiKey || !settings.apiKey.trim()) {
    stopToolbarBlinking();
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { type: "STOP_BLINK" }, { frameId: 0 }).catch(() => {});
    }
    await setStatus("Missing API key! Click '? Help' for instructions.");
    return { ok: false, error: "Missing API key in extension popup." };
  }

  const target = settings.blinkTarget || "webpage";

  // 1. Capture visible tab screenshot FIRST before showing the webpage loading dot
  stopToolbarBlinking();
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });

  // 2. Start the black fade-in / fade-out "thinking" signal immediately
  if (target === "toolbar" || target === "both") {
    startToolbarLoadingLoop();
  }
  if ((target === "webpage" || target === "both") && tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, { type: "START_LOADING" }, { frameId: 0 }).catch(() => {});
  }

  await setStatus("Thinking (fade in/out black)...");

  // 3. Draw cursor marker on offscreen screenshot & call AI provider
  const annotatedBase64 = await drawCursorMarkerOnScreenshot(
    dataUrl,
    payload.xRatio ?? 0.5,
    payload.yRatio ?? 0.5,
    payload.hasCursor !== false
  );

  const rawKey = settings.apiKey.trim();
  let result;

  if (rawKey.startsWith("gsk_")) {
    result = await callGroqVision(annotatedBase64, rawKey);
  } else if (rawKey.startsWith("sk-or-")) {
    result = await callOpenRouterVision(annotatedBase64, rawKey);
  } else {
    result = await askGeminiWithFallback(
      annotatedBase64,
      rawKey,
      settings.model || "auto",
      settings.cachedWorkingModel || ""
    );
  }

  const { blinkCount, usedModel } = result;
  const letter = String.fromCharCode(64 + blinkCount);
  await setStatus(`Solved (${usedModel}) -> Option ${blinkCount} (${letter}) — blinking ${blinkCount}x [${target}]`);

  // 4. Switch from black fade-in/out loading pulse to the repeating answer blink
  stopToolbarBlinking();
  if (target === "toolbar" || target === "both") {
    startToolbarBlinkLoop(blinkCount, settings.dotColor || "#ff0000", 0);
  }
  if ((target === "webpage" || target === "both") && tab && tab.id) {
    chrome.tabs.sendMessage(
      tab.id,
      { type: "START_BLINK", count: blinkCount },
      { frameId: 0 }
    ).catch(() => {});
  }

  return { ok: true, blinkCount, usedModel };
}

async function drawCursorMarkerOnScreenshot(dataUrl, xRatio, yRatio, drawMarker) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);

  if (drawMarker) {
    const targetX = Math.max(0, Math.min(bitmap.width, Math.round(xRatio * bitmap.width)));
    const targetY = Math.max(0, Math.min(bitmap.height, Math.round(yRatio * bitmap.height)));

    const radius = Math.max(18, Math.round(Math.min(bitmap.width, bitmap.height) * 0.022));
    ctx.save();
    ctx.strokeStyle = "#FF0000";
    ctx.fillStyle = "#FF0000";
    ctx.lineWidth = 4;

    ctx.beginPath();
    ctx.arc(targetX, targetY, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(targetX, targetY, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(targetX - radius - 8, targetY);
    ctx.lineTo(targetX - radius + 4, targetY);
    ctx.moveTo(targetX + radius - 4, targetY);
    ctx.lineTo(targetX + radius + 8, targetY);
    ctx.moveTo(targetX, targetY - radius - 8);
    ctx.lineTo(targetX, targetY - radius + 4);
    ctx.moveTo(targetX, targetY + radius - 4);
    ctx.lineTo(targetX, targetY + radius + 8);
    ctx.stroke();
    ctx.restore();
  }

  const outBlob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.85 });
  const arrayBuffer = await outBlob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

const MC_SYSTEM_PROMPT = [
  "You are an expert multiple-choice exam solver examining a screenshot of a quiz.",
  "If there is a bright RED circle/crosshair marker on the image, solve the question closest to that red marker. Otherwise, solve the main visible multiple-choice question.",
  "Carefully read the question and every option (A, B, C, D, E).",
  "Think step-by-step: evaluate each option to identify the factually and scientifically correct answer.",
  "Identify which 1-based vertical position number that correct choice corresponds to:",
  "  1 = First option (A)",
  "  2 = Second option (B)",
  "  3 = Third option (C)",
  "  4 = Fourth option (D)",
  "  5 = Fifth option (E)",
  "",
  "Conclude with your final answer on a new line in this exact format:",
  "FINAL ANSWER: <digit>",
  "where <digit> is only 1, 2, 3, 4, or 5 (e.g., 'FINAL ANSWER: 4')."
].join("\n");

function parseOptionDigit(rawText, modelName) {
  if (!rawText || !rawText.trim()) {
    throw new Error(`Empty response from ${modelName}`);
  }

  // 1. Strip <think>...</think> if present, but keep original if strip empties it
  const withoutThink = rawText.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const text = withoutThink.length > 0 ? withoutThink : rawText.trim();

  // 2. Look for explicit "FINAL ANSWER: X" or "ANSWER: X"
  const finalMatch = text.match(/(?:FINAL\s+ANSWER|CORRECT\s+ANSWER|ANSWER|OPTION|CHOICE)\s*[:=\-–]?\s*([1-5]|[A-E])\b/i);
  if (finalMatch) {
    const val = finalMatch[1].toUpperCase();
    if (/[1-5]/.test(val)) return parseInt(val, 10);
    return val.charCodeAt(0) - 64;
  }

  // 3. Look at the last non-empty line
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length > 0) {
    const lastLine = lines[lines.length - 1];
    
    // Pattern: "4", "D", "Option 4", "D.", "4."
    const lineMatch = lastLine.match(/^(?:(?:Option|Choice|Answer)\s*[:=\-–]?\s*)?([1-5]|[A-E])[\.\)]?$/i);
    if (lineMatch) {
      const val = lineMatch[1].toUpperCase();
      if (/[1-5]/.test(val)) return parseInt(val, 10);
      return val.charCodeAt(0) - 64;
    }

    // Any explicit letter or digit on the last line
    const lastLineExplicit = lastLine.match(/(?:[Option|Choice|Answer]?\s*[:=\-–]?\s*)?\b([1-5]|[A-E])\b/i);
    if (lastLineExplicit) {
      const val = lastLineExplicit[1].toUpperCase();
      if (/[1-5]/.test(val)) return parseInt(val, 10);
      return val.charCodeAt(0) - 64;
    }
  }

  // 4. Reverse search for the last explicit Option/Answer mention anywhere in text
  const allExplicit = [...text.matchAll(/\b(?:Option|Choice|Answer)\s*[:=\-–]?\s*([1-5]|[A-E])\b/gi)];
  if (allExplicit.length > 0) {
    const lastExp = allExplicit[allExplicit.length - 1][1].toUpperCase();
    if (/[1-5]/.test(lastExp)) return parseInt(lastExp, 10);
    return lastExp.charCodeAt(0) - 64;
  }

  // 5. Fallback: last digit 1-5 in the entire text
  const digitMatches = text.match(/[1-5]/g);
  if (digitMatches && digitMatches.length > 0) {
    return parseInt(digitMatches[digitMatches.length - 1], 10);
  }

  // 6. Fallback: last letter A-E in the entire text
  const letterMatches = text.toUpperCase().match(/\b([A-E])\b/g);
  if (letterMatches && letterMatches.length > 0) {
    const lastLetter = letterMatches[letterMatches.length - 1];
    return lastLetter.charCodeAt(0) - 64;
  }

  throw new Error(`Unparsed (${modelName}): "${text.slice(0, 80)}"`);
}

async function discoverGroqVisionModels(apiKey) {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { "Authorization": `Bearer ${apiKey}` }
    });
    if (!res.ok) return [];
    const data = await res.json();
    const models = (data.data || []).map((m) => m.id);
    return models.filter((id) =>
      /(vision|vl|qwen.*27b|qwen.*32b|scout)/i.test(id) &&
      !/(decommissioned|deprecated|llama-3\.2)/i.test(id)
    );
  } catch (_e) {
    return [];
  }
}

// Free Groq Vision API (keys starting with gsk_...)
async function callGroqVision(base64Jpeg, apiKey) {
  const discovered = await discoverGroqVisionModels(apiKey);
  const fallbackList = [
    "qwen/qwen3.8-27b",
    "qwen/qwen3-vl-32b-instruct",
    "meta-llama/llama-4-scout-17b-16e-instruct"
  ];
  const groqModels = [...new Set([...discovered, ...fallbackList])];

  const errors = [];
  for (const model of groqModels) {
    try {
      let res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          temperature: 0.0,
          max_tokens: 1024,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: MC_SYSTEM_PROMPT },
                {
                  type: "image_url",
                  image_url: { url: `data:image/jpeg;base64,${base64Jpeg}` }
                }
              ]
            }
          ]
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 120)}`);
      }

      const data = await res.json();
      const choice = data?.choices?.[0]?.message;
      const text = (choice?.content || choice?.reasoning || "").trim();
      await chrome.storage.local.set({ lastAiResponse: text });
      return { blinkCount: parseOptionDigit(text, model), usedModel: `groq/${model}` };
    } catch (err) {
      errors.push(`${model} (${err.message || String(err)})`);
    }
  }
  throw new Error(`Groq failed: ${errors.join(" | ")}`);
}

// Free OpenRouter Vision API (keys starting with sk-or-...)
async function callOpenRouterVision(base64Jpeg, apiKey) {
  const orModels = [
    "qwen/qwen2.5-vl-72b-instruct:free",
    "meta-llama/llama-3.2-11b-vision-instruct:free",
    "openrouter/free"
  ];
  let lastErr = null;
  for (const model of orModels) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          temperature: 0.0,
          max_tokens: 1024,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: MC_SYSTEM_PROMPT },
                {
                  type: "image_url",
                  image_url: { url: `data:image/jpeg;base64,${base64Jpeg}` }
                }
              ]
            }
          ]
        })
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenRouter HTTP ${res.status}: ${errText.slice(0, 100)}`);
      }
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content || "";
      await chrome.storage.local.set({ lastAiResponse: text });
      return { blinkCount: parseOptionDigit(text, model), usedModel: model };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("OpenRouter API call failed.");
}

async function discoverModelsFromApi(apiKey) {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    const models = (data.models || [])
      .filter((m) => {
        const name = (m.name || "").replace(/^models\//, "");
        const methods = m.supportedGenerationMethods || [];
        if (!methods.includes("generateContent")) return false;
        if (!name.startsWith("gemini-")) return false;
        if (/(tts|live|transcribe|embedding|imagen|veo|banana|robotics|computer-use|aqa)/i.test(name)) {
          return false;
        }
        return true;
      })
      .map((m) => m.name.replace(/^models\//, ""));

    models.sort((a, b) => {
      const aFlash = a.includes("flash") ? 1 : 0;
      const bFlash = b.includes("flash") ? 1 : 0;
      if (aFlash !== bFlash) return bFlash - aFlash;
      return b.localeCompare(a, undefined, { numeric: true });
    });
    return models;
  } catch (_e) {
    return [];
  }
}

async function askGeminiWithFallback(base64Jpeg, apiKey, selectedModel, cachedModel) {
  const modelsToTry = [];

  if (selectedModel && selectedModel !== "auto" && selectedModel !== "gemini-2.5-flash") {
    modelsToTry.push(selectedModel);
  }
  if (cachedModel && !modelsToTry.includes(cachedModel)) {
    modelsToTry.push(cachedModel);
  }
  for (const m of CANDIDATE_MODELS) {
    if (!modelsToTry.includes(m)) {
      modelsToTry.push(m);
    }
  }

  let lastError = null;
  let sawProjectDenied403 = false;

  // NOTE: Do NOT abort on HTTP 403—continue through all candidate and discovered models!
  for (const modelName of modelsToTry) {
    try {
      const blinkCount = await callSingleGeminiModel(base64Jpeg, apiKey, modelName);
      if (cachedModel !== modelName) {
        await chrome.storage.local.set({ cachedWorkingModel: modelName });
      }
      return { blinkCount, usedModel: modelName };
    } catch (err) {
      lastError = err;
      const msg = String(err.message || err);
      if (msg.includes("denied access")) {
        sawProjectDenied403 = true;
      }
      if (msg.includes("API_KEY_INVALID") || msg.includes("HTTP 401")) {
        throw err;
      }
    }
  }

  const discovered = await discoverModelsFromApi(apiKey);
  for (const modelName of discovered) {
    if (modelsToTry.includes(modelName)) continue;
    try {
      const blinkCount = await callSingleGeminiModel(base64Jpeg, apiKey, modelName);
      await chrome.storage.local.set({ cachedWorkingModel: modelName });
      return { blinkCount, usedModel: modelName };
    } catch (err) {
      lastError = err;
      const msg = String(err.message || err);
      if (msg.includes("denied access")) {
        sawProjectDenied403 = true;
      }
    }
  }

  if (sawProjectDenied403) {
    throw new Error(
      "Google AI Studio blocked this Google Project (HTTP 403 'denied access'). Fix: Click '? Help' to grab a free Groq key (gsk_...) at console.groq.com/keys or create a Gemini key from a different Gmail account."
    );
  }

  throw lastError || new Error("No available Gemini model succeeded.");
}

async function callSingleGeminiModel(base64Jpeg, apiKey, model) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    contents: [
      {
        parts: [
          { text: MC_SYSTEM_PROMPT },
          {
            inline_data: {
              mime_type: "image/jpeg",
              data: base64Jpeg
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.0
    }
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status} (${model}): ${errText.slice(0, 120)}`);
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const textParts = parts.filter((p) => !p.thought && typeof p.text === "string").map((p) => p.text);
  const rawText = (textParts.join(" ") || parts.map((p) => p.text || "").join(" ")).trim();

  await chrome.storage.local.set({ lastAiResponse: rawText });
  return parseOptionDigit(rawText, model);
}
