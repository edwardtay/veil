"use client";

import { cn } from "@/lib/cn";
import { formatRatio } from "@/lib/format";

interface HealthBarProps {
  ratioBps: bigint;
}

function getHealthColor(bps: number) {
  if (bps >= 15000) return { bg: "bg-green-500", gradient: "from-green-500 to-emerald-400", text: "text-green-400", label: "Healthy", ring: "ring-green-500/20" };
  if (bps >= 13000) return { bg: "bg-yellow-500", gradient: "from-yellow-500 to-amber-400", text: "text-yellow-400", label: "Caution", ring: "ring-yellow-500/20" };
  if (bps >= 12000) return { bg: "bg-orange-500", gradient: "from-orange-500 to-red-400", text: "text-orange-400", label: "Warning", ring: "ring-orange-500/20" };
  return { bg: "bg-red-500", gradient: "from-red-500 to-rose-400", text: "text-red-400", label: "Danger", ring: "ring-red-500/20" };
}

export function HealthBar({ ratioBps }: HealthBarProps) {
  const bps = Number(ratioBps);
  const { gradient, text, label, ring } = getHealthColor(bps);
  const widthPct = bps === 0 ? 0 : Math.min(100, Math.max(5, (bps / 20000) * 100));

  // Marker positions (as % of 20000 bps = 200%)
  const liquidationPct = (12000 / 20000) * 100; // 120%
  const safePct = (15000 / 20000) * 100; // 150%

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-void-400">Vault Health</span>
        <div className="flex items-center gap-2">
          {bps > 0 && (
            <span className={cn(
              "text-[10px] font-[family-name:var(--font-mono)] px-2 py-0.5 rounded-full ring-1",
              text,
              ring,
              bps >= 15000 ? "bg-green-500/5" : bps >= 13000 ? "bg-yellow-500/5" : bps >= 12000 ? "bg-orange-500/5" : "bg-red-500/5"
            )}>
              {label}
            </span>
          )}
          <span className={cn("font-semibold font-[family-name:var(--font-mono)] text-sm", text)}>
            {bps === 0 ? "—" : formatRatio(ratioBps)}
          </span>
        </div>
      </div>

      {/* Bar with markers */}
      <div className="relative">
        <div className="h-2 bg-void-800 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out", gradient)}
            style={{ width: `${widthPct}%` }}
          />
        </div>
        {/* Liquidation marker */}
        <div
          className="absolute top-0 h-2 w-px bg-red-500/60"
          style={{ left: `${liquidationPct}%` }}
        />
        {/* Safe marker */}
        <div
          className="absolute top-0 h-2 w-px bg-green-500/60"
          style={{ left: `${safePct}%` }}
        />
      </div>

      <div className="flex justify-between text-[10px] font-[family-name:var(--font-mono)] text-void-600">
        <span>0%</span>
        <span className="text-red-500/70">120% Danger</span>
        <span className="text-green-500/70">150% Safe</span>
        <span>200%+</span>
      </div>
    </div>
  );
}
