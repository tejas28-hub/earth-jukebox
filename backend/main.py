from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import asyncio
import numpy as np
import cv2
import os
import json

app = FastAPI()

VIDEO_PATH = "lightning.mp4"
video_capture = None

def get_video_frame():
    global video_capture
    if video_capture is None or not video_capture.isOpened():
        if not os.path.exists(VIDEO_PATH):
             return None
        video_capture = cv2.VideoCapture(VIDEO_PATH)
    ret, frame = video_capture.read()
    if not ret:
        video_capture.set(cv2.CAP_PROP_POS_FRAMES, 0)
        ret, frame = video_capture.read()
    return frame

def process_lightning_frame():
    frame = get_video_frame()
    if frame is None:
        return 100.0, 0.0 
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY)
    flash_ratio = np.sum(thresh == 255) / thresh.size
    frequency = 100 + (flash_ratio * 70000) 
    frequency = min(max(frequency, 100), 800)
    return frequency, flash_ratio

def generate_audio_chunk(frequency, duration=0.1, sample_rate=44100):
    t = np.linspace(0, duration, int(sample_rate * duration), False)
    tone = np.sin(frequency * t * 2 * np.pi)
    fade = np.linspace(1.0, 0.0, len(tone))
    tone = tone * fade
    audio_pcm = np.int16(tone * 32767)
    return audio_pcm.tobytes()

@app.websocket("/ws/stream")
async def audio_stream(websocket: WebSocket):
    await websocket.accept()
    print("React UI Connected! Streaming multiplexed telemetry and audio...")
    try:
        while True:
            frequency, flash_ratio = process_lightning_frame()
            telemetry = {"frequency": round(frequency, 2), "brightness": round(flash_ratio, 5)}
            await websocket.send_text(json.dumps(telemetry))
            audio_bytes = generate_audio_chunk(frequency)
            await websocket.send_bytes(audio_bytes)
            await asyncio.sleep(0.1)
    except WebSocketDisconnect:
        print("React UI Disconnected.")