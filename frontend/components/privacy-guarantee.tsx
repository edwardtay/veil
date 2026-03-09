"use client";

import { usePoolStats } from "@/hooks/use-pool";
import { POOL_CONFIGS } from "@/lib/constants";
import { Lock, Eye, ShieldCheck, Binary } from "lucide-react";

/**
 * Visual privacy guarantee — shows the mathematical promise of the
 * privacy pool. Makes abstract ZK guarantees concrete and visceral.
 */
export function PrivacyGuarantee() {
  const { commitmentCount, isLoading } = usePoolStats(POOL_CONFIGS.vusd);
  const n = commitmentCount;

  return (
    <div className="glass rounded-2xl overflow-hidden">
      {/* Header bar */}
      <div className="px-6 py-4 border-b border-void-800/50 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <p className="text-[10px] font-[family-name:var(--font-mono)] text-green-400/70 tracking-widest uppercase">
          Cryptographic Guarantee
        </p>
      </div>

      <div className="p-6 md:p-8">
        {/* The core promise */}
        <div className="text-center mb-8">
          <p className="text-void-400 text-sm mb-3">
            Given <span className="text-gold font-[family-name:var(--font-mono)] font-semibold">{isLoading ? "..." : n}</span> deposits
            in the privacy pool, the probability of linking
            your withdrawal to your deposit is exactly:
          </p>
          <div className="inline-flex items-center gap-4 px-8 py-5 rounded-2xl bg-void-900/80 border border-gold/20">
            <div className="text-center">
              <p className="text-4xl font-[family-name:var(--font-mono)] text-gold font-bold">
                1/{n || "N"}
              </p>
              <p className="text-[10px] font-[family-name:var(--font-mono)] text-void-500 mt-1">
                {n > 0 ? `${((1 / n) * 100).toFixed(1)}%` : "—"} chance
              </p>
            </div>
          </div>
          <p className="text-xs text-void-500 mt-3 font-[family-name:var(--font-mono)]">
            Not a claim. A mathematical fact enforced by zero-knowledge proofs.
          </p>
        </div>

        {/* Security properties grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              icon: Lock,
              title: "Double-Spend Prevention",
              detail: "Nullifier hash is checked on-chain. Each deposit can only be withdrawn once.",
              color: "text-gold",
              bg: "bg-gold/5 border-gold/15",
            },
            {
              icon: Binary,
              title: "Deposit Integrity",
              detail: "Merkle root history buffer validates proof against known state.",
              color: "text-blue-400",
              bg: "bg-blue-500/5 border-blue-500/15",
            },
            {
              icon: ShieldCheck,
              title: "ASP Enforcement",
              detail: "Withdrawal recipients must be in the contract-level approved set.",
              color: "text-green-400",
              bg: "bg-green-500/5 border-green-500/15",
            },
            {
              icon: Eye,
              title: "Zero Knowledge",
              detail: "Groth16 proof reveals nothing about which deposit you're withdrawing.",
              color: "text-purple-400",
              bg: "bg-purple-500/5 border-purple-500/15",
            },
          ].map((prop, i) => (
            <div key={i} className={`p-4 rounded-xl border ${prop.bg}`}>
              <prop.icon className={`w-4 h-4 ${prop.color} mb-2`} />
              <p className={`text-xs font-semibold ${prop.color} mb-1`}>
                {prop.title}
              </p>
              <p className="text-[10px] leading-relaxed text-void-500">
                {prop.detail}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
