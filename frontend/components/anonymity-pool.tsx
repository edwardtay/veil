"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePoolStats } from "@/hooks/use-pool";
import { useBtcPrice } from "@/hooks/use-btc-price";
import { POOL_CONFIGS } from "@/lib/constants";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  age: number;
  entering: boolean;
}

/**
 * Animated particle visualization of the privacy pool.
 * Deposits appear as gold particles that enter the pool and become
 * indistinguishable from each other — making privacy visceral.
 */
export function AnonymityPool() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animRef = useRef<number>(0);
  const { commitmentCount, isLoading } = usePoolStats(POOL_CONFIGS.vusd);
  const { price: btcPrice } = useBtcPrice();
  const [highlighted, setHighlighted] = useState(-1);

  const POOL_CX = 200;
  const POOL_CY = 130;
  const POOL_R = 90;

  const initParticles = useCallback((count: number) => {
    const particles: Particle[] = [];
    for (let i = 0; i < Math.min(count, 30); i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * (POOL_R - 12);
      particles.push({
        x: POOL_CX + Math.cos(angle) * dist,
        y: POOL_CY + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: 3 + Math.random() * 2,
        opacity: 0.5 + Math.random() * 0.5,
        age: 1000,
        entering: false,
      });
    }
    particlesRef.current = particles;
  }, []);

  const addNewParticle = useCallback(() => {
    const side = Math.random() > 0.5 ? -1 : 1;
    particlesRef.current.push({
      x: POOL_CX + side * 180,
      y: POOL_CY - 40 + Math.random() * 80,
      vx: -side * 1.5,
      vy: (Math.random() - 0.5) * 0.5,
      radius: 4,
      opacity: 1,
      age: 0,
      entering: true,
    });
  }, []);

  useEffect(() => {
    if (isLoading) return;
    initParticles(commitmentCount || 3);

    const interval = setInterval(() => {
      if (particlesRef.current.length < 40) {
        addNewParticle();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [commitmentCount, isLoading, initParticles, addNewParticle]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = 400 * dpr;
    canvas.height = 260 * dpr;
    ctx.scale(dpr, dpr);

    const draw = () => {
      ctx.clearRect(0, 0, 400, 260);

      // Pool boundary — subtle ring
      ctx.beginPath();
      ctx.arc(POOL_CX, POOL_CY, POOL_R + 2, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(212, 168, 67, 0.12)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Pool interior glow
      const grad = ctx.createRadialGradient(POOL_CX, POOL_CY, 0, POOL_CX, POOL_CY, POOL_R);
      grad.addColorStop(0, "rgba(212, 168, 67, 0.04)");
      grad.addColorStop(1, "rgba(212, 168, 67, 0.01)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(POOL_CX, POOL_CY, POOL_R, 0, Math.PI * 2);
      ctx.fill();

      // Update & draw particles
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.age++;

        if (p.entering) {
          // Move toward pool center
          const dx = POOL_CX - p.x;
          const dy = POOL_CY - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < POOL_R - 10) {
            p.entering = false;
            p.vx = (Math.random() - 0.5) * 0.3;
            p.vy = (Math.random() - 0.5) * 0.3;
          } else {
            p.vx += dx / dist * 0.04;
            p.vy += dy / dist * 0.04;
          }
        } else {
          // Gentle orbital motion inside pool
          const dx = POOL_CX - p.x;
          const dy = POOL_CY - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Drift toward center if too far
          if (dist > POOL_R - 15) {
            p.vx += dx / dist * 0.02;
            p.vy += dy / dist * 0.02;
          }

          // Add slight orbital tendency
          p.vx += -dy * 0.0004;
          p.vy += dx * 0.0004;
        }

        // Apply damping
        p.vx *= 0.995;
        p.vy *= 0.995;
        p.x += p.vx;
        p.y += p.vy;

        // Draw particle
        const isHl = i === highlighted;
        const alpha = p.entering ? Math.min(p.age / 40, 1) * 0.9 : p.opacity * 0.7;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = isHl
          ? `rgba(239, 68, 68, ${alpha})`
          : p.entering
            ? `rgba(212, 168, 67, ${alpha})`
            : `rgba(212, 168, 67, ${alpha * 0.8})`;
        ctx.fill();

        // Glow for entering particles
        if (p.entering && p.age < 60) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius + 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(212, 168, 67, ${0.15 * (1 - p.age / 60)})`;
          ctx.fill();
        }
      }

      // Labels
      ctx.font = "9px JetBrains Mono, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(156, 163, 175, 0.5)";
      ctx.fillText("PRIVACY POOL", POOL_CX, POOL_CY + POOL_R + 20);

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [highlighted]);

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-[10px] font-[family-name:var(--font-mono)] text-gold/60 tracking-widest mb-1">
            PRIVACY IN ACTION
          </p>
          <h3 className="text-lg font-[family-name:var(--font-display)] text-void-50">
            Where Your Payment Disappears
          </h3>
        </div>
        <div className="text-right">
          <p className="text-2xl font-[family-name:var(--font-mono)] text-gold font-semibold">
            {isLoading ? "..." : commitmentCount}
          </p>
          <p className="text-[10px] font-[family-name:var(--font-mono)] text-void-500">
            deposits in pool
          </p>
        </div>
      </div>
      <p className="text-sm text-void-400 mb-4">
        Every deposit looks identical inside the pool. When you withdraw, a zero-knowledge proof confirms you have funds —
        without revealing which deposit is yours. More participants means stronger privacy for everyone.
      </p>
      <div className="flex justify-center">
        <canvas
          ref={canvasRef}
          style={{ width: 400, height: 260 }}
          className="max-w-full"
          aria-label="Privacy pool visualization — each particle represents a deposit, indistinguishable from others"
          role="img"
        />
      </div>
      {/* BTC price + deposit count */}
      <div className="mt-3 flex items-center justify-center gap-6 text-[10px] font-[family-name:var(--font-mono)] text-void-500">
        {btcPrice > 0 && (
          <span>BTC ${btcPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
        )}
        <span>{isLoading ? "..." : commitmentCount} deposits</span>
      </div>
      <div className="mt-3 flex items-center justify-center gap-4 text-[10px] font-[family-name:var(--font-mono)]">
        <button
          onClick={() => setHighlighted(highlighted >= 0 ? -1 : 0)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-void-800/80 border border-void-700/50 hover:border-gold/30 transition-colors text-void-400 hover:text-void-200"
        >
          <div className={`w-2 h-2 rounded-full ${highlighted >= 0 ? "bg-red-400" : "bg-gold/60"}`} />
          {highlighted >= 0 ? "Lost track? That's the point." : "Try it: highlight one deposit..."}
        </button>
      </div>
    </div>
  );
}
