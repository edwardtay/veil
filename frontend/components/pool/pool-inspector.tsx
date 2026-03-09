"use client";

import { useState } from "react";
import { useReadContract, useSendTransaction } from "@starknet-react/core";
import { POOL_ABI } from "@/lib/contracts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Check, X, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import type { PoolConfig } from "@/lib/constants";

export function PoolInspector({ pool }: { pool: PoolConfig }) {
  const [expanded, setExpanded] = useState(false);
  const [nullifierQuery, setNullifierQuery] = useState("");
  const [checkRoot, setCheckRoot] = useState(false);
  const [checkNullifier, setCheckNullifier] = useState(false);
  const [rootSubmitValue, setRootSubmitValue] = useState("");
  const [rootSubmitError, setRootSubmitError] = useState("");
  const { sendAsync } = useSendTransaction({});

  const { data: rootResult, isLoading: rootLoading } = useReadContract({
    abi: POOL_ABI,
    address: pool.address,
    functionName: "get_bn128_root",
    args: checkRoot ? [] : undefined,
    enabled: checkRoot,
  });

  // Convert nullifier string to u256 {low, high} for is_bn128_spent
  const nullBigInt = nullifierQuery ? (() => { try { return BigInt(nullifierQuery); } catch { return 0n; } })() : 0n;
  const nullU256 = { low: nullBigInt & ((1n << 128n) - 1n), high: nullBigInt >> 128n };

  const { data: nullifierResult, isLoading: nullifierLoading } = useReadContract({
    abi: POOL_ABI,
    address: pool.address,
    functionName: "is_bn128_spent",
    args: checkNullifier && nullifierQuery ? [nullU256] : undefined,
    enabled: checkNullifier && !!nullifierQuery,
  });

  const submitRoot = async () => {
    try {
      const value = BigInt(rootSubmitValue.trim());
      if (value <= 0n) {
        setRootSubmitError("Root must be > 0");
        return;
      }
      setRootSubmitError("");
      const low = value & ((1n << 128n) - 1n);
      const high = value >> 128n;
      await sendAsync([
        {
          contractAddress: pool.address,
          entrypoint: "submit_bn128_root",
          calldata: [low.toString(), high.toString()],
        },
      ]);
      setCheckRoot(false);
      setRootSubmitValue("");
    } catch {
      setRootSubmitError("Submit failed (owner wallet required, decimal root expected)");
    }
  };

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-3 flex items-center justify-between hover:bg-void-900/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-gold" />
          <p className="text-xs font-[family-name:var(--font-mono)] text-void-300">
            Protocol Inspector
          </p>
          <span className="text-[9px] font-[family-name:var(--font-mono)] text-void-600">
            Query on-chain contract state
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-void-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-void-500" />
        )}
      </button>
      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-void-800/50 pt-4">
          {/* Root check */}
          <div className="space-y-2">
            <label className="text-xs text-void-400 flex items-center gap-1.5">
              <span className="text-[10px] font-[family-name:var(--font-mono)] text-gold/60 bg-gold/5 px-1.5 py-0.5 rounded">
                get_bn128_root
              </span>
              Current BN128 Merkle root stored on-chain
            </label>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCheckRoot(true)}
                disabled={rootLoading}
              >
                {rootLoading ? "..." : "Fetch Root"}
              </Button>
            </div>
            {checkRoot && rootResult !== undefined && (
              <div className="text-xs font-[family-name:var(--font-mono)] text-void-300 break-all">
                {rootResult.toString()}
              </div>
            )}
          </div>

          {/* Root submit (owner/operator) */}
          <div className="space-y-2">
            <label className="text-xs text-void-400 flex items-center gap-1.5">
              <span className="text-[10px] font-[family-name:var(--font-mono)] text-gold/60 bg-gold/5 px-1.5 py-0.5 rounded">
                submit_bn128_root
              </span>
              Owner/operator root submission
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="Paste BN128 root (decimal)"
                value={rootSubmitValue}
                onChange={(e) => {
                  setRootSubmitValue(e.target.value);
                  setRootSubmitError("");
                }}
                className="text-xs font-[family-name:var(--font-mono)]"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={submitRoot}
                disabled={!rootSubmitValue}
              >
                Submit Root
              </Button>
            </div>
            {rootSubmitError && (
              <p className="text-[11px] text-red-400">{rootSubmitError}</p>
            )}
          </div>

          {/* Nullifier check */}
          <div className="space-y-2">
            <label className="text-xs text-void-400 flex items-center gap-1.5">
              <span className="text-[10px] font-[family-name:var(--font-mono)] text-gold/60 bg-gold/5 px-1.5 py-0.5 rounded">
                is_bn128_spent
              </span>
              Check if a BN128 nullifier has been used (double-spend prevention)
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter nullifier hash (u256)"
                value={nullifierQuery}
                onChange={(e) => {
                  setNullifierQuery(e.target.value);
                  setCheckNullifier(false);
                }}
                className="text-xs font-[family-name:var(--font-mono)]"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCheckNullifier(true)}
                disabled={!nullifierQuery || nullifierLoading}
              >
                {nullifierLoading ? "..." : "Check"}
              </Button>
            </div>
            {checkNullifier && nullifierResult !== undefined && (
              <div
                className={`flex items-center gap-1.5 text-xs font-[family-name:var(--font-mono)] ${
                  nullifierResult ? "text-amber-400" : "text-green-400"
                }`}
              >
                {nullifierResult ? (
                  <X className="w-3 h-3" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
                {nullifierResult ? "Already spent" : "Not spent (available)"}
              </div>
            )}
          </div>

          {/* Contract link */}
          <div className="pt-2 border-t border-void-800/50">
            <a
              href={`https://sepolia.voyager.online/contract/${pool.address}#read-write-contract`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-[family-name:var(--font-mono)] text-void-500 hover:text-gold transition-colors flex items-center gap-1"
            >
              Full contract state on Voyager{" "}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
