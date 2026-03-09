"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePoolDeposit } from "@/hooks/use-pool";
import { useAccount, useReadContract, useSendTransaction } from "@starknet-react/core";
import { ERC20_ABI } from "@/lib/contracts";
import { CONTRACTS } from "@/lib/constants";
import { CallData } from "starknet";
import { generateCommitment, computeBN128Commitment, downloadNote, encryptAndDownloadNote, type VeilNote } from "@/lib/crypto";
import { formatUSD, formatBTC } from "@/lib/format";
import { resolvePoolForAmount } from "@/lib/constants";
import type { PoolConfig } from "@/lib/constants";
import Link from "next/link";
import { Download, Lock, AlertTriangle, CheckCircle, Fingerprint, FileKey, Send, ExternalLink, Droplets, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";


type DepositStep = "prepare" | "save" | "deposit" | "done";

const depositSteps = [
  { key: "prepare" as const, label: "Prepare", icon: Fingerprint },
  { key: "save" as const, label: "Save Key", icon: FileKey },
  { key: "deposit" as const, label: "Shield", icon: Send },
];

function StepIndicator({ currentStep }: { currentStep: DepositStep }) {
  const stepOrder: DepositStep[] = ["prepare", "save", "deposit", "done"];
  const currentIdx = stepOrder.indexOf(currentStep);

  return (
    <div className="flex items-center gap-1 mb-4">
      {depositSteps.map((s, i) => {
        const isDone = currentIdx > i || currentStep === "done";
        const isActive = stepOrder[i + 1] === currentStep || (i === 0 && currentStep === "prepare");
        const StepIcon = s.icon;

        return (
          <div key={s.key} className="flex items-center flex-1">
            <div className="flex items-center gap-2 flex-1">
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all duration-300",
                  isDone
                    ? "bg-green-500/20 border border-green-500/40"
                    : isActive
                      ? "bg-gold/20 border border-gold/40"
                      : "bg-void-800 border border-void-700/50"
                )}
              >
                {isDone ? (
                  <CheckCircle className="w-3 h-3 text-green-400" />
                ) : (
                  <StepIcon className={cn("w-3 h-3", isActive ? "text-gold" : "text-void-500")} />
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] font-[family-name:var(--font-mono)] hidden sm:block",
                  isDone ? "text-green-400" : isActive ? "text-gold" : "text-void-500"
                )}
              >
                {s.label}
              </span>
            </div>
            {i < depositSteps.length - 1 && (
              <div
                className={cn(
                  "h-px flex-1 mx-2 transition-colors duration-300",
                  isDone ? "bg-green-500/30" : "bg-void-700/50"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function WbtcFaucet() {
  const { sendAsync } = useSendTransaction({});
  const [claiming, setClaiming] = useState(false);

  const claimWBTC = async () => {
    setClaiming(true);
    try {
      await sendAsync([
        {
          contractAddress: CONTRACTS.wbtc,
          entrypoint: "faucet",
          calldata: CallData.compile({ amount: { low: 100_000_000, high: 0 } }),
        },
      ]);
      toast.success("Faucet claimed", { description: "1 WBTC added to your wallet" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Faucet failed";
      toast.error("Faucet failed", { description: msg });
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="mt-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Droplets className="w-4 h-4 text-blue-400" />
        <p className="text-xs text-void-300">Need test WBTC?</p>
      </div>
      <button
        onClick={claimWBTC}
        disabled={claiming}
        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors disabled:opacity-50"
      >
        {claiming ? "Claiming..." : "Claim 1 WBTC"}
      </button>
    </div>
  );
}

export function PoolDeposit({ pool }: { pool: PoolConfig }) {
  const { isConnected, address } = useAccount();
  const formatAmount = (v: bigint) =>
    pool.tokenDecimals === 8 ? formatBTC(v) : formatUSD(v);

  // Read user's token balance for pre-deposit check
  const { data: balanceData } = useReadContract({
    abi: ERC20_ABI,
    address: pool.tokenAddress,
    functionName: "balance_of",
    args: address ? [address] : undefined,
    enabled: !!address,
    refetchInterval: 10_000,
  });
  const tokenBalance = balanceData ? BigInt(String(balanceData)) : 0n;

  const denominations = pool.denominations;
  const [selectedDenom, setSelectedDenom] = useState(0);

  // Resolve the effective pool for the selected denomination
  const selectedDenomConfig = denominations[selectedDenom] ?? denominations[0];
  const selectedAmount = selectedDenomConfig.depositAmount;
  const effectivePool = resolvePoolForAmount(pool, selectedAmount);

  const { deposit } = usePoolDeposit(effectivePool);

  const [note, setNote] = useState<VeilNote | null>(null);
  const [noteDownloaded, setNoteDownloaded] = useState(false);
  const [notePassword, setNotePassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [txDone, setTxDone] = useState(false);
  const [txHash, setTxHash] = useState("");

  const currentStep: DepositStep = txDone
    ? "done"
    : note && noteDownloaded
      ? "deposit"
      : note
        ? "save"
        : "prepare";

  const handleGenerate = async () => {
    const n = generateCommitment(selectedAmount);
    // Also compute BN128 commitment for the shared privacy registry
    try {
      const bn128 = await computeBN128Commitment(n.nullifier, n.secret, selectedAmount);
      n.bn128Commitment = bn128.commitment;
      n.bn128NullifierHash = bn128.nullifierHash;
    } catch (e) {
      console.warn("[veil] BN128 computation failed, will retry at withdraw:", e);
    }
    setNote(n);
    setNoteDownloaded(false);
    setTxDone(false);
    setError("");
  };

  const handleDownload = async () => {
    if (!note) return;
    if (notePassword) {
      await encryptAndDownloadNote(note, notePassword);
    } else {
      downloadNote(note);
    }
    setNoteDownloaded(true);
  };

  const handleDeposit = async () => {
    if (!note) return;

    // Check balance before attempting transaction
    if (tokenBalance < selectedAmount) {
      const msg = pool.tokenSymbol === "vUSD"
        ? "You don't have enough vUSD. Mint it from the Vault first."
        : `You don't have enough ${pool.tokenSymbol}.`;
      setError(msg);
      toast.error(`Insufficient ${pool.tokenSymbol}`, { description: msg });
      return;
    }

    setLoading(true);
    setError("");
    try {
      const result = await deposit(note.commitment, selectedAmount, note.bn128Commitment);
      if (result?.transaction_hash) setTxHash(result.transaction_hash);
      setTxDone(true);
      // Save note to localStorage for quick demo flow on withdraw tab
      try {
        localStorage.setItem("veil_last_deposit", JSON.stringify(note));
      } catch { /* ignore storage errors */ }
      toast.success("Funds shielded", { description: `Your ${pool.tokenSymbol} is now in the privacy pool` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Transaction failed";
      setError(msg);
      toast.error("Shield failed", { description: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="w-5 h-5 text-gold" />
          Shield
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step progress indicator */}
        <StepIndicator currentStep={currentStep} />

        {/* Denomination picker */}
        <div className="space-y-2">
          <p className="text-[10px] text-void-500 uppercase tracking-widest font-[family-name:var(--font-mono)]">
            Select Amount ({pool.tokenSymbol})
          </p>
          <div className="grid grid-cols-4 gap-2">
            {denominations.map((d, i) => (
              <button
                key={d.label}
                onClick={() => setSelectedDenom(i)}
                className={cn(
                  "py-3 rounded-xl text-center font-[family-name:var(--font-mono)] text-sm font-semibold transition-all",
                  selectedDenom === i
                    ? "bg-gold/15 border-2 border-gold/50 text-gold"
                    : "bg-void-800/50 border border-void-700/30 text-void-400 hover:border-void-600 hover:text-void-300"
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-void-500">
            Fixed per pool — everyone deposits the same amount for unlinkable withdrawals
          </p>
        </div>

        {/* Amount + balance display */}
        <div className="p-4 rounded-xl bg-void-900/80 border border-void-700/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-semibold font-[family-name:var(--font-mono)] text-void-50">
                {formatAmount(selectedAmount)} {pool.tokenSymbol}
              </p>
            </div>
            {isConnected && (
              <p className={cn(
                "text-sm font-[family-name:var(--font-mono)]",
                tokenBalance >= selectedAmount ? "text-green-400" : "text-red-400"
              )}>
                Balance: {formatAmount(tokenBalance)}
              </p>
            )}
          </div>
          {isConnected && tokenBalance < selectedAmount && (
            pool.tokenSymbol === "vUSD" ? (
              <div className="mt-3 p-2.5 rounded-lg bg-red-500/5 border border-red-500/20 text-xs text-red-400">
                Insufficient vUSD. <Link href="/vault" className="text-gold hover:text-gold-light underline">Mint some first</Link>.
              </div>
            ) : (
              <WbtcFaucet />
            )
          )}
        </div>

        {/* Step 1: Generate */}
        {!note && (
          <Button onClick={handleGenerate} disabled={!isConnected} className="w-full">
            {isConnected ? "Prepare Shield" : "Connect Wallet"}
          </Button>
        )}

        {/* Step 2: Download note */}
        {note && !noteDownloaded && (
          <div className="space-y-3 animate-fade-up">
            <div className="flex gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-300">Save your withdrawal key</p>
                <p className="text-amber-400/70 mt-0.5">
                  This file is like a receipt — you&apos;ll need it to send your funds. Without it, they&apos;re gone forever.
                </p>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-void-900/80 border border-void-700/50 text-xs font-[family-name:var(--font-mono)] text-void-400 break-all">
              <span className="text-void-500">Key ID: </span>{note.commitment.slice(0, 20)}...
            </div>
            {/* Optional encryption */}
            <div className="p-3 rounded-xl bg-void-900/60 border border-void-700/30 space-y-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-gold" />
                <span className="text-xs text-void-300">Password-protect note (optional)</span>
              </div>
              <input
                type="password"
                placeholder="Enter password to encrypt"
                value={notePassword}
                onChange={(e) => setNotePassword(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-void-900 border border-void-700/50 text-void-200 placeholder:text-void-600 focus:border-gold/30 focus:outline-none"
              />
              {notePassword && (
                <p className="text-[10px] text-green-400/70 font-[family-name:var(--font-mono)]">
                  Note will be AES-256 encrypted. You&apos;ll need this password to send.
                </p>
              )}
            </div>
            <Button onClick={handleDownload} className="w-full" variant="outline">
              <Download className="w-4 h-4 mr-2" />
              {notePassword ? "Download Encrypted Key" : "Download Withdrawal Key"}
            </Button>
          </div>
        )}

        {/* Step 3: Submit deposit */}
        {note && noteDownloaded && !txDone && (
          <div className="space-y-3 animate-fade-up">
            <div className="p-3 rounded-xl bg-green-500/5 border border-green-500/20 text-sm text-green-400">
              Note saved. You can now shield your funds.
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <Button onClick={handleDeposit} disabled={loading} className="w-full">
              {loading ? "Confirming..." : "Approve & Shield"}
            </Button>
          </div>
        )}

        {/* Done */}
        {txDone && (
          <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20 text-center animate-fade-up space-y-3">
            <CheckCircle className="w-6 h-6 text-green-400 mx-auto mb-1" />
            <p className="text-green-300 font-medium">Funds shielded</p>
            {note && (
              <div className="p-2.5 rounded-lg bg-void-900/60 text-[10px] font-[family-name:var(--font-mono)] text-void-400 break-all text-left">
                <span className="text-void-500">Commitment: </span>
                {note.commitment}
              </div>
            )}
            {txHash && (
              <a
                href={`https://sepolia.voyager.online/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[10px] font-[family-name:var(--font-mono)] text-gold/70 hover:text-gold transition-colors"
              >
                View on Voyager <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <p className="text-green-400/70 text-sm">
              Your {pool.tokenSymbol} is shielded. Switch to the <span className="text-green-300 font-medium">Send</span> tab to send it to any address privately.
            </p>
            <Button onClick={handleGenerate} variant="outline" size="sm">
              Shield Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
