# 🌍 Earth Information Jukebox

> Bridging accessibility gaps in Earth science through real-time video processing, audio sonification, and speech telemetry.

## 🚀 Overview
The **Earth Information Jukebox** is a full-stack web application designed to transform complex NASA Earth observation data—specifically ISS Lightning observations—into multi-sensory experiences. By translating visual brightness ratios into dynamic audio frequencies and real-time speech synthesis, this tool makes visual satellite telemetry fully accessible to visually impaired researchers and enthusiasts.

---

## 🛠️ Tech Stack

- **Frontend:** React (Vite), HTML5 Canvas, Web Audio API, Web Speech API
- **Backend:** Python, FastAPI, WebSockets
- **Computer Vision & Telemetry:** OpenCV (`cv2`) for real-time frame analysis and pixel intensity extraction

---

## ✨ Key Features

1. **Real-Time Video Telemetry Stream:** FastAPI processes NASA video frames via OpenCV, extracting grayscale brightness ratios and streaming them to the client over WebSockets.
2. **Dynamic Audio Sonification:** Web Audio API maps incoming brightness values into continuous audio frequency shifts (e.g., 200Hz to 1200Hz) with smooth oscillator smoothing.
3. **Accessibility-First Speech Reader:** Integrated Web Speech API (`speechSynthesis`) announces exact frequency and brightness values aloud.
4. **Spacebar Shortcut:** Pressing the **Spacebar** instantly triggers an immediate accessibility read-out of current telemetry without interrupting audio tracks.
5. **Interactive Video Controls:** Includes timeline scrubbing, master volume sliders, live canvas waveform rendering, and fullscreen mode.

---

## ⚙️ Local Installation & Setup

### 1. Clone the Repository
```bash
git clone [https://github.com/YOUR_USERNAME/earth-information-jukebox.git](https://github.com/YOUR_USERNAME/earth-information-jukebox.git)
cd earth-information-jukebox