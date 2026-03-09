"use client";

import Link from "next/link";
import { useState } from "react";
import { PositionCard } from "@/components/vault/position-card";
import { VaultActions } from "@/components/vault/vault-actions";
import { useAccount, useConnect, useSendTransaction, useProvider } from "@starknet-react/core";
import { useBtcPrice } from "@/hooks/use-btc-price";
import { useWbtcBalance } from "@/hooks/use-vusd";
import { formatBTC } from "@/lib/format";
import { CONTRACTS } from "@/lib/constants";
import { ArrowRight, Wallet, TrendingUp, Shield, Percent, AlertTriangle, ArrowDown, Coins, Lock, Droplets, Fingerprint } from "lucide-react";
import { toast } from "sonner";
import { JourneyTracker } from "@/components/journey-tracker";
import { NetworkGuard } from "@/components/network-guard";
import { VaultActivity } from "@/components/vault/vault-activity";
import { useVusdBalance } from "@/hooks/use-vusd";

function FaucetBanner() {
  const { account, address, chainId } = useAccount();
  const { balance: wbtcBalance } = useWbtcBalance();
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState("");

  const claimWBTC = async () => {
    if (!account) {
      toast.error("Wallet not connected");
      return;
    }
    setLoading(true);
    const log = (msg: string) => setDebugInfo(prev => prev + msg + "\n");
    setDebugInfo("");
    log(`chainId: ${chainId} (${typeof chainId})`);
    log(`address: ${address}`);
    log(`account type: ${account.constructor?.name}`);
    log(`account.cairoVersion: ${(account as unknown as Record<string,unknown>).cairoVersion}`);

    const call = {
      contractAddress: CONTRACTS.wbtc,
      entrypoint: "faucet",
      calldata: ["100000000", "0"],
    };

    try {
      const { RpcProvider } = await import("starknet");
      const provider = new RpcProvider({ nodeUrl: "https://api.cartridge.gg/x/starknet/sepolia" });

      // Check ETH + STRK balances
      const ethAddr = "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";
      const strkAddr = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
      const [ethBal, strkBal] = await Promise.all([
        provider.callContract({ contractAddress: ethAddr, entrypoint: "balanceOf", calldata: [address!] }, "latest"),
        provider.callContract({ contractAddress: strkAddr, entrypoint: "balanceOf", calldata: [address!] }, "latest"),
      ]);
      const ethVal = BigInt(ethBal[0]);
      const strkVal = BigInt(strkBal[0]);
      log(`ETH: ${(Number(ethVal) / 1e18).toFixed(6)}`);
      log(`STRK: ${(Number(strkVal) / 1e18).toFixed(6)}`);
      if (strkVal === 0n) log("⚠️ NO STRK — Argent needs STRK for gas!");
      if (ethVal === 0n) log("⚠️ NO ETH either!");

      // RPC simulation
      try {
        await provider.callContract(
          { contractAddress: call.contractAddress, entrypoint: call.entrypoint, calldata: call.calldata },
          "latest",
        );
        log("✅ RPC call simulation: OK");
      } catch (e) {
        log(`❌ RPC simulation: ${e}`);
      }

      // Try estimateInvokeFee with both v1 (ETH) and v3 (STRK)
      try {
        const estV1 = await account.estimateInvokeFee([call], { version: "0x1" as never });
        log(`✅ Fee estimate v1 (ETH): ${estV1.suggestedMaxFee?.toString()}`);
      } catch (e) {
        log(`❌ Fee estimate v1 (ETH): ${e instanceof Error ? e.message.slice(0, 150) : e}`);
      }
      try {
        const estV3 = await account.estimateInvokeFee([call], { version: "0x3" as never });
        log(`✅ Fee estimate v3 (STRK): ${estV3.suggestedMaxFee?.toString()}`);
      } catch (e) {
        log(`❌ Fee estimate v3 (STRK): ${e instanceof Error ? e.message.slice(0, 150) : e}`);
      }

      // Try executing with explicit v1 to force ETH fees
      log("Sending tx with account.execute (v1 ETH fees)...");
      const tx = await account.execute([call], { version: "0x1" as never });
      log(`✅ TX hash: ${tx.transaction_hash}`);
      toast.success("Faucet claimed!", { description: `TX: ${tx.transaction_hash.slice(0, 16)}...` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      log(`❌ FINAL ERROR: ${msg}`);
      // Try to extract useful info from error
      if (e && typeof e === "object") {
        const keys = Object.keys(e);
        if (keys.length > 0) log(`Error keys: ${keys.join(", ")}`);
        const err = e as Record<string, unknown>;
        if (err.data) log(`Error data: ${JSON.stringify(err.data).slice(0, 300)}`);
        if (err.code) log(`Error code: ${err.code}`);
      }
      toast.error("Failed", { description: msg.slice(0, 200) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass rounded-xl p-3 border border-blue-500/20 bg-blue-500/5 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Droplets className="w-4 h-4 text-blue-400" />
          <div>
            <p className="text-xs text-void-200 font-medium">
              {wbtcBalance > 0n ? (
                <>Wallet: <span className="text-blue-300 font-[family-name:var(--font-mono)]">{formatBTC(wbtcBalance)} WBTC</span></>
              ) : (
                "Need test WBTC?"
              )}
            </p>
            <p className="text-[10px] font-[family-name:var(--font-mono)] text-void-500">Sepolia testnet faucet — mints 1 WBTC</p>
          </div>
        </div>
        <button
          onClick={claimWBTC}
          disabled={loading}
          className="px-4 py-1.5 text-xs font-medium rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors disabled:opacity-50"
        >
          {loading ? "Claiming..." : "Claim 1 WBTC"}
        </button>
      </div>
      {debugInfo && (
        <pre className="p-3 text-xs font-[family-name:var(--font-mono)] text-yellow-300 bg-black/80 rounded-lg overflow-x-auto whitespace-pre-wrap leading-relaxed border border-yellow-500/20">
          {debugInfo}
        </pre>
      )}
    </div>
  );
}

export default function VaultPage() {
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { price: btcPrice } = useBtcPrice();
  const { balance: vusdBalance } = useVusdBalance();

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      {/* Page header */}
      <div className="animate-fade-up mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl text-void-50">
            Mint
          </h1>
          <p className="text-xs text-void-500 font-[family-name:var(--font-mono)] mt-1">
            Step 1 — Deposit BTC, get vUSD
          </p>
        </div>
        {isConnected && (
          <Link
            href="/pool"
            className="inline-flex items-center gap-2 text-xs text-void-500 hover:text-gold transition-colors font-[family-name:var(--font-mono)]"
          >
            Next: Send
            <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>

      {!isConnected ? (
        <div className="animate-fade-up delay-100 space-y-6">
          {/* Live price + mock preview */}
          {btcPrice > 0 && (
            <div className="glass rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-gold" />
                <div>
                  <p className="text-sm font-[family-name:var(--font-mono)] text-void-100">BTC ${btcPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                  <p className="text-[10px] font-[family-name:var(--font-mono)] text-void-500">Live BTC/USD</p>
                </div>
              </div>
              <span className="text-[9px] font-[family-name:var(--font-mono)] text-green-400/70 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20 flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                LIVE
              </span>
            </div>
          )}
          <div className="glass rounded-2xl p-6 opacity-50 pointer-events-none select-none relative">
            <span className="absolute top-3 right-3 text-[9px] font-[family-name:var(--font-mono)] text-void-500 uppercase tracking-widest">Example</span>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className="text-[10px] text-void-500 uppercase tracking-widest font-[family-name:var(--font-mono)]">Collateral</p>
                <p className="text-xl font-semibold font-[family-name:var(--font-mono)] text-void-50 mt-1">0.15 WBTC</p>
                <p className="text-xs text-void-500">~$15,000</p>
              </div>
              <div>
                <p className="text-[10px] text-void-500 uppercase tracking-widest font-[family-name:var(--font-mono)]">Minted</p>
                <p className="text-xl font-semibold font-[family-name:var(--font-mono)] text-void-50 mt-1">8,000 vUSD</p>
              </div>
              <div>
                <p className="text-[10px] text-void-500 uppercase tracking-widest font-[family-name:var(--font-mono)]">Health</p>
                <p className="text-xl font-semibold font-[family-name:var(--font-mono)] text-green-400 mt-1">187%</p>
              </div>
            </div>
          </div>
          {/* Connect prompt */}
          <div className="glass rounded-2xl p-10 text-center">
            <div className="w-12 h-12 rounded-full bg-void-800 flex items-center justify-center mx-auto mb-5">
              <Wallet className="w-5 h-5 text-void-400" />
            </div>
            <p className="text-void-200 text-lg font-medium">
              Connect wallet to mint vUSD
            </p>
            <p className="text-void-500 text-sm mt-2 max-w-xs mx-auto">
              Deposit WBTC as collateral and mint vUSD stablecoins at 150% collateral ratio
            </p>
            <div className="mt-6 flex flex-col items-center gap-2">
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

          {/* How it works flow */}
          <div className="glass rounded-2xl p-6">
            <p className="text-[10px] font-[family-name:var(--font-mono)] text-gold/60 tracking-widest mb-4">
              HOW IT WORKS
            </p>
            <div className="flex flex-col items-center gap-2">
              {[
                { icon: Lock, label: "Deposit WBTC", detail: "Lock Bitcoin as collateral", color: "text-gold", bg: "bg-gold/10 border-gold/20" },
                { icon: Coins, label: "Borrow vUSD", detail: "Get stablecoins at 150% safety ratio", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
                { icon: Shield, label: "Send Privately", detail: "Use vUSD in the privacy pool", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
              ].map((step, i) => (
                <div key={i} className="w-full">
                  <div className={`flex items-center gap-3 p-3 rounded-xl border ${step.bg}`}>
                    <step.icon className={`w-5 h-5 ${step.color} shrink-0`} />
                    <div>
                      <p className={`text-sm font-medium ${step.color}`}>{step.label}</p>
                      <p className="text-[10px] font-[family-name:var(--font-mono)] text-void-500">{step.detail}</p>
                    </div>
                  </div>
                  {i < 2 && (
                    <div className="flex justify-center py-1">
                      <ArrowDown className="w-3 h-3 text-void-600" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Protocol parameters */}
          <div className="grid grid-cols-3 gap-3">
            <div className="glass rounded-xl p-4 text-center">
              <Percent className="w-4 h-4 text-gold mx-auto mb-2" />
              <p className="text-lg font-semibold font-[family-name:var(--font-mono)] text-void-50">150%</p>
              <p className="text-[10px] text-void-500 font-[family-name:var(--font-mono)]">Safety Ratio</p>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <AlertTriangle className="w-4 h-4 text-amber-400 mx-auto mb-2" />
              <p className="text-lg font-semibold font-[family-name:var(--font-mono)] text-void-50">120%</p>
              <p className="text-[10px] text-void-500 font-[family-name:var(--font-mono)]">Liquidation</p>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <Shield className="w-4 h-4 text-green-400 mx-auto mb-2" />
              <p className="text-lg font-semibold font-[family-name:var(--font-mono)] text-void-50">10%</p>
              <p className="text-[10px] text-void-500 font-[family-name:var(--font-mono)]">Penalty Fee</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="animate-fade-up delay-100 space-y-6">
          <JourneyTracker current="vault" />
          <NetworkGuard />
          <FaucetBanner />
          <PositionCard />
          <VaultActions />
          {vusdBalance > 0n && (
            <Link
              href="/pool"
              className="group flex items-center justify-between p-4 glass rounded-2xl border border-gold/20 bg-gold/[0.03] hover:bg-gold/[0.06] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-gold/10 border border-gold/20 p-2.5">
                  <Fingerprint className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <p className="text-sm font-medium text-void-100">Ready to send privately</p>
                  <p className="text-[10px] font-[family-name:var(--font-mono)] text-void-500">
                    You have vUSD — send it privately
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gold transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
      )}

      {/* Vault activity — visible to everyone */}
      <div className="animate-fade-up delay-200 mt-6">
        <VaultActivity />
      </div>
    </div>
  );
}
