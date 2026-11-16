import React, { useEffect, useState, useRef } from 'react';
import './App.css';

export default function App() {
  const [status, setStatus] = useState('OFFLINE');
  const [brightness, setBrightness] = useState(0);
  const [frequency, setFrequency] = useState(220);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(50);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [selectedDataset, setSelectedDataset] = useState('lightning');
  const [screenReaderText, setScreenReaderText] = useState('System idle. Select dataset and press Spacebar to hear telemetry.');

  // Refs
  const audioCtxRef = useRef(null);
  const oscillatorRef = useRef(null);
  const gainNodeRef = useRef(null);
  const wsRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const lastSpokenRef = useRef(0);

  const freqRef = useRef(frequency);
  const brightRef = useRef(brightness);
  const datasetRef = useRef(selectedDataset);
  freqRef.current = frequency;
  brightRef.current = brightness;
  datasetRef.current = selectedDataset;

  const speakGuidance = (text, force = false) => {
    if (!('speechSynthesis' in window)) return;
    const now = Date.now();
    if (force || now - lastSpokenRef.current > 4000) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.1;
      window.speechSynthesis.speak(utterance);
      lastSpokenRef.current = now;
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        const datasetName = datasetRef.current === 'aerosols' ? 'Geo Aerosols' : datasetRef.current === 'clouds' ? 'Cloud Top Pressure' : 'ISS Lightning';
        const announcement = `Dataset: ${datasetName}. Frequency: ${freqRef.current} hertz, value ratio: ${brightRef.current.toFixed(3)}.`;
        setScreenReaderText(announcement);
        speakGuidance(announcement, true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      } else if (videoRef.current.webkitRequestFullscreen) {
        videoRef.current.webkitRequestFullscreen();
      }
    }
  };

  const handleVolumeChange = (e) => {
    const newVol = e.target.value;
    setVolume(newVol);
    if (gainNodeRef.current && audioCtxRef.current) {
      gainNodeRef.current.gain.setValueAtTime(newVol / 500, audioCtxRef.current.currentTime);
    }
  };

  const handleDatasetChange = (e) => {
    const newDs = e.target.value;
    setSelectedDataset(newDs);
    const label = newDs === 'aerosols' ? 'Geo Aerosols Optical Depth' : newDs === 'clouds' ? 'Global Cloud Top Pressure' : 'ISS Lightning Events';
    const msg = `Switched active dataset to ${label}.`;
    setScreenReaderText(msg);
    speakGuidance(msg, true);
  };

  const handleTimeSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  const formatTime = (secs) => {
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // Waveform Visualizer with Dynamic Dataset Colors
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationId;

    const draw = () => {
      ctx.fillStyle = '#070514';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (isPlaying) {
        ctx.strokeStyle = selectedDataset === 'aerosols' ? '#ffaa00' : selectedDataset === 'clouds' ? '#00aaff' : '#00ffcc';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        const sliceWidth = canvas.width / 50;
        let x = 0;

        for (let i = 0; i < 50; i++) {
          const v = Math.random() * (brightness + 0.2);
          const y = (v * canvas.height) / 2 + (Math.sin(i + Date.now() * 0.01) * 12);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.stroke();
      }
      animationId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, brightness, selectedDataset]);

  const toggleAudioPlayback = () => {
    if (!isPlaying) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      
      oscillatorRef.current = audioCtxRef.current.createOscillator();
      gainNodeRef.current = audioCtxRef.current.createGain();

      if (selectedDataset === 'aerosols') {
        oscillatorRef.current.type = 'triangle';
      } else {
        oscillatorRef.current.type = 'sine';
      }

      oscillatorRef.current.frequency.setValueAtTime(frequency, audioCtxRef.current.currentTime);
      gainNodeRef.current.gain.setValueAtTime(volume / 500, audioCtxRef.current.currentTime);

      oscillatorRef.current.connect(gainNodeRef.current);
      gainNodeRef.current.connect(audioCtxRef.current.destination);

      oscillatorRef.current.start();
      setIsPlaying(true);
      setStatus('ONLINE');

      if (videoRef.current) {
        videoRef.current.play();
      }

      const startMsg = `Streaming active. Sonifying ${selectedDataset} telemetry feed. Press Spacebar anytime to hear current values.`;
      setScreenReaderText(startMsg);
      speakGuidance(startMsg, true);

      wsRef.current = new WebSocket(`ws://127.0.0.1:8000/ws/stream?dataset=${selectedDataset}`);

      wsRef.current.onopen = () => setStatus('ONLINE');
      wsRef.current.onclose = () => setStatus('OFFLINE');

      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.brightness !== undefined) {
          const brightVal = data.brightness;
          
          let mappedFreq = 220;
          if (selectedDataset === 'aerosols') {
            mappedFreq = Math.round(150 + brightVal * 650);
          } else if (selectedDataset === 'clouds') {
            mappedFreq = Math.round(300 + brightVal * 1200);
          } else {
            mappedFreq = Math.round(200 + brightVal * 1000);
          }
          
          setBrightness(brightVal);
          setFrequency(mappedFreq);

          if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
            setDuration(videoRef.current.duration || 0);
          }

          if (oscillatorRef.current && audioCtxRef.current) {
            oscillatorRef.current.frequency.setTargetAtTime(
              mappedFreq, 
              audioCtxRef.current.currentTime, 
              0.05
            );
          }
        }
      };
    } else {
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (videoRef.current) {
        videoRef.current.pause();
      }
      setIsPlaying(false);
      setStatus('OFFLINE');
      
      const stopMsg = 'System paused. Ready to stream data.';
      setScreenReaderText(stopMsg);
      speakGuidance(stopMsg, true);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div>
          <h1>Earth Information Jukebox</h1>
          <p>Bridging accessibility gaps in Earth science through real-time sonification.</p>
        </div>
        <div className={`status-badge ${status.toLowerCase()}`}>
          {status}
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '25px' }}>
        {/* Left Column: Video & Waveform */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
            <video 
              ref={videoRef}
              src={`/${selectedDataset}.mp4`} 
              loop 
              muted 
              playsInline 
              onTimeUpdate={() => videoRef.current && setCurrentTime(videoRef.current.currentTime)}
              style={{ width: '100%', display: 'block', background: '#000' }}
            />
            <div style={{ padding: '14px 18px', background: 'rgba(10, 8, 20, 0.9)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#a0aec0', fontFamily: 'monospace' }}>{formatTime(currentTime)} / {formatTime(duration || 216)}</span>
                <button onClick={toggleFullscreen} style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>Fullscreen</button>
              </div>
              <input 
                type="range" 
                min="0" 
                max={duration || 100} 
                value={currentTime} 
                onChange={handleTimeSeek} 
                style={{ cursor: 'pointer' }} 
              />
            </div>
          </div>

          <div className="glass-panel">
            <h3>Live Sonification Waveform</h3>
            <canvas ref={canvasRef} width="500" height="120" style={{ width: '100%', borderRadius: '8px', background: '#070514', display: 'block' }} />
          </div>
        </div>

        {/* Right Column: Controls, Telemetry & Accessibility */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-panel">
            <h3>Mission Controls</h3>
            
            <div style={{ marginBottom: '18px' }}>
              <label>SELECT NASA DATASET</label>
              <select value={selectedDataset} onChange={handleDatasetChange}>
                <option value="lightning">ISS Lightning Events</option>
                <option value="aerosols">Geo Aerosols Optical Depth</option>
                <option value="clouds">Global Cloud Top Pressure</option>
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label>MASTER VOLUME: {volume}%</label>
              <input type="range" min="0" max="100" value={volume} onChange={handleVolumeChange} />
            </div>

            <button onClick={toggleAudioPlayback} className="play-btn">
              {isPlaying ? '⏹ Stop Data Track' : '▶ Play Data Track'}
            </button>
          </div>

          <div className="glass-panel">
            <h3>Live Telemetry Stream</h3>
            <div className="telemetry-row">
              <span>Value Ratio:</span>
              <strong>{brightness.toFixed(3)}</strong>
            </div>
            <div className="telemetry-row" style={{ borderBottom: 'none' }}>
              <span>Audio Frequency:</span>
              <strong>{frequency} Hz</strong>
            </div>
          </div>

          <div className="glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: 0 }}>Screen Reader Feed</h3>
              <span style={{ fontSize: '10px', background: 'rgba(0, 255, 204, 0.15)', color: '#00ffcc', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(0,255,204,0.3)' }}>Spacebar Active</span>
            </div>
            <p className="screen-reader-feed">{screenReaderText}</p>
          </div>
        </div>
      </div>
    </div>
  );
}