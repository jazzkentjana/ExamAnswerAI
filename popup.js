const enabledToggle = document.getElementById("enabledToggle");
const statusPill = document.getElementById("statusPill");
const apiKeyInput = document.getElementById("apiKey");
const modelSelect = document.getElementById("modelSelect");
const dotSizeSelect = document.getElementById("dotSize");
const dotColorSelect = document.getElementById("dotColor");
const blinkTargetBtns = document.querySelectorAll("#blinkTargetGroup .seg-btn");
const saveBtn = document.getElementById("saveBtn");
const testBtn = document.getElementById("testBtn");
const helpBtn = document.getElementById("helpBtn");
const howToKeyLink = document.getElementById("howToKeyLink");
const savedMsg = document.getElementById("savedMsg");
const lastStatusText = document.getElementById("lastStatusText");
const aiResponseWrap = document.getElementById("aiResponseWrap");
const aiResponseText = document.getElementById("aiResponseText");

let currentBlinkTarget = "webpage";

function updatePill(isOn) {
  statusPill.textContent = isOn ? "ON" : "OFF";
  statusPill.className = isOn ? "status-pill on" : "status-pill";
}

function updateBlinkTargetUI(target) {
  currentBlinkTarget = target || "webpage";
  blinkTargetBtns.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.target === currentBlinkTarget);
  });
}

function openHelpTab() {
  chrome.tabs.create({ url: chrome.runtime.getURL("help.html") });
}

helpBtn.addEventListener("click", openHelpTab);
howToKeyLink.addEventListener("click", openHelpTab);

blinkTargetBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.target;
    updateBlinkTargetUI(target);
    chrome.storage.local.set({ blinkTarget: target });
    savedMsg.textContent = `Signal location: ${btn.textContent}`;
    setTimeout(() => (savedMsg.textContent = ""), 1500);
  });
});

chrome.storage.local.get(
  ["enabled", "apiKey", "model", "blinkTarget", "dotSize", "dotColor", "lastStatus", "lastAiResponse"],
  (data) => {
    const isOn = Boolean(data.enabled);
    enabledToggle.checked = isOn;
    updatePill(isOn);
    if (data.apiKey) apiKeyInput.value = data.apiKey;
    if (data.model && data.model !== "gemini-2.5-flash") {
      modelSelect.value = data.model;
    } else {
      modelSelect.value = "auto";
    }
    updateBlinkTargetUI(data.blinkTarget || "webpage");
    if (data.dotSize) dotSizeSelect.value = String(data.dotSize);
    if (data.dotColor) dotColorSelect.value = data.dotColor;
    if (data.lastStatus) lastStatusText.textContent = data.lastStatus;
    if (data.lastAiResponse) {
      aiResponseText.textContent = data.lastAiResponse;
      aiResponseWrap.style.display = "block";
    }
  }
);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") {
    if (changes.lastStatus) {
      lastStatusText.textContent = changes.lastStatus.newValue || "Ready";
    }
    if (changes.lastAiResponse) {
      if (changes.lastAiResponse.newValue) {
        aiResponseText.textContent = changes.lastAiResponse.newValue;
        aiResponseWrap.style.display = "block";
      } else {
        aiResponseWrap.style.display = "none";
      }
    }
  }
});

apiKeyInput.addEventListener("input", () => {
  chrome.storage.local.set({ apiKey: apiKeyInput.value.trim(), cachedWorkingModel: "" });
});

modelSelect.addEventListener("change", () => {
  chrome.storage.local.set({ model: modelSelect.value, cachedWorkingModel: "" });
});

dotSizeSelect.addEventListener("change", () => {
  chrome.storage.local.set({ dotSize: parseInt(dotSizeSelect.value, 10) });
});

dotColorSelect.addEventListener("change", () => {
  chrome.storage.local.set({ dotColor: dotColorSelect.value });
});

enabledToggle.addEventListener("change", () => {
  const isOn = enabledToggle.checked;
  updatePill(isOn);
  chrome.storage.local.set({
    enabled: isOn,
    apiKey: apiKeyInput.value.trim()
  });
  savedMsg.textContent = isOn ? "Service enabled" : "Service stopped";
  setTimeout(() => (savedMsg.textContent = ""), 1500);
});

saveBtn.addEventListener("click", () => {
  chrome.storage.local.set(
    {
      enabled: enabledToggle.checked,
      apiKey: apiKeyInput.value.trim(),
      model: modelSelect.value,
      cachedWorkingModel: "",
      blinkTarget: currentBlinkTarget,
      dotSize: parseInt(dotSizeSelect.value, 10),
      dotColor: dotColorSelect.value
    },
    () => {
      savedMsg.textContent = "Settings saved!";
      setTimeout(() => (savedMsg.textContent = ""), 1500);
    }
  );
});

testBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    await chrome.runtime.sendMessage({
      type: "TRIGGER_TEST_BLINK",
      count: 3,
      tabId: tab ? tab.id : null
    });
    savedMsg.textContent = "Testing 3× blink (click page to stop)";
  } catch (_e) {
    savedMsg.textContent = "Refresh the webpage once after installing!";
  }
});
