import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { motion, AnimatePresence } from 'motion/react';
import { Sun, Globe, Moon, Play, Pause, RotateCcw, Info, Settings } from 'lucide-react';

// --- Constants ---
const SUN_RADIUS = 25;
const EARTH_RADIUS = 15; // Further increased for visibility
const MOON_RADIUS = 8; // Further increased for visibility
const EARTH_ORBIT_RADIUS = 200; // Adjusted for larger planets
const MOON_ORBIT_RADIUS = 45; // Adjusted for larger planets

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [speed, setSpeed] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const phaseTextRef = useRef<HTMLSpanElement>(null);

  // Refs to hold Three.js objects for access outside the main useEffect
  const sceneObjects = useRef<{
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    earthGroup: THREE.Group;
    sun: THREE.Mesh;
    moon: THREE.Mesh;
    hologramGroup: THREE.Group;
  } | null>(null);

  const speedRef = useRef(speed);
  const isPausedRef = useRef(isPaused);
  const showLabelsRef = useRef(showLabels);

  useEffect(() => {
    speedRef.current = speed;
    isPausedRef.current = isPaused;
    showLabelsRef.current = showLabels;
  }, [speed, isPaused, showLabels]);

  useEffect(() => {
    if (!mountRef.current) return;
    
    // Clear any existing content to prevent double-mounting issues
    const container = mountRef.current;
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // --- 1. Scene Setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030307); // Slightly lighter than black to confirm rendering

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 5000);
    camera.position.set(250, 200, 400);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Ensure the canvas doesn't capture focus in a way that blocks UI
    renderer.domElement.style.outline = 'none';

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 50;
    controls.maxDistance = 1500;

    // --- 2. Lighting ---
    const sunLight = new THREE.PointLight(0xffffff, 100000, 3000); // Even more intensity for clarity
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 2000;
    scene.add(sunLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.02); // Even lower for maximum contrast
    scene.add(ambientLight);

    // --- 3. Objects ---
    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin('anonymous');

    // Real textures from Three.js examples (NASA assets)
    const earthTexture = textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg');
    const moonTexture = textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/moon_1024.jpg');

    // Label Sprite Canvas Setup
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 512;
    labelCanvas.height = 128;
    const labelCtx = labelCanvas.getContext('2d');
    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    const labelSpriteMaterial = new THREE.SpriteMaterial({ 
      map: labelTexture, 
      transparent: true,
      depthTest: false,
      opacity: 0.9
    });
    const labelSprite = new THREE.Sprite(labelSpriteMaterial);
    labelSprite.scale.set(80, 20, 1); // Reduced scale for a cleaner look
    labelSprite.position.set(0, 28, 0); // Positioned even higher above the moon

    const starGeometry = new THREE.BufferGeometry();
    const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.7 });
    const starVertices = [];
    for (let i = 0; i < 10000; i++) {
      const x = (Math.random() - 0.5) * 4000;
      const y = (Math.random() - 0.5) * 4000;
      const z = (Math.random() - 0.5) * 4000;
      starVertices.push(x, y, z);
    }
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    scene.add(new THREE.Points(starGeometry, starMaterial));

    const sunGeometry = new THREE.SphereGeometry(SUN_RADIUS, 64, 64);
    const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffdd44 });
    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    scene.add(sun);

    const glowGeometry = new THREE.SphereGeometry(SUN_RADIUS + 5, 64, 64);
    const glowMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xffaa00, 
      transparent: true, 
      opacity: 0.15 
    });
    scene.add(new THREE.Mesh(glowGeometry, glowMaterial));

    const earthOrbitGroup = new THREE.Group();
    scene.add(earthOrbitGroup);

    const earthGroup = new THREE.Group();
    earthGroup.position.x = EARTH_ORBIT_RADIUS;
    earthOrbitGroup.add(earthGroup);

    const earthGeometry = new THREE.SphereGeometry(EARTH_RADIUS, 128, 128);
    const earthMaterial = new THREE.MeshStandardMaterial({ 
      map: earthTexture,
      roughness: 0.7,
      metalness: 0.1,
      emissive: 0x112244,
      emissiveIntensity: 0.2 // Increased for better visibility
    });
    const earth = new THREE.Mesh(earthGeometry, earthMaterial);
    earth.castShadow = true;
    earth.receiveShadow = true;
    earth.rotation.z = THREE.MathUtils.degToRad(23.5);
    earthGroup.add(earth);

    // Earth Atmosphere Glow
    const earthGlowGeom = new THREE.SphereGeometry(EARTH_RADIUS + 1.5, 64, 64);
    const earthGlowMat = new THREE.MeshBasicMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.1,
      side: THREE.BackSide
    });
    earthGroup.add(new THREE.Mesh(earthGlowGeom, earthGlowMat));

    const moonOrbitGroup = new THREE.Group();
    earthGroup.add(moonOrbitGroup);

    const moonGeometry = new THREE.SphereGeometry(MOON_RADIUS, 128, 128);
    const moonMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xffffff,
      map: moonTexture,
      roughness: 0.8,
      metalness: 0.0,
      emissive: 0x000000,
      emissiveIntensity: 0
    });
    const moon = new THREE.Mesh(moonGeometry, moonMaterial);
    moon.position.x = MOON_ORBIT_RADIUS;
    moon.castShadow = true;
    moon.receiveShadow = true;
    
    // Add 3D Phase Indicators to Moon
    const hologramGroup = new THREE.Group();
    hologramGroup.add(labelSprite);
    
    moon.add(hologramGroup);
    moonOrbitGroup.add(moon);

    sceneObjects.current = { camera, controls, earthGroup, sun, moon, hologramGroup };

    const createOrbitPath = (radius: number, color: number) => {
      const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, 2 * Math.PI, false, 0);
      const points = curve.getPoints(128);
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.2 });
      const line = new THREE.Line(geometry, material);
      line.rotation.x = Math.PI / 2;
      return line;
    };

    const earthPath = createOrbitPath(EARTH_ORBIT_RADIUS, 0xffffff);
    scene.add(earthPath);

    const moonPath = createOrbitPath(MOON_ORBIT_RADIUS, 0xaaaaaa);
    earthGroup.add(moonPath);

    // --- 4. Animation Loop ---
    const clock = new THREE.Clock();
    let lastPhaseUpdate = 0;
    
    renderer.setAnimationLoop(() => {
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();
      
      if (!isPausedRef.current) {
        const timeScale = speedRef.current;
        earthOrbitGroup.rotation.y += delta * 0.1 * timeScale;
        earth.rotation.y += delta * 1.5 * timeScale;
        moonOrbitGroup.rotation.y += delta * 0.5 * timeScale;

        // Update moon phase name every 200ms
        if (elapsed - lastPhaseUpdate > 0.2) {
          // Normalize angle to 0 - 2PI
          const angle = moonOrbitGroup.rotation.y % (Math.PI * 2);
          const normalizedAngle = angle < 0 ? angle + Math.PI * 2 : angle;
          
          let phase = '';
          if (normalizedAngle < 0.2 || normalizedAngle > 6.0) phase = 'Lua Nova';
          else if (normalizedAngle < 1.4) phase = 'Lua Crescente';
          else if (normalizedAngle < 1.8) phase = 'Quarto Crescente';
          else if (normalizedAngle < 2.9) phase = 'Gibosa Crescente';
          else if (normalizedAngle < 3.3) phase = 'Lua Cheia';
          else if (normalizedAngle < 4.5) phase = 'Gibosa Minguante';
          else if (normalizedAngle < 4.9) phase = 'Quarto Minguante';
          else phase = 'Lua Minguante';
          
          const visualMoon = document.getElementById('moon-visual-svg-path');
          
          // Update 3D Label Sprite
          if (labelCtx) {
            labelCtx.clearRect(0, 0, 512, 128);
            labelCtx.fillStyle = 'rgba(0, 0, 0, 0.8)'; // More solid background
            labelCtx.roundRect(10, 10, 492, 108, 40);
            labelCtx.fill();
            labelCtx.strokeStyle = 'rgba(251, 191, 36, 1.0)'; // Solid border
            labelCtx.lineWidth = 6;
            labelCtx.stroke();
            
            const text = phase.toUpperCase();
            let fontSize = 40; // Smaller font for elegance
            labelCtx.font = `bold ${fontSize}px Inter, sans-serif`;
            
            // Dynamic scaling if text is too long
            const metrics = labelCtx.measureText(text);
            if (metrics.width > 450) {
              fontSize = Math.floor(40 * (450 / metrics.width));
              labelCtx.font = `bold ${fontSize}px Inter, sans-serif`;
            }
            
            labelCtx.fillStyle = '#fbbf24';
            labelCtx.textAlign = 'center';
            labelCtx.textBaseline = 'middle';
            labelCtx.fillText(text, 256, 64);
            labelTexture.needsUpdate = true;
          }

          if (visualMoon) {
            const angle = normalizedAngle;
            const r = 20; 
            const x = Math.cos(angle) * r;
            
            let pathD = '';
            if (angle <= Math.PI) {
              const sweepTerminator = angle < Math.PI / 2 ? 0 : 1;
              pathD = `M 0 ${-r} A ${r} ${r} 0 0 1 0 ${r} A ${Math.abs(x)} ${r} 0 0 ${sweepTerminator} 0 ${-r}`;
            } else {
              const sweepTerminator = angle < 3 * Math.PI / 2 ? 1 : 0;
              pathD = `M 0 ${-r} A ${r} ${r} 0 0 0 0 ${r} A ${Math.abs(x)} ${r} 0 0 ${sweepTerminator} 0 ${-r}`;
            }
            
            if (visualMoon) visualMoon.setAttribute('d', pathD);
          }
          
          const descEl = document.getElementById('phase-description');
          if (descEl) {
            let desc = '';
            switch(phase) {
              case 'Lua Nova': desc = 'A Lua está entre a Terra e o Sol. O lado iluminado não é visível da Terra.'; break;
              case 'Lua Crescente': desc = 'Uma pequena parte da Lua começa a ser iluminada pelo Sol.'; break;
              case 'Quarto Crescente': desc = 'Metade da face da Lua voltada para a Terra está iluminada.'; break;
              case 'Gibosa Crescente': desc = 'Mais da metade da Lua está iluminada, crescendo para Cheia.'; break;
              case 'Lua Cheia': desc = 'Toda a face da Lua voltada para a Terra está iluminada pelo Sol.'; break;
              case 'Gibosa Minguante': desc = 'A iluminação começa a diminuir após a Lua Cheia.'; break;
              case 'Quarto Minguante': desc = 'Metade da face da Lua está iluminada, diminuindo para Nova.'; break;
              case 'Lua Minguante': desc = 'Apenas uma pequena faixa da Lua permanece iluminada.'; break;
            }
            descEl.innerText = desc;
          }
          
          if (phaseTextRef.current) {
            phaseTextRef.current.innerText = phase;
          }
          lastPhaseUpdate = elapsed;
        }
      }

      controls.update();
      if (sceneObjects.current) {
        sceneObjects.current.hologramGroup.visible = showLabelsRef.current;
      }
      
      renderer.render(scene, camera);
    });

    // --- 5. Cleanup & Resize ---
    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      renderer.setAnimationLoop(null);
      window.removeEventListener('resize', handleResize);
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      [sunGeometry, glowGeometry, earthGeometry, moonGeometry, starGeometry].forEach(g => g.dispose());
      [sunMaterial, glowMaterial, earthMaterial, moonMaterial, starMaterial].forEach(m => m.dispose());
    };
  }, []);

  const focusOn = (type: 'sun' | 'earth' | 'moon' | 'earthView') => {
    if (!sceneObjects.current) return;
    const { camera, controls, earthGroup, sun, moon } = sceneObjects.current;
    
    const targetPos = new THREE.Vector3();
    
    if (type === 'sun') {
      targetPos.set(0, 0, 0);
      controls.target.copy(targetPos);
      camera.position.set(250, 200, 400);
    } else if (type === 'earth') {
      earthGroup.getWorldPosition(targetPos);
      controls.target.copy(targetPos);
      camera.position.set(targetPos.x + 40, targetPos.y + 30, targetPos.z + 60);
    } else if (type === 'moon') {
      moon.getWorldPosition(targetPos);
      controls.target.copy(targetPos);
      camera.position.set(targetPos.x + 15, targetPos.y + 10, targetPos.z + 20);
    } else if (type === 'earthView') {
      // Position camera on Earth surface looking at Moon
      earthGroup.getWorldPosition(targetPos);
      const moonPos = new THREE.Vector3();
      moon.getWorldPosition(moonPos);
      
      controls.target.copy(moonPos);
      // Offset slightly from Earth center to "surface"
      camera.position.set(targetPos.x + 10, targetPos.y + 5, targetPos.z + 10);
    }
    
    controls.update();
  };

  return (
    <div className="relative w-full h-screen bg-[#020205] overflow-hidden select-none font-sans">
      <div ref={mountRef} className="absolute inset-0 z-0" />

      {/* UI Overlay */}
      <div className="absolute top-6 left-6 pointer-events-none z-10">
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-black/60 backdrop-blur-2xl border border-white/10 p-6 rounded-[2.5rem] pointer-events-auto shadow-2xl w-80"
        >
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-yellow-500 rounded-2xl flex items-center justify-center shadow-lg shadow-yellow-500/20">
              <Sun className="text-black" size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Cosmos 3D</h1>
              <p className="text-xs text-white/40 uppercase tracking-[0.2em] font-black">Simulador de fases da Lua</p>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <span className="text-xs font-bold uppercase tracking-widest text-white/30">Velocidade do Tempo</span>
                <span className="text-base font-mono text-yellow-500 font-bold">{speed.toFixed(1)}x</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="10" 
                step="0.1" 
                value={speed} 
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-yellow-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setIsPaused(!isPaused)}
                className={`flex flex-col items-center justify-center gap-2 p-5 rounded-3xl border transition-all duration-300 ${
                  isPaused 
                  ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-500' 
                  : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/80'
                }`}
              >
                {isPaused ? <Play size={24} fill="currentColor" /> : <Pause size={24} fill="currentColor" />}
                <span className="text-xs font-black uppercase tracking-widest">{isPaused ? 'Iniciar' : 'Pausar'}</span>
              </button>
              <button 
                onClick={() => { setSpeed(1); setIsPaused(false); }}
                className="flex flex-col items-center justify-center gap-2 p-5 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 transition-all duration-300"
              >
                <RotateCcw size={24} />
                <span className="text-xs font-black uppercase tracking-widest">Reiniciar</span>
              </button>
            </div>

            <div className="pt-6 border-t border-white/5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-widest text-white/30">Visualização</span>
                <button 
                  onClick={() => setShowLabels(!showLabels)}
                  className={`p-2 rounded-lg transition-colors ${showLabels ? 'text-yellow-500 bg-yellow-500/10' : 'text-white/20 hover:bg-white/5'}`}
                >
                  <Settings size={16} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button 
                  onClick={() => focusOn('sun')}
                  className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-bold uppercase tracking-widest text-white/60 transition-all"
                >
                  Sol
                </button>
                <button 
                  onClick={() => focusOn('earth')}
                  className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-bold uppercase tracking-widest text-white/60 transition-all"
                >
                  Terra
                </button>
                <button 
                  onClick={() => focusOn('moon')}
                  className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-bold uppercase tracking-widest text-white/60 transition-all"
                >
                  Lua
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2 mt-2">
                <button 
                  onClick={() => focusOn('earthView')}
                  className="p-3 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/20 text-xs font-bold uppercase tracking-widest text-yellow-500 transition-all"
                >
                  Vista da Terra (Ver Fases)
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Legend & Status */}
      <div className="absolute bottom-8 right-8 pointer-events-none hidden lg:block z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-black/40 backdrop-blur-xl p-6 rounded-[2rem] border border-white/10 space-y-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.5)]" />
            <span className="text-xs font-bold text-white/60 uppercase tracking-widest">Sol (Centro de Massa)</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
            <span className="text-xs font-bold text-white/60 uppercase tracking-widest">Terra (Órbita Elíptica)</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative w-12 h-12 rounded-full bg-gray-900 border border-white/10 flex items-center justify-center overflow-hidden">
              {/* Moon Phase SVG Visual Aid */}
              <svg width="40" height="40" viewBox="-20 -20 40 40">
                <circle r="20" fill="#1a1a1a" />
                <path id="moon-visual-svg-path" d="M 0 -20 A 20 20 0 0 1 0 20 A 0 20 0 0 1 0 -20" fill="#fbbf24" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-white/60 uppercase tracking-widest">Lua (Satélite Natural)</span>
              <span ref={phaseTextRef} className="text-base font-black text-yellow-500 uppercase tracking-widest mt-1">Lua Nova</span>
              <p id="phase-description" className="text-sm text-white/60 mt-2 max-w-[280px] leading-relaxed">A Lua está entre a Terra e o Sol. O lado iluminado não é visível da Terra.</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Help Bar */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-none z-10">
        <div className="bg-white/5 backdrop-blur-md px-8 py-4 rounded-full border border-white/10 flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-bold text-white/60 uppercase tracking-widest">Motor 3D Ativo</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <p className="text-xs font-bold text-white/30 uppercase tracking-[0.3em]">
            Girar • Zoom • Panorâmica
          </p>
        </div>
      </div>
    </div>
  );
}
