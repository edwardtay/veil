"use client";

import { usePoolStats } from "@/hooks/use-pool";
import { Shield, Lock, Eye, EyeOff } from "lucide-react";
import type { PoolConfig } from "@/lib/constants";

/**
 * Privacy strength meter — shows how strong the anonymity set is,
 * based on real on-chain deposit count. Makes privacy measurable.
 */
export function PrivacyMeter({ pool }: { pool: PoolConfig }) {
  const { commitmentCount, isLoading } = usePoolStats(pool);

  if (isLoading) return null;

  // Privacy levels based on anonymity set size
  const levels = [
    { min: 0, label: "None", color: "text-red-400", bg: "bg-red-500", bars: 0 },
    { min: 1, label: "Minimal", color: "text-amber-400", bg: "bg-amber-500", bars: 1 },
    { min: 3, label: "Low", color: "text-amber-400", bg: "bg-amber-500", bars: 2 },
    { min: 10, label: "Moderate", color: "text-gold", bg: "bg-gold", bars: 3 },
    { min: 50, label: "Strong", color: "text-green-400", bg: "bg-green-500", bars: 4 },
    { min: 100, label: "Very Strong", color: "text-green-400", bg: "bg-green-500", bars: 5 },
  ];

  const current = [...levels].reverse().find(l => commitmentCount >= l.min) || levels[0];
  const maxBars = 5;

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-start gap-4">
        <div className="rounded-xl bg-void-800 border border-void-700/50 p-2.5">
          <Shield className="w-5 h-5 text-gold" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-void-500 uppercase tracking-widest font-[family-name:var(--font-mono)]">
              Privacy Strength
            </p>
            <span className={`text-xs font-[family-name:var(--font-mono)] font-medium ${current.color}`}>
              {current.label}
            </span>
          </div>

          {/* Signal bars */}
          <div className="flex items-end gap-1 mb-3 h-5">
            {Array.from({ length: maxBars }).map((_, i) => (
              <div
                key={i}
                className={`w-2.5 rounded-sm transition-all duration-500 ${
                  i < current.bars
                    ? `${current.bg}/60`
                    : "bg-void-700/40"
                }`}
                style={{
                  height: `${((i + 1) / maxBars) * 100}%`,
                  transitionDelay: `${i * 80}ms`,
                }}
              />
            ))}
          </div>

          {/* Privacy explainer */}
          <div className="grid grid-cols-3 gap-2">
            <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-void-900/60">
              <Lock className="w-3 h-3 text-gold/60" />
              <div>
                <p className="text-[9px] font-[family-name:var(--font-mono)] text-void-500">Deposits</p>
                <p className="text-xs font-[family-name:var(--font-mono)] text-void-200">{commitmentCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-void-900/60">
              <Eye className="w-3 h-3 text-gold/60" />
              <div>
                <p className="text-[9px] font-[family-name:var(--font-mono)] text-void-500">Traceability</p>
                <p className="text-xs font-[family-name:var(--font-mono)] text-void-200">
                  {commitmentCount > 0 ? `1/${commitmentCount}` : "N/A"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-void-900/60">
              <EyeOff className="w-3 h-3 text-gold/60" />
              <div>
                <p className="text-[9px] font-[family-name:var(--font-mono)] text-void-500">Privacy</p>
                <p className="text-xs font-[family-name:var(--font-mono)] text-void-200">
                  {commitmentCount >= 100 ? "Strong" : commitmentCount >= 10 ? "Moderate" : commitmentCount > 0 ? "Low" : "None"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
