# ExamAnswerAI 🎓⚡
> **Discreet, AI-powered multiple-choice question solver for Microsoft Edge (Manifest V3).**

ExamAnswerAI is a lightweight browser extension that reads multiple-choice questions on your screen using state-of-the-art vision models (Groq LPU, Google Gemini 3, OpenRouter) and communicates the correct option through subtle visual signals.

---

## 🎬 Demo

<p align="center">
  <video src="https://github.com/jazzkentjana/ExamAnswerAI/raw/main/demo.mp4" controls="controls" width="100%" autoplay loop muted>
    Your browser does not support the video tag.
  </video>
</p>

---

## 🎯 How It Works

1. **Aim with Your Cursor:** Hover your mouse near the multiple-choice question you want answered.
2. **Press Backspace:** Hit `Backspace` to trigger.
3. **Offscreen Screenshot & Targeting:** The extension captures the visible tab offscreen and draws a bright crosshair at your cursor position on the hidden image so the AI knows exactly which question you are looking at—even on multi-question pages.
4. **Thinking Phase:** A subtle dot in the top-right corner fades in and out in **black** while the AI reads and reasons through the choices.
5. **Answer Signal:** The dot flashes in your chosen color (e.g., Bright Red) corresponding to the correct answer. Click anywhere on the page to stop the blinking.

---

## 💡 How to Read the Signals

The signal pulses `N` times, pauses for 2 seconds, and repeats:

| Signal | Answer Choice | Description |
| :---: | :---: | :--- |
| **1× Blink** | **Option A** | First option from the top / left |
| **2× Blinks** | **Option B** | Second option |
| **3× Blinks** | **Option C** | Third option |
| **4× Blinks** | **Option D** | Fourth option |
| **5× Blinks** | **Option E** | Fifth option |

> **Stop Signal:** Clicking anywhere on the page (`mousedown`) or pressing `Backspace` again instantly clears the blinking.

---

## 🥷 Stealth & Customization Features

- **Custom Dot Size:** Resize the signal dot from **`2 × 2 px`** (practically invisible on high-DPI displays) up to **`6 × 6 px`**.
- **Zero DOM Injections:** Built using `document.adoptedStyleSheets` attached to `html::after`. No elements or `<div>` tags are injected into `document.body`, making it invisible to web-page anti-cheat inspection scripts.
- **Multiple Signal Modes:**
  - **Webpage Dot:** Blinks in the extreme top-right corner of the webpage (`3px` from edge).
  - **Toolbar Icon:** Blinks the pinned extension icon and badge right in the Edge toolbar (completely off the webpage).
  - **Both:** Simultaneous webpage dot and toolbar icon blinking.
- **Discreet Color Palette:** Choose from **Bright Red** (`#ff0000`), **Neutral Gray** (`#787878`), **Dark Charcoal** (`#4a4a4a`), or **Light Silver** (`#a0a0a0`).
- **AI Reasoning Inspector:** The extension popup includes a diagnostic readout displaying the model's step-by-step reasoning for complete transparency.

---

## 🚀 Installation & Setup

### 1. Load into Microsoft Edge (Mac & Windows)
1. Download or clone this repository:
   ```bash
   git clone https://github.com/jazzkentjana/ExamAnswerAI.git
   ```
2. Open Microsoft Edge and navigate to:
   ```text
   edge://extensions
   ```
3. Enable **Developer mode** (toggle in the left sidebar or top-right).
4. Click **Load unpacked** and select the `ExamAnswerAI` folder (containing `manifest.json`).
5. Pin the extension to your toolbar for easy access.

---

### 2. Choose Your Free AI Vision Provider

Open the extension popup and enter your API key:

| Provider | Recommended Key | Speed | Free Tier Details |
| :--- | :--- | :---: | :--- |
| **Groq Cloud (Recommended)** | `gsk_...` | **~350 ms** | 100% Free, no credit card required. Uses ultra-fast LPU inference (`qwen/qwen3.8-27b`). Get key at [console.groq.com/keys](https://console.groq.com/keys). |
| **Google Gemini** | `AIzaSy...` | **~1.2 s** | Free tier on Google AI Studio. Powered by `gemini-3.8-flash` and `gemini-3.5-flash-lite`. Get key at [aistudio.google.com](https://aistudio.google.com/app/apikey). |
| **OpenRouter** | `sk-or-...` | **~2.5 s** | Free vision models (`qwen2.5-vl-72b-instruct:free`). Get key at [openrouter.ai](https://openrouter.ai/keys). |

---

## 🛠️ Architecture & Tech Stack

- **Manifest V3:** Modern Chromium background service worker.
- **OffscreenCanvas:** In-memory image processing and cursor coordinate normalization.
- **adoptedStyleSheets:** Native CSS-in-JS injection without DOM alteration.
- **Dynamic Model Discovery:** Auto-discovers active vision endpoints on your API key to prevent breaking on model deprecations.
- **Frame Traversal:** Runs with `"all_frames": true` to support questions inside nested iframes.

---

## 📄 License
MIT License. Created for educational and research purposes.
