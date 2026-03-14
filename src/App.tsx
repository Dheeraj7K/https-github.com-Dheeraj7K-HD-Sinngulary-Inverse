/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, RotateCcw, Settings2, Info, ChevronRight, ChevronLeft } from 'lucide-react';

// --- Types ---

interface SimulationState {
  sides: number;
  frequency: number;
  amplitude: number;
  speed: number;
  isPaused: boolean;
  showControls: boolean;
  colorHue: number;
  steps: number;
  autoEvolve: boolean;
  showField: boolean;
  zoom: number;
  showStructure: boolean;
  interferenceDensity: number;
  viewMode: '2D' | '3D';
  rotationX: number;
  rotationY: number;
  dimension: 2 | 3 | 5 | 6 | 8;
}

// --- Constants ---

const MIN_SIDES = 3;
const MAX_SIDES = 1000; // Increased to allow for "1000 steps" of complexity

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<SimulationState>({
    sides: 3,
    frequency: 0.05,
    amplitude: 20,
    speed: 1,
    isPaused: false,
    showControls: true,
    colorHue: 200,
    steps: 0,
    autoEvolve: false,
    showField: true,
    zoom: 1.0,
    showStructure: true,
    interferenceDensity: 5,
    viewMode: '2D',
    rotationX: 45,
    rotationY: 45,
    dimension: 2,
  });

  const requestRef = useRef<number>(null);
  const timeRef = useRef<number>(0);

  // --- Simulation Logic ---

  const draw = (ctx: CanvasRenderingContext2D, width: number, height: number, time: number) => {
    const { sides, frequency, amplitude, colorHue, showField, zoom, showStructure, interferenceDensity, viewMode, rotationX, rotationY, dimension } = state;
    
    // Clear with slight trail effect
    ctx.fillStyle = 'rgba(5, 5, 5, 0.15)';
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.35 * zoom;

    // Helper for 3D projection
    const project = (x: number, y: number, z: number) => {
      if (viewMode === '2D') return { x, y };

      // Center coordinates
      let px = x - centerX;
      let py = y - centerY;
      let pz = z;

      // Rotate Y
      const ry = rotationY * (Math.PI / 180);
      const x1 = px * Math.cos(ry) + pz * Math.sin(ry);
      const z1 = -px * Math.sin(ry) + pz * Math.cos(ry);

      // Rotate X
      const rx = rotationX * (Math.PI / 180);
      const y2 = py * Math.cos(rx) - z1 * Math.sin(rx);
      const z2 = py * Math.sin(rx) + z1 * Math.cos(rx);

      // Perspective
      const scale = 800 / (800 + z2);
      return {
        x: centerX + x1 * scale,
        y: centerY + y2 * scale,
        z: z2
      };
    };

    const getInterference = (px: number, py: number) => {
      let inf = 0;
      
      // Spatial warping for 6D+
      let wx = px;
      let wy = py;
      if (dimension >= 6) {
        const dist = Math.sqrt((px - centerX) ** 2 + (py - centerY) ** 2);
        const twist = Math.sin(dist * 0.01 + time * 0.001) * (dimension === 8 ? 0.5 : 0.2);
        const angle = Math.atan2(py - centerY, px - centerX) + twist;
        wx = centerX + Math.cos(angle) * dist;
        wy = centerY + Math.sin(angle) * dist;
      }

      const interferenceSides = Math.min(sides, 12); 
      for (let i = 0; i < interferenceSides; i++) {
        const angle = (i / interferenceSides) * Math.PI * 2 - Math.PI / 2;
        const nextAngle = ((i + 1) / interferenceSides) * Math.PI * 2 - Math.PI / 2;
        const p1 = { x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius };
        const p2 = { x: centerX + Math.cos(nextAngle) * radius, y: centerY + Math.sin(nextAngle) * radius };
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const t = Math.max(0, Math.min(1, ((wx - p1.x) * dx + (wy - p1.y) * dy) / (dx * dx + dy * dy)));
        const closestX = p1.x + t * dx;
        const closestY = p1.y + t * dy;
        const dist = Math.sqrt((wx - closestX) ** 2 + (wy - closestY) ** 2);
        
        // Phase modulation for 5D+
        const phase = dimension >= 5 ? Math.sin(time * 0.004 + i) * 4 : 0;
        inf += Math.sin(dist * (frequency / zoom) - time * 0.005 + phase) * (amplitude / (dist * 0.1 + 1));

        // Harmonic resonance for 8D
        if (dimension === 8) {
          inf += Math.sin(dist * (frequency / zoom) * 2.5 - time * 0.008) * (amplitude * 0.3 / (dist * 0.05 + 1));
        }
      }

      const distToCenter = Math.sqrt((wx - centerX) ** 2 + (wy - centerY) ** 2);
      inf += Math.sin(distToCenter * (frequency / zoom) * 1.5 - time * 0.01) * (amplitude * 0.8 / (distToCenter * 0.05 + 1));
      
      return inf;
    };

    // Calculate polygon vertices
    const vertices: { x: number; y: number; z: number }[] = [];
    const drawSides = Math.min(sides, 100); 
    for (let i = 0; i < drawSides; i++) {
      const angle = (i / drawSides) * Math.PI * 2 - Math.PI / 2;
      const vx = centerX + Math.cos(angle) * radius;
      const vy = centerY + Math.sin(angle) * radius;
      vertices.push({ x: vx, y: vy, z: 0 });
    }

    // Draw the vibrating edges and interference
    if (showField) {
      const step = viewMode === '3D' ? 12 : 6; // Lower res for 3D to maintain performance
      
      if (viewMode === '3D') {
        // Draw 3D Mesh
        ctx.lineWidth = 1;
        for (let x = centerX - radius * 1.5; x < centerX + radius * 1.5; x += step) {
          ctx.beginPath();
          for (let y = centerY - radius * 1.5; y < centerY + radius * 1.5; y += step) {
            const z = getInterference(x, y) * 5; // Height factor
            const p = project(x, y, z);
            
            if (y === centerY - radius * 1.5) {
              ctx.moveTo(p.x, p.y);
            } else {
              ctx.lineTo(p.x, p.y);
            }
          }
          ctx.strokeStyle = `hsla(${colorHue + x * 0.1}, 80%, 60%, 0.2)`;
          ctx.stroke();
        }

        // Cross lines
        for (let y = centerY - radius * 1.5; y < centerY + radius * 1.5; y += step) {
          ctx.beginPath();
          for (let x = centerX - radius * 1.5; x < centerX + radius * 1.5; x += step) {
            const z = getInterference(x, y) * 5;
            const p = project(x, y, z);
            
            if (x === centerX - radius * 1.5) {
              ctx.moveTo(p.x, p.y);
            } else {
              ctx.lineTo(p.x, p.y);
            }
          }
          ctx.strokeStyle = `hsla(${colorHue + y * 0.1}, 80%, 60%, 0.2)`;
          ctx.stroke();
        }
      } else {
        // 2D View (Existing logic)
        for (let x = 0; x < width; x += step) {
          for (let y = 0; y < height; y += step) {
            const interference = getInterference(x, y);
            const intensity = Math.abs(interference);
            const banding = Math.sin(intensity * interferenceDensity);
            if (banding > 0.4) {
              const alpha = Math.min(banding * 0.3, 0.8);
              ctx.fillStyle = `hsla(${colorHue + interference * 15}, 80%, 60%, ${alpha})`;
              ctx.fillRect(x, y, step - 1, step - 1);
            }
          }
        }
      }
    }

    // Draw the polygon outline
    if (showStructure) {
      ctx.beginPath();
      ctx.strokeStyle = `hsla(${colorHue}, 100%, 70%, ${showField ? 0.5 : 0.9})`;
      ctx.lineWidth = showField ? 2 : 3;
      for (let i = 0; i < drawSides; i++) {
        const p1_raw = vertices[i];
        const p2_raw = vertices[(i + 1) % drawSides];
        
        const p1 = project(p1_raw.x, p1_raw.y, p1_raw.z);
        const p2 = project(p2_raw.x, p2_raw.y, p2_raw.z);

        ctx.moveTo(p1.x, p1.y);
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        const normalX = -(p2.y - p1.y);
        const normalY = (p2.x - p1.x);
        const mag = Math.sqrt(normalX**2 + normalY**2);
        const vib = Math.sin(time * 0.01 + i) * (showField ? 5 : 15); 
        
        ctx.quadraticCurveTo(
          midX + (normalX / mag) * vib,
          midY + (normalY / mag) * vib,
          p2.x, p2.y
        );
      }
      ctx.stroke();
    }

    if (viewMode === '3D') {
      // Draw a small coordinate indicator in the bottom right
      const indicatorX = width - 100;
      const indicatorY = height - 100;
      const size = 30;

      const axes = [
        { x: size, y: 0, z: 0, color: '#ef4444', label: 'X' },
        { x: 0, y: size, z: 0, color: '#22c55e', label: 'Y' },
        { x: 0, y: 0, z: size, color: '#3b82f6', label: 'Z' }
      ];

      axes.forEach(axis => {
        // Simple rotation for indicator
        let ax = axis.x;
        let ay = axis.y;
        let az = axis.z;

        // Rotate Y
        const ry = rotationY * (Math.PI / 180);
        const x1 = ax * Math.cos(ry) + az * Math.sin(ry);
        const z1 = -ax * Math.sin(ry) + az * Math.cos(ry);

        // Rotate X
        const rx = rotationX * (Math.PI / 180);
        const y2 = ay * Math.cos(rx) - z1 * Math.sin(rx);
        
        ctx.beginPath();
        ctx.strokeStyle = axis.color;
        ctx.lineWidth = 2;
        ctx.moveTo(indicatorX, indicatorY);
        ctx.lineTo(indicatorX + x1, indicatorY + y2);
        ctx.stroke();

        ctx.fillStyle = axis.color;
        ctx.font = '10px monospace';
        ctx.fillText(axis.label, indicatorX + x1 + 5, indicatorY + y2 + 5);
      });
    }

    if (viewMode === '2D') {
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 10 + Math.sin(time * 0.02) * 5);
      gradient.addColorStop(0, 'white');
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 15, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const animate = (time: number) => {
    if (!state.isPaused) {
      timeRef.current += state.speed * 16;
      setState(s => ({ ...s, steps: s.steps + 1 }));
      
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx && canvas) {
        draw(ctx, canvas.width, canvas.height, timeRef.current);
      }
    }
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    requestRef.current = requestAnimationFrame(animate);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [state.isPaused, state.speed, state.sides, state.frequency, state.amplitude, state.colorHue]);

  // --- Handlers ---

  const skipSteps = (count: number) => {
    timeRef.current += count * 100; // Jump ahead in simulation time
    setState(s => ({ ...s, steps: s.steps + count }));
  };

  const nextShape = () => {
    setState(s => ({ ...s, sides: Math.min(MAX_SIDES, s.sides + 1) }));
  };

  const prevShape = () => {
    setState(s => ({ ...s, sides: Math.max(MIN_SIDES, s.sides - 1) }));
  };

  return (
    <div className="relative w-full h-screen bg-[#050505] overflow-hidden font-sans text-white">
      {/* Background Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        id="simulation-canvas"
      />

      {/* Overlay UI */}
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-8">
        {/* Header */}
        <header className="flex justify-between items-start pointer-events-auto">
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tighter uppercase italic text-white/90">
              Cymatic <span className="text-emerald-500">Interference</span>
            </h1>
            <div className="flex items-center gap-3">
              <p className="text-xs font-mono uppercase tracking-widest text-white/40">
                Wave Propagation Simulation // v0.012
              </p>
              <div className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] font-mono text-emerald-500">
                STEP: {state.steps.toLocaleString()}
              </div>
            </div>
          </div>
          
          <div className="flex gap-4">
            <button 
              onClick={() => skipSteps(1000)}
              className="px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors text-[10px] font-bold uppercase tracking-widest text-emerald-500"
              id="skip-1000"
            >
              Skip 1000 Steps
            </button>
            <button 
              onClick={() => setState(s => ({ ...s, showControls: !s.showControls }))}
              className="p-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              id="toggle-controls"
            >
              <Settings2 size={20} />
            </button>
          </div>
        </header>

        {/* Bottom Navigation & Stats */}
        <div className="flex justify-between items-end pointer-events-auto">
          <div className="flex items-center gap-6 bg-black/40 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl">
            <div className="flex flex-col">
              <span className="text-[10px] font-mono uppercase tracking-tighter text-white/40">Current Geometry</span>
              <div className="flex items-center gap-4">
                <button 
                  onClick={prevShape}
                  disabled={state.sides <= MIN_SIDES}
                  className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-20 transition-all"
                  id="prev-shape"
                >
                  <ChevronLeft size={24} />
                </button>
                <div className="w-24 text-center">
                  <span className="text-4xl font-black italic">
                    {state.sides === 3 ? 'TRI' : 
                     state.sides === 4 ? 'SQR' : 
                     state.sides === 5 ? 'PENT' : 
                     state.sides === 6 ? 'HEX' : 
                     state.sides === 7 ? 'SEPT' : 
                     state.sides === 8 ? 'OCT' : 
                     state.sides > 100 ? 'CIRC' :
                     `${state.sides}-GON`}
                  </span>
                </div>
                <button 
                  onClick={nextShape}
                  disabled={state.sides >= MAX_SIDES}
                  className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-20 transition-all"
                  id="next-shape"
                >
                  <ChevronRight size={24} />
                </button>
              </div>
            </div>

            <div className="h-12 w-px bg-white/10" />

            <div className="flex gap-4">
              <button 
                onClick={() => setState(s => ({ ...s, isPaused: !s.isPaused }))}
                className="w-14 h-14 rounded-2xl bg-emerald-500 text-black flex items-center justify-center hover:scale-105 transition-transform shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                id="play-pause"
              >
                {state.isPaused ? <Play fill="currentColor" size={24} /> : <Pause fill="currentColor" size={24} />}
              </button>
              <button 
                onClick={() => {
                  timeRef.current = 0;
                  setState(s => ({ ...s, frequency: 0.05, amplitude: 20, sides: 3, steps: 0 }));
                }}
                className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
                id="reset"
              >
                <RotateCcw size={24} />
              </button>
            </div>
          </div>

          <div className="hidden md:flex flex-col items-end gap-2 text-right">
            <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <span className="text-[10px] font-mono text-emerald-500 uppercase font-bold tracking-widest">Active Interference</span>
            </div>
            <p className="text-xs text-white/30 max-w-[200px] leading-relaxed">
              Vibrating edges at {state.frequency.toFixed(3)} THz creating harmonic resonance patterns across the field.
            </p>
          </div>
        </div>
      </div>

      {/* Controls Sidebar */}
      <AnimatePresence>
        {state.showControls && (
          <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            className="absolute right-8 top-24 w-72 bg-black/60 backdrop-blur-2xl p-8 rounded-[2rem] border border-white/10 shadow-3xl pointer-events-auto"
            id="controls-panel"
          >
            <div className="space-y-8">
              <div className="flex items-center gap-2 mb-4">
                <Settings2 size={16} className="text-emerald-500" />
                <h2 className="text-sm font-bold uppercase tracking-widest">Parameters</h2>
              </div>

              {/* Dimension Selector */}
              <div className="flex items-center justify-between pt-2">
                <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Complexity (D)</label>
                <div className="flex bg-white/5 p-1 rounded-lg border border-white/10 gap-1">
                  {[2, 5, 6, 8].map((d) => (
                    <button
                      key={d}
                      onClick={() => setState(s => ({ ...s, dimension: d as any, viewMode: d > 2 ? '3D' : s.viewMode }))}
                      className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${state.dimension === d ? 'bg-emerald-500 text-black' : 'text-white/40 hover:text-white'}`}
                    >
                      {d}D
                    </button>
                  ))}
                </div>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center justify-between pt-2">
                <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">View Mode</label>
                <div className="flex bg-white/5 p-1 rounded-lg border border-white/10">
                  <button
                    onClick={() => setState(s => ({ ...s, viewMode: '2D' }))}
                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${state.viewMode === '2D' ? 'bg-emerald-500 text-black' : 'text-white/40 hover:text-white'}`}
                  >
                    2D
                  </button>
                  <button
                    onClick={() => setState(s => ({ ...s, viewMode: '3D' }))}
                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${state.viewMode === '3D' ? 'bg-emerald-500 text-black' : 'text-white/40 hover:text-white'}`}
                  >
                    3D
                  </button>
                </div>
              </div>

              {state.viewMode === '3D' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-6 pt-2"
                >
                  {/* Rotation X */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Tilt (X)</label>
                      <span className="text-xs font-mono text-emerald-500">{state.rotationX}°</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="90"
                      step="1"
                      value={state.rotationX}
                      onChange={(e) => setState(s => ({ ...s, rotationX: parseInt(e.target.value) }))}
                      className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>
                  {/* Rotation Y */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Spin (Y)</label>
                      <span className="text-xs font-mono text-emerald-500">{state.rotationY}°</span>
                    </div>
                    <input
                      type="range"
                      min="-180"
                      max="180"
                      step="1"
                      value={state.rotationY}
                      onChange={(e) => setState(s => ({ ...s, rotationY: parseInt(e.target.value) }))}
                      className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>
                </motion.div>
              )}

              {/* Frequency Slider */}
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Frequency</label>
                  <span className="text-xs font-mono text-emerald-500">{(state.frequency * 1000).toFixed(1)} GHz</span>
                </div>
                <input
                  type="range"
                  min="0.01"
                  max="0.15"
                  step="0.001"
                  value={state.frequency}
                  onChange={(e) => setState(s => ({ ...s, frequency: parseFloat(e.target.value) }))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  id="frequency-slider"
                />
              </div>

              {/* Amplitude Slider */}
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Amplitude</label>
                  <span className="text-xs font-mono text-emerald-500">{state.amplitude.toFixed(0)} ft</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="1"
                  value={state.amplitude}
                  onChange={(e) => setState(s => ({ ...s, amplitude: parseFloat(e.target.value) }))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  id="amplitude-slider"
                />
              </div>

              {/* Hue Slider */}
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Spectrum</label>
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: `hsl(${state.colorHue}, 80%, 60%)` }} />
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="1"
                  value={state.colorHue}
                  onChange={(e) => setState(s => ({ ...s, colorHue: parseInt(e.target.value) }))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  id="hue-slider"
                />
              </div>

              {/* Zoom Slider */}
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Zoom Level</label>
                  <span className="text-xs font-mono text-emerald-500">{state.zoom.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="2.0"
                  step="0.01"
                  value={state.zoom}
                  onChange={(e) => setState(s => ({ ...s, zoom: parseFloat(e.target.value) }))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  id="zoom-slider"
                />
              </div>

              {/* Interference Detail Slider */}
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Interference Detail</label>
                  <span className="text-xs font-mono text-emerald-500">{state.interferenceDensity.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="0.5"
                  value={state.interferenceDensity}
                  onChange={(e) => setState(s => ({ ...s, interferenceDensity: parseFloat(e.target.value) }))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  id="density-slider"
                />
              </div>

              {/* Speed Slider */}
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Temporal Flow</label>
                  <span className="text-xs font-mono text-emerald-500">{state.speed.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="3"
                  step="0.1"
                  value={state.speed}
                  onChange={(e) => setState(s => ({ ...s, speed: parseFloat(e.target.value) }))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  id="speed-slider"
                />
              </div>

              {/* Toggles Group */}
              <div className="space-y-3 pt-2">
                {/* Show Field Toggle */}
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Show Field Grid</label>
                  <button
                    onClick={() => setState(s => ({ ...s, showField: !s.showField }))}
                    className={`w-12 h-6 rounded-full transition-colors relative ${state.showField ? 'bg-emerald-500' : 'bg-white/10'}`}
                    id="toggle-field"
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${state.showField ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                {/* Show Structure Toggle */}
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Show Structure Frame</label>
                  <button
                    onClick={() => setState(s => ({ ...s, showStructure: !s.showStructure }))}
                    className={`w-12 h-6 rounded-full transition-colors relative ${state.showStructure ? 'bg-emerald-500' : 'bg-white/10'}`}
                    id="toggle-structure"
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${state.showStructure ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5">
                <div className="flex items-start gap-3 opacity-40">
                  <Info size={14} className="mt-0.5" />
                  <p className="text-[10px] leading-relaxed">
                    Higher frequencies create denser interference patterns. Adjust amplitude to control wave depth.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Grid Overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" 
           style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
    </div>
  );
}
