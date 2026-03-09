"use client";

import Link from "next/link";
import { useVaultPosition } from "@/hooks/use-vault";
import { useVusdBalance } from "@/hooks/use-vusd";
import { usePoolStats } from "@/hooks/use-pool";
import { useAccount, useReadContract } from "@starknet-react/core";
import { POOL_ABI, CONTRACT_ADDRESSES } from "@/lib/contracts";
import { POOL_CONFIGS } from "@/lib/constants";
import { CheckCircle, Circle, ArrowRight } from "lucide-react";

/**
 * Journey progress tracker shown on vault and pool pages.
 * Shows where the user is in the Veil flow:
 * Faucet → Deposit WBTC → Mint vUSD → Enter Pool → Withdraw
 */
export function JourneyTracker({ current }: { current: "vault" | "pool" }) {
  const { address } = useAccount();
  const { collateral, debt } = useVaultPosition();
  const { balance: vusdBalance } = useVusdBalance();
  const { commitmentCount } = usePoolStats(POOL_CONFIGS.vusd);
  const { data: aspStatus } = useReadContract({
    abi: POOL_ABI,
    address: CONTRACT_ADDRESSES.pool,
    functionName: "is_approved",
    args: address ? [address] : undefined,
    enabled: !!address,
  });

  const steps = [
    {
      key: "collateral",
      label: "Deposit WBTC",
      done: collateral > 0n,
      href: "/vault",
    },
    {
      key: "mint",
      label: "Mint vUSD",
      done: debt > 0n || vusdBalance > 0n,
      href: "/vault",
    },
    {
      key: "approve",
      label: "Get Approved",
      done: !!aspStatus,
      href: "/pool",
    },
    {
      key: "deposit",
      label: "Send",
      done: commitmentCount > 0,
      href: "/pool",
    },
    {
      key: "withdraw",
      label: "Withdraw",
      done: false,
      href: "/pool",
    },
  ];

  return (
    <div className="glass rounded-xl px-4 py-2.5 flex items-center gap-2 overflow-x-auto">
      <p className="text-[9px] font-[family-name:var(--font-mono)] text-gold/60 tracking-widest shrink-0">
        JOURNEY
      </p>
      <div className="h-3 w-px bg-void-700/50 shrink-0" />
      {steps.map((step, i) => {
        const isActive =
          (current === "vault" && (step.key === "collateral" || step.key === "mint")) ||
          (current === "pool" && (step.key === "approve" || step.key === "deposit" || step.key === "withdraw"));

        return (
          <div key={step.key} className="flex items-center gap-1.5 shrink-0">
            {step.done ? (
              <CheckCircle className="w-3 h-3 text-green-400" />
            ) : (
              <Circle className={`w-3 h-3 ${isActive ? "text-gold/60" : "text-void-600"}`} />
            )}
            <Link
              href={step.href}
              className={`text-[10px] font-[family-name:var(--font-mono)] transition-colors ${
                step.done
                  ? "text-green-400/70"
                  : isActive
                    ? "text-void-200"
                    : "text-void-500 hover:text-void-300"
              }`}
            >
              {step.label}
            </Link>
            {i < steps.length - 1 && (
              <ArrowRight className="w-2.5 h-2.5 text-void-600 mx-0.5" />
            )}
          </div>
        );
      })}
    </div>
  );
}
