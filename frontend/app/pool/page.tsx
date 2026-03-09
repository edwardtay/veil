"use client";

import Link from "next/link";
import { useState } from "react";
import { PoolStats } from "@/components/pool/pool-stats";
import { PoolDeposit } from "@/components/pool/pool-deposit";
import { PoolWithdraw } from "@/components/pool/pool-withdraw";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAccount, useConnect, useReadContract, useSendTransaction } from "@starknet-react/core";
import { POOL_ABI } from "@/lib/contracts";
import { POOL_CONFIGS } from "@/lib/constants";
import type { PoolType } from "@/lib/constants";
import { PoolActivity } from "@/components/pool/pool-activity";
import { ArrowLeft, Wallet, Shield, UserCheck, Bitcoin, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { JourneyTracker } from "@/components/journey-tracker";
import { NetworkGuard } from "@/components/network-guard";
import { cn } from "@/lib/cn";

function AspBanner({ poolType }: { poolType: PoolType }) {
  const { address } = useAccount();
  const { sendAsync } = useSendTransaction({});
  const [loading, setLoading] = useState(false);
  const pool = POOL_CONFIGS[poolType];

  const { data: aspStatus } = useReadContract({
    abi: POOL_ABI,
    address: pool.address,
    functionName: "is_approved",
    args: address ? [address] : undefined,
    enabled: !!address,
  });

  const handleRegister = async () => {
    setLoading(true);
    try {
      // Register on ALL denomination pools in a single multicall
      const calls = pool.denominations.map(d => ({
        contractAddress: d.poolAddress,
        entrypoint: "register_for_demo",
        calldata: [],
      }));
      await sendAsync(calls);
      toast.success("Address verified", { description: `You can now use all ${pool.tokenSymbol} privacy pools` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Registration failed";
      toast.error("Registration failed", { description: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass rounded-xl px-4 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Shield className="w-3.5 h-3.5 text-green-400" />
        <span className="text-xs text-void-300">Compliance</span>
      </div>
      {aspStatus ? (
        <span className="text-[10px] font-[family-name:var(--font-mono)] text-green-400 flex items-center gap-1">
          <UserCheck className="w-3 h-3" />
          Verified
        </span>
      ) : (
        <button
          onClick={handleRegister}
          disabled={loading}
          className="text-[10px] font-[family-name:var(--font-mono)] text-amber-300 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
        >
          {loading ? "..." : "Get Verified"}
        </button>
      )}
    </div>
  );
}

function PoolSelector({ poolType, onChange }: { poolType: PoolType; onChange: (p: PoolType) => void }) {
  return (
    <div className="glass rounded-2xl p-1.5 flex gap-1.5">
      <button
        onClick={() => onChange("vusd")}
        className={cn(
          "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
          poolType === "vusd"
            ? "bg-gold/10 border border-gold/30 text-gold"
            : "text-void-400 hover:text-void-200 hover:bg-void-800/50"
        )}
      >
        <DollarSign className="w-4 h-4" />
        vUSD Pool
      </button>
      <button
        onClick={() => onChange("wbtc")}
        className={cn(
          "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
          poolType === "wbtc"
            ? "bg-orange-500/10 border border-orange-500/30 text-orange-400"
            : "text-void-400 hover:text-void-200 hover:bg-void-800/50"
        )}
      >
        <Bitcoin className="w-4 h-4" />
        WBTC Pool
      </button>
    </div>
  );
}

export default function PoolPage() {
  const { isConnected, address } = useAccount();
  const { connect, connectors } = useConnect();
  const [poolType, setPoolType] = useState<PoolType>("vusd");

  const pool = POOL_CONFIGS[poolType];

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      {/* Page header */}
      <div className="animate-fade-up mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl text-void-50">
            Send
          </h1>
          <p className="text-xs text-void-500 font-[family-name:var(--font-mono)] mt-1">
            Step 2 — Shield {pool.tokenSymbol}, send privately
          </p>
        </div>
        <Link
          href="/vault"
          className="inline-flex items-center gap-2 text-xs text-void-500 hover:text-gold transition-colors font-[family-name:var(--font-mono)]"
        >
          <ArrowLeft className="w-3 h-3" />
          Mint
        </Link>
      </div>

      {/* Pool selector */}
      <div className="animate-fade-up delay-50 mb-6">
        <PoolSelector poolType={poolType} onChange={setPoolType} />
      </div>

      {/* Real on-chain pool stats — always visible */}
      <div className="animate-fade-up delay-100 space-y-6">
        <PoolStats pool={pool} />

        {!isConnected ? (
          <>
            {/* Connect prompt */}
            <div className="glass rounded-2xl p-8 text-center">
              <p className="text-void-200 text-lg font-medium">
                Connect wallet to shield or send
              </p>
              <p className="text-void-500 text-sm mt-2 max-w-xs mx-auto">
                {poolType === "vusd" ? (
                  <>
                    Need vUSD?{" "}
                    <Link href="/vault" className="text-gold hover:text-gold-light transition-colors">
                      Mint some
                    </Link>
                  </>
                ) : (
                  "Deposit WBTC directly into the pool"
                )}
              </p>
              <div className="mt-5 flex flex-col items-center gap-2">
                {connectors.map((connector) => (
                  <button
                    key={connector.id}
                    onClick={() => connect({ connector })}
                    className="inline-flex items-center gap-3 px-6 py-2.5 bg-gold hover:bg-gold-light text-void-950 rounded-xl text-sm font-medium transition-colors"
                  >
                    {connector.icon && (
                      <img
                        src={typeof connector.icon === "string" ? connector.icon : connector.icon.light}
                        alt={connector.name}
                        className="w-5 h-5 rounded"
                      />
                    )}
                    Connect {connector.name}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <JourneyTracker current="pool" />
            <NetworkGuard />

            {/* Compliance indicator */}
            <AspBanner poolType={poolType} />

            <Tabs defaultValue="shield">
              <TabsList>
                <TabsTrigger value="shield">Shield</TabsTrigger>
                <TabsTrigger value="send">Send</TabsTrigger>
              </TabsList>
              <TabsContent value="shield">
                <PoolDeposit pool={pool} />
              </TabsContent>
              <TabsContent value="send">
                <PoolWithdraw pool={pool} />
              </TabsContent>
            </Tabs>

          </>
        )}

        {/* Live on-chain activity — visible to everyone */}
        <PoolActivity pool={pool} />
      </div>
    </div>
  );
}
