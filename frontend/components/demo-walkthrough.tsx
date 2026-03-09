"use client";

import Link from "next/link";
import { ArrowRight, Droplets, Lock, Coins, Shield, Fingerprint, CheckCircle } from "lucide-react";

const demoSteps = [
  {
    number: "1",
    icon: Droplets,
    title: "Get Test WBTC",
    description: "Click the faucet on the Vault page to mint 1 WBTC on Starknet Sepolia.",
    color: "text-blue-400",
    border: "border-blue-500/20",
    bg: "bg-blue-500/5",
    glow: "bg-blue-500/10",
    done: true,
  },
  {
    number: "2",
    icon: Lock,
    title: "Deposit Collateral",
    description: "Lock your test WBTC in the CDP vault as collateral.",
    color: "text-gold",
    border: "border-gold/20",
    bg: "bg-gold/5",
    glow: "bg-gold/10",
    done: true,
  },
  {
    number: "3",
    icon: Coins,
    title: "Mint vUSD",
    description: "Borrow vUSD stablecoins against your collateral at 150% ratio.",
    color: "text-emerald-400",
    border: "border-emerald-500/20",
    bg: "bg-emerald-500/5",
    glow: "bg-emerald-500/10",
    done: true,
  },
  {
    number: "4",
    icon: Shield,
    title: "Enter Privacy Pool",
    description: "Deposit 1,000 vUSD into the ZK mixing pool. Save your note file.",
    color: "text-purple-400",
    border: "border-purple-500/20",
    bg: "bg-purple-500/5",
    glow: "bg-purple-500/10",
    done: true,
  },
  {
    number: "5",
    icon: Fingerprint,
    title: "Withdraw Privately",
    description: "Upload your note, generate a Groth16 proof in-browser, and withdraw.",
    color: "text-rose-400",
    border: "border-rose-500/20",
    bg: "bg-rose-500/5",
    glow: "bg-rose-500/10",
    done: true,
  },
];

export function DemoWalkthrough() {
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-6 py-5 border-b border-void-800/60 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="text-[10px] font-[family-name:var(--font-mono)] text-gold/60 tracking-widest">
              HOW IT WORKS
            </p>
            <span className="text-[9px] font-[family-name:var(--font-mono)] text-green-400/70 bg-green-500/10 px-1.5 py-0.5 rounded-full border border-green-500/20 flex items-center gap-1">
              <CheckCircle className="w-2.5 h-2.5" />
              ALL STEPS VERIFIED ON-CHAIN
            </span>
          </div>
          <p className="text-lg font-[family-name:var(--font-display)] text-void-50">
            Five Steps to Private Payments
          </p>
          <p className="text-xs text-void-500 mt-0.5">
            Every step below has been executed on Starknet Sepolia — connect Argent or Braavos to try it yourself
          </p>
        </div>
        <Link
          href="/vault"
          className="group inline-flex items-center gap-2 px-5 py-2.5 bg-gold hover:bg-gold-light text-void-950 rounded-xl text-sm font-semibold transition-all duration-200 glow-gold shrink-0"
        >
          Start
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {demoSteps.map((step, i) => (
            <div key={i} className="relative">
              <div className={`rounded-xl border ${step.border} ${step.bg} p-3 h-full`}>
                <div className="flex items-center justify-between mb-2.5">
                  <div className={`w-7 h-7 rounded-full ${step.glow} flex items-center justify-center`}>
                    <step.icon className={`w-3.5 h-3.5 ${step.color}`} />
                  </div>
                  {step.done && (
                    <CheckCircle className="w-3.5 h-3.5 text-green-400/60" />
                  )}
                </div>
                <p className={`text-xs font-semibold ${step.color} mb-1`}>
                  {step.title}
                </p>
                <p className="text-[10px] leading-relaxed text-void-500">
                  {step.description}
                </p>
              </div>
              {i < demoSteps.length - 1 && (
                <div className="hidden sm:block absolute top-1/2 -right-1.5 w-3 h-px bg-void-600/50" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
