"use client";

import { useEffect, useState } from "react";

/**
 * Animated dual-tree visualization showing the core Veil concept:
 * State Tree + ASP Tree → merged ZK proof
 *
 * Pure CSS animations, no dependencies.
 */
export function DualTreeVisual() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setActive(true), 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative w-full max-w-md mx-auto h-[280px] select-none" aria-hidden="true">
      <p className="absolute -top-5 right-0 text-[9px] font-[family-name:var(--font-mono)] text-void-600 uppercase tracking-widest">Target Architecture</p>
      {/* Left tree — State Tree */}
      <div className={`absolute left-4 top-0 transition-all duration-1000 ${active ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
        <p className="text-[9px] font-[family-name:var(--font-mono)] text-void-500 uppercase tracking-widest mb-3 text-center">
          State Tree
        </p>
        <TreeSVG color="gold" delay={0} />
      </div>

      {/* Right tree — ASP Tree */}
      <div className={`absolute right-4 top-0 transition-all duration-1000 delay-200 ${active ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
        <p className="text-[9px] font-[family-name:var(--font-mono)] text-void-500 uppercase tracking-widest mb-3 text-center">
          ASP Tree
        </p>
        <TreeSVG color="green" delay={400} />
      </div>

      {/* Merge lines */}
      <svg
        className={`absolute bottom-[60px] left-1/2 -translate-x-1/2 transition-opacity duration-700 delay-[1200ms] ${active ? "opacity-100" : "opacity-0"}`}
        width="200"
        height="40"
        viewBox="0 0 200 40"
      >
        <path
          d="M 30 0 Q 100 30 100 35"
          fill="none"
          stroke="rgba(212, 168, 67, 0.3)"
          strokeWidth="1"
          className="animate-draw-line"
          strokeDasharray="150"
          strokeDashoffset="150"
          style={{ animation: active ? "draw-line 0.8s ease-out 1.2s forwards" : "none" }}
        />
        <path
          d="M 170 0 Q 100 30 100 35"
          fill="none"
          stroke="rgba(34, 197, 94, 0.3)"
          strokeWidth="1"
          className="animate-draw-line"
          strokeDasharray="150"
          strokeDashoffset="150"
          style={{ animation: active ? "draw-line 0.8s ease-out 1.4s forwards" : "none" }}
        />
      </svg>

      {/* ZK Proof result */}
      <div
        className={`absolute bottom-0 left-1/2 -translate-x-1/2 transition-all duration-700 delay-[1800ms] ${
          active ? "opacity-100 scale-100" : "opacity-0 scale-75"
        }`}
      >
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-void-800/80 border border-gold/20 glow-soft">
          <div className="w-2 h-2 rounded-full bg-gold animate-pulse" />
          <span className="text-[10px] font-[family-name:var(--font-mono)] text-gold tracking-wider">
            GROTH16 PROOF
          </span>
        </div>
      </div>
    </div>
  );
}

