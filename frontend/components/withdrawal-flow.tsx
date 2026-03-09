"use client";

import { useInView } from "@/hooks/use-in-view";
import { FileKey, GitBranch, Cpu, ShieldCheck, ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";

const flowSteps = [
  {
    icon: FileKey,
    label: "Upload Note",
    detail: "nullifier + secret",
    color: "text-void-300",
    bg: "bg-void-800",
    border: "border-void-700/50",
  },
  {
    icon: GitBranch,
    label: "Build Path",
    detail: "Merkle siblings",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
  {
    icon: Cpu,
    label: "Groth16 Prove",
    detail: "~3s in browser",
    color: "text-gold",
    bg: "bg-gold/10",
    border: "border-gold/20",
  },
  {
    icon: ShieldCheck,
    label: "On-Chain Verify",
    detail: "Garaga BN254",
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
  },
];

export function WithdrawalFlow() {
  const { ref, inView } = useInView(0.2);

  return (
    <div ref={ref} className="glass rounded-2xl p-6 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[10px] font-[family-name:var(--font-mono)] text-gold/60 tracking-widest mb-1">
            WITHDRAWAL PIPELINE
          </p>
          <h3 className="text-lg font-[family-name:var(--font-display)] text-void-50">
            How ZK Withdrawal Works
          </h3>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch gap-2 sm:gap-0">
        {flowSteps.map((step, i) => (
          <div key={i} className="flex items-center flex-1">
            <div
              className={cn(
                "flex-1 p-4 rounded-xl border transition-all duration-500",
                step.bg,
                step.border,
                inView
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4"
              )}
              style={{ transitionDelay: `${i * 150}ms` }}
            >
              <step.icon className={cn("w-5 h-5 mb-2", step.color)} />
              <p className={cn("text-sm font-medium", step.color)}>
                {step.label}
              </p>
              <p className="text-[10px] font-[family-name:var(--font-mono)] text-void-500 mt-1">
                {step.detail}
              </p>
            </div>
            {i < flowSteps.length - 1 && (
              <ArrowRight
                className={cn(
                  "w-4 h-4 text-void-600 mx-1 shrink-0 hidden sm:block transition-all duration-500",
                  inView ? "opacity-100" : "opacity-0"
                )}
                style={{ transitionDelay: `${i * 150 + 75}ms` }}
              />
            )}
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-4 text-[10px] font-[family-name:var(--font-mono)] text-void-500">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-gold/40" />
          <span>Client-side (private)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-400/40" />
          <span>On-chain (public)</span>
        </div>
        <span className="text-void-600">|</span>
        <span>Zero knowledge of depositor identity is revealed</span>
      </div>
    </div>
  );
}
