"use client";

import { useEffect, useState } from "react";
import { RpcProvider } from "starknet";
import { CONTRACTS, RPC_URL, RPC_FALLBACK, DEPLOY_BLOCK } from "@/lib/constants";
import type { PoolConfig } from "@/lib/constants";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";

interface PoolEvent {
  type: "deposit" | "withdraw" | "approval";
  commitment?: string;
  leafIndex?: number;
  nullifierHash?: string;
  recipient?: string;
  addr?: string;
  txHash: string;
  blockNumber: number;
}

async function fetchWithFallback(poolAddress: string): Promise<PoolEvent[]> {
  for (const rpcUrl of [RPC_URL, RPC_FALLBACK]) {
    try {
      const provider = new RpcProvider({ nodeUrl: rpcUrl });
      const result = await provider.getEvents({
        address: poolAddress,
        from_block: { block_number: DEPLOY_BLOCK },
        to_block: "latest",
        chunk_size: 100,
      });

      return result.events
        .filter((evt) => evt.keys.length >= 2)
        .map((evt): PoolEvent => {
          const dataLen = evt.data.length;

          if (dataLen >= 2) {
            return {
              type: "deposit",
              commitment: evt.keys[1],
              leafIndex: parseInt(evt.data[0], 16),
              txHash: evt.transaction_hash,
              blockNumber: evt.block_number,
            };
          }

          if (dataLen === 1) {
            const val = evt.data[0];
            if (val === "0x1" || val === "0x0") {
              return {
                type: "approval",
                addr: evt.keys[1],
                txHash: evt.transaction_hash,
                blockNumber: evt.block_number,
              };
            }
            return {
              type: "withdraw",
              nullifierHash: evt.keys[1],
              recipient: val,
              txHash: evt.transaction_hash,
              blockNumber: evt.block_number,
            };
          }

          return {
            type: "deposit",
            txHash: evt.transaction_hash,
            blockNumber: evt.block_number,
          };
        })
        .reverse();
    } catch {
      continue;
    }
  }
  return [];
}

export function PoolActivity({ pool }: { pool: PoolConfig }) {
  const [events, setEvents] = useState<PoolEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchWithFallback(pool.address)
      .then(setEvents)
      .finally(() => setLoading(false));
  }, [pool.address]);

  if (loading) {
    return (
      <div className="glass rounded-2xl overflow-hidden animate-pulse">
        <div className="px-5 py-3 border-b border-void-800/50 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-void-700" />
          <div className="h-3 w-28 bg-void-800 rounded" />
        </div>
        <div className="divide-y divide-void-800/30">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="px-5 py-3 flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-void-800" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-24 bg-void-800 rounded" />
                <div className="h-2.5 w-40 bg-void-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (events.length === 0) return null;

  const deposits = events.filter((e) => e.type === "deposit");
  const withdrawals = events.filter((e) => e.type === "withdraw");
  const approvals = events.filter((e) => e.type === "approval");

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-void-800/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <p className="text-xs font-[family-name:var(--font-mono)] text-void-300">
            On-Chain Activity
          </p>
          <span className="text-[10px] font-[family-name:var(--font-mono)] text-void-600">
            {deposits.length} {deposits.length === 1 ? "deposit" : "deposits"}{withdrawals.length > 0 ? ` · ${withdrawals.length} ${withdrawals.length === 1 ? "withdrawal" : "withdrawals"}` : ""}{approvals.length > 0 ? ` · ${approvals.length} ${approvals.length === 1 ? "approval" : "approvals"}` : ""}
          </span>
        </div>
        <a
          href={`https://sepolia.voyager.online/contract/${pool.address}#events`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-[family-name:var(--font-mono)] text-void-500 hover:text-gold transition-colors flex items-center gap-1"
        >
          Voyager <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      <div className="divide-y divide-void-800/30 max-h-[320px] overflow-y-auto">
        {events.map((evt, i) => (
          <div
            key={i}
            className="px-5 py-3 flex items-center gap-3 hover:bg-void-900/30 transition-colors group"
          >
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                evt.type === "deposit"
                  ? "bg-green-500/10 border border-green-500/20"
                  : evt.type === "withdraw"
                    ? "bg-blue-500/10 border border-blue-500/20"
                    : "bg-gold/10 border border-gold/20"
              }`}
            >
              {evt.type === "deposit" ? (
                <ArrowDown className="w-3.5 h-3.5 text-green-400" />
              ) : evt.type === "withdraw" ? (
                <ArrowUp className="w-3.5 h-3.5 text-blue-400" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-gold" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-void-200">
                {evt.type === "deposit" &&
                  `Deposit${evt.leafIndex !== undefined ? ` #${evt.leafIndex}` : ""}`}
                {evt.type === "withdraw" && "Private Withdrawal"}
                {evt.type === "approval" && "ASP Approval"}
              </p>
              <p className="text-[10px] font-[family-name:var(--font-mono)] text-void-500 truncate">
                {evt.type === "deposit" && evt.commitment
                  ? evt.commitment.slice(0, 22) + "..."
                  : evt.type === "withdraw" && evt.nullifierHash
                    ? evt.nullifierHash.slice(0, 22) + "..."
                    : evt.type === "approval" && evt.addr
                      ? evt.addr.slice(0, 22) + "..."
                      : evt.txHash.slice(0, 22) + "..."}
              </p>
            </div>
            <a
              href={`https://sepolia.voyager.online/tx/${evt.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-void-600 hover:text-gold transition-colors shrink-0 opacity-0 group-hover:opacity-100"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