function TreeSVG({ color, delay }: { color: "gold" | "green"; delay: number }) {
  const c = color === "gold"
    ? { node: "rgba(212, 168, 67, 0.6)", nodeBg: "rgba(212, 168, 67, 0.1)", line: "rgba(212, 168, 67, 0.2)" }
    : { node: "rgba(34, 197, 94, 0.6)", nodeBg: "rgba(34, 197, 94, 0.1)", line: "rgba(34, 197, 94, 0.2)" };

  return (
    <svg width="140" height="160" viewBox="0 0 140 160">
      {/* Level 0 — root */}
      <TreeNode cx={70} cy={15} r={6} fill={c.nodeBg} stroke={c.node} delay={delay} />

      {/* Level 1 */}
      <TreeLine x1={70} y1={21} x2={35} y2={55} stroke={c.line} delay={delay + 100} />
      <TreeLine x1={70} y1={21} x2={105} y2={55} stroke={c.line} delay={delay + 100} />
      <TreeNode cx={35} cy={60} r={5} fill={c.nodeBg} stroke={c.node} delay={delay + 200} />
      <TreeNode cx={105} cy={60} r={5} fill={c.nodeBg} stroke={c.node} delay={delay + 200} />

      {/* Level 2 */}
      <TreeLine x1={35} y1={65} x2={18} y2={95} stroke={c.line} delay={delay + 300} />
      <TreeLine x1={35} y1={65} x2={52} y2={95} stroke={c.line} delay={delay + 300} />
      <TreeLine x1={105} y1={65} x2={88} y2={95} stroke={c.line} delay={delay + 300} />
      <TreeLine x1={105} y1={65} x2={122} y2={95} stroke={c.line} delay={delay + 300} />
      <TreeNode cx={18} cy={100} r={4} fill={c.nodeBg} stroke={c.node} delay={delay + 400} />
      <TreeNode cx={52} cy={100} r={4} fill={c.nodeBg} stroke={c.node} delay={delay + 400} />
      <TreeNode cx={88} cy={100} r={4} fill={c.nodeBg} stroke={c.node} delay={delay + 400} />
      <TreeNode cx={122} cy={100} r={4} fill={c.nodeBg} stroke={c.node} delay={delay + 400} />

      {/* Level 3 — leaves */}
      <TreeLine x1={18} y1={104} x2={10} y2={130} stroke={c.line} delay={delay + 500} />
      <TreeLine x1={18} y1={104} x2={26} y2={130} stroke={c.line} delay={delay + 500} />
      <TreeLine x1={52} y1={104} x2={44} y2={130} stroke={c.line} delay={delay + 500} />
      <TreeLine x1={52} y1={104} x2={60} y2={130} stroke={c.line} delay={delay + 500} />
      <TreeLine x1={88} y1={104} x2={80} y2={130} stroke={c.line} delay={delay + 500} />
      <TreeLine x1={88} y1={104} x2={96} y2={130} stroke={c.line} delay={delay + 500} />
      <TreeLine x1={122} y1={104} x2={114} y2={130} stroke={c.line} delay={delay + 500} />
      <TreeLine x1={122} y1={104} x2={130} y2={130} stroke={c.line} delay={delay + 500} />

      {[10, 26, 44, 60, 80, 96, 114, 130].map((cx, i) => (
        <TreeNode key={i} cx={cx} cy={135} r={3} fill={c.nodeBg} stroke={c.node} delay={delay + 600 + i * 50} />
      ))}

      {/* Highlighted path — shows membership proof traversal */}
      <line
        x1={70} y1={15} x2={35} y2={55}
        stroke={c.node}
        strokeWidth="1.5"
        opacity={0}
        style={{ animation: `fade-in-line 0.3s ease-out ${delay + 800}ms forwards` }}
      />
      <line
        x1={35} y1={60} x2={52} y2={95}
        stroke={c.node}
        strokeWidth="1.5"
        opacity={0}
        style={{ animation: `fade-in-line 0.3s ease-out ${delay + 1000}ms forwards` }}
      />
      <line
        x1={52} y1={100} x2={60} y2={130}
        stroke={c.node}
        strokeWidth="1.5"
        opacity={0}
        style={{ animation: `fade-in-line 0.3s ease-out ${delay + 1200}ms forwards` }}
      />
    </svg>
  );
}

function TreeNode({
  cx, cy, r, fill, stroke, delay,
}: {
  cx: number; cy: number; r: number; fill: string; stroke: string; delay: number;
}) {
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={fill}
      stroke={stroke}
      strokeWidth="1"
      opacity={0}
      style={{ animation: `fade-in-node 0.4s ease-out ${delay}ms forwards` }}
    />
  );
}

function TreeLine({
  x1, y1, x2, y2, stroke, delay,
}: {
  x1: number; y1: number; x2: number; y2: number; stroke: string; delay: number;
}) {
  return (
    <line
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={stroke}
      strokeWidth="1"
      opacity={0}
      style={{ animation: `fade-in-line 0.3s ease-out ${delay}ms forwards` }}
    />
  );
}
