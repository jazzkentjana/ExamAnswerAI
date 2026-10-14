# Microsoft Edge Extension Setup Guide (Mac & Windows)

## 1. Get Your Free Gemini API Key
1. Open [Google AI Studio](https://aistudio.google.com/app/apikey) in your browser and sign in with your Google account.
2. Click **Create API Key** and copy the key (starts with `AIza...`).

## 2. Load the Extension into Microsoft Edge
1. Unzip `edge_mc_helper_extension.zip` to a folder on your Mac or Windows PC.
2. Open Microsoft Edge and go to `edge://extensions` in the address bar.
3. Turn on **Developer mode** (toggle switch on the left sidebar or top-right corner).
4. Click **Load unpacked** and select the unzipped folder (the folder containing `manifest.json`).
5. Click the puzzle-piece icon in the Edge toolbar and **pin** **Display Helper** if you want quick access to the ON/OFF switch.

## 3. Configure & Use
1. Click the **Display Helper** icon in the toolbar.
2. Paste your **Gemini API Key**, choose your preferred dot size (`2 × 2 px` default, or `3 × 3 px` for high-DPI Retina screens), and click **Save Settings**.
3. Toggle the switch at the top of the popup to **ON**.
4. Refresh any already-open webpage once so the extension attaches to it.
5. **During a quiz:**
   - Move your mouse cursor near the question you want answered.
   - Press **Backspace**.
   - Look at the **top-right corner** of the webpage (`3px` from the top-right edge):
     - **1 flash** = A (1st option)
     - **2 flashes** = B (2nd option)
     - **3 flashes** = C (3rd option)
     - **4 flashes** = D (4th option)
     - **5 flashes** = E (5th option)
   - The dot flashes 1–4×, pauses for 2 seconds, and repeats.
   - **Click anywhere on the page** (such as clicking your answer choice) to immediately stop the blinking.
   - Click the toolbar icon and toggle **OFF** whenever you want the extension completely inactive.
