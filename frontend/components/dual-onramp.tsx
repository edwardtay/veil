"use client";

import { Bitcoin, Lock, ShieldCheck, Shield, Vault, Coins, ArrowRight } from "lucide-react";

const NATIVE_BTC_STEPS = [
  { icon: Bitcoin, label: "BTC", color: "text-orange-400" },
  { icon: Lock, label: "Lock", color: "text-orange-400" },
  { icon: ShieldCheck, label: "Verify", color: "text-orange-400" },
  { icon: Shield, label: "Private", color: "text-green-400" },
];

const WBTC_STEPS = [
  { icon: Coins, label: "WBTC", color: "text-gold" },
  { icon: Vault, label: "Vault", color: "text-gold" },
  { icon: Coins, label: "vUSD", color: "text-gold" },
  { icon: Shield, label: "Private", color: "text-green-400" },
];

function MiniArrow({ color }: { color: string }) {
  return (
    <ArrowRight className={`w-3 h-3 shrink-0 ${color} opacity-40`} />
  );
}

function MiniFlow({ steps }: { steps: typeof NATIVE_BTC_STEPS }) {
  return (
    <div className="flex items-center gap-1.5 py-3 overflow-x-auto">
      {steps.map((step, i) => (
        <div key={step.label} className="contents">
          <div className="flex flex-col items-center gap-1 min-w-[52px]">
            <step.icon className={`w-4 h-4 ${step.color}`} />
            <span className={`text-[9px] font-semibold ${step.color} whitespace-nowrap`}>
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && <MiniArrow color={steps[i].color} />}
        </div>
      ))}
    </div>
  );
}

export function DualOnramp() {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Native BTC */}
      <div className="glass rounded-2xl p-5 space-y-3 border-orange-400/15 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-400/[0.03] rounded-full blur-[60px] pointer-events-none" />
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-[family-name:var(--font-mono)] text-orange-400/80 tracking-widest uppercase">
            Native BTC
          </span>
          <span className="text-[9px] font-[family-name:var(--font-mono)] text-orange-400/50 px-2 py-0.5 rounded-full border border-orange-400/20">
            Bitcoin
          </span>
        </div>
        <h4 className="text-base font-semibold text-void-50">
          I Have BTC
        </h4>
        <MiniFlow steps={NATIVE_BTC_STEPS} />
        <ul className="text-sm text-void-400 space-y-1.5 leading-relaxed">
          <li className="flex gap-2">
            <span className="text-orange-400/60 mt-0.5">&#x2022;</span>
            Lock your BTC on Bitcoin — it gets verified automatically
          </li>
          <li className="flex gap-2">
            <span className="text-orange-400/60 mt-0.5">&#x2022;</span>
            Your Bitcoin stays locked until your deposit is confirmed
          </li>
          <li className="flex gap-2">
            <span className="text-orange-400/60 mt-0.5">&#x2022;</span>
            No middleman — secured directly by the Bitcoin network
          </li>
        </ul>
        <div className="pt-1 border-t border-void-700/30">
          <span className="text-[10px] text-void-500 font-[family-name:var(--font-mono)]">
            BTC &#x2192; lock &#x2192; private
          </span>
        </div>
      </div>

      {/* WBTC */}
      <div className="glass rounded-2xl p-5 space-y-3 border-gold/15 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gold/[0.03] rounded-full blur-[60px] pointer-events-none" />
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-[family-name:var(--font-mono)] text-gold/80 tracking-widest uppercase">
            Wrapped BTC
          </span>
          <span className="text-[9px] font-[family-name:var(--font-mono)] text-gold/50 px-2 py-0.5 rounded-full border border-gold/20">
            Starknet
          </span>
        </div>
        <h4 className="text-base font-semibold text-void-50">
          I Have WBTC on Starknet
        </h4>
        <MiniFlow steps={WBTC_STEPS} />
        <ul className="text-sm text-void-400 space-y-1.5 leading-relaxed">
          <li className="flex gap-2">
            <span className="text-gold/60 mt-0.5">&#x2022;</span>
            Deposit WBTC and mint vUSD stablecoins instantly
          </li>
          <li className="flex gap-2">
            <span className="text-gold/60 mt-0.5">&#x2022;</span>
            150% backed — your Bitcoin collateral stays safe
          </li>
          <li className="flex gap-2">
            <span className="text-gold/60 mt-0.5">&#x2022;</span>
            No waiting — enter the privacy pool right away
          </li>
        </ul>
        <div className="pt-1 border-t border-void-700/30">
          <span className="text-[10px] text-void-500 font-[family-name:var(--font-mono)]">
            WBTC &#x2192; vUSD &#x2192; private
          </span>
        </div>
      </div>
    </div>
  );
}
