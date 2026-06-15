"use client";

import { useState, lazy, Suspense } from "react";
import { BackgroundShader } from "./BackgroundShader";

// Lazy load shader components to reduce initial bundle size
const ParticleFlowShader = lazy(() =>
  import("./ParticleFlowShader").then((m) => ({ default: m.ParticleFlowShader }))
);
const CrystalGeometryShader = lazy(() =>
  import("./CrystalGeometryShader").then((m) => ({ default: m.CrystalGeometryShader }))
);
const FluidInkShader = lazy(() =>
  import("./FluidInkShader").then((m) => ({ default: m.FluidInkShader }))
);
const NeuralConstellationShader = lazy(() =>
  import("./NeuralConstellationShader").then((m) => ({ default: m.NeuralConstellationShader }))
);
const AuraEnergyShader = lazy(() =>
  import("./AuraEnergyShader").then((m) => ({ default: m.AuraEnergyShader }))
);

type ShaderType = "ocean" | "particles" | "crystal" | "fluid" | "neural" | "aura";

const shaders = {
  ocean: { name: "Ocean Waves", component: BackgroundShader, desc: "Serene oceanic waves with mouse interaction" },
  particles: { name: "Particle Flow", component: ParticleFlowShader, desc: "Flowing particle system with organic motion" },
  crystal: { name: "Crystal Geometry", component: CrystalGeometryShader, desc: "Crystalline geometric patterns" },
  fluid: { name: "Fluid Ink", component: FluidInkShader, desc: "Turbulent fluid dynamics with mouse influence" },
  neural: { name: "Neural Constellation", component: NeuralConstellationShader, desc: "Data-inspired neural network visualization" },
  aura: { name: "Aura Energy", component: AuraEnergyShader, desc: "Radiant energy fields and waves" },
};

export function ShaderGallery() {
  const [activeShader, setActiveShader] = useState<ShaderType>("ocean");

  const CurrentShader = shaders[activeShader].component;

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* Shader Canvas with Suspense fallback for lazy-loaded components */}
      <Suspense
        fallback={
          <div className="w-full h-full bg-gray-900 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
          </div>
        }
      >
        <CurrentShader />
      </Suspense>

      {/* Controls Overlay */}
      <div className="absolute top-0 left-0 right-0 z-10 p-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-2 text-white">WebGL Shader Gallery</h1>
          <p className="text-sm text-gray-400 mb-4">{shaders[activeShader].desc}</p>

          {/* Shader Buttons */}
          <div className="flex flex-wrap gap-2">
            {(Object.keys(shaders) as ShaderType[]).map((key) => (
              <button
                key={key}
                onClick={() => setActiveShader(key)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                  activeShader === key
                    ? "bg-cyan-500 text-black shadow-lg shadow-cyan-500/50"
                    : "bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 hover:text-white"
                }`}
              >
                {shaders[key].name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Info Footer */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-center text-xs text-gray-500">
        <p>Move your mouse to interact with the shaders</p>
      </div>
    </div>
  );
}
