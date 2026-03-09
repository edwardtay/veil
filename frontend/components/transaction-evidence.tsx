"use client";

import { useEffect, useState } from "react";
import { RpcProvider } from "starknet";
import { CONTRACTS, RPC_URL, RPC_FALLBACK, DEPLOY_BLOCK } from "@/lib/constants";
import {
  ExternalLink,
  ArrowDown,
  ArrowUp,
  ShieldCheck,
  CheckCircle,
  ArrowDownToLine,
  Coins,
} from "lucide-react";

interface TxEvent {
  type: "pool-deposit" | "withdrawal" | "zk-withdrawal" | "asp-approval" | "vault-deposit" | "vault-mint";
  label: string;
  detail: string;
  txHash: string;
  color: string;
  bg: string;
  icon: React.ElementType;
}

const RPC_URLS = [RPC_URL, RPC_FALLBACK];

async function fetchAllEvents(): Promise<TxEvent[]> {
  for (const rpcUrl of RPC_URLS) {
    try {
      const provider = new RpcProvider({ nodeUrl: rpcUrl });

      // Fetch pool events
      const poolResult = await provider.getEvents({
        address: CONTRACTS.pool,
        from_block: { block_number: DEPLOY_BLOCK },
        to_block: "latest",
        chunk_size: 100,
      });

      // Fetch vault events
      const vaultResult = await provider.getEvents({
        address: CONTRACTS.vault,
        from_block: { block_number: DEPLOY_BLOCK },
        to_block: "latest",
        chunk_size: 100,
      });

      const poolEvents: TxEvent[] = poolResult.events
        .filter((evt) => evt.keys.length >= 2)
        .map((evt): TxEvent => {
          const dataLen = evt.data.length;
          if (dataLen >= 2) {
            const leafIdx = parseInt(evt.data[0], 16);
            return {
              type: "pool-deposit",
              label: `Pool Deposit #${leafIdx}`,
              detail: evt.keys[1].slice(0, 18) + "...",
              txHash: evt.transaction_hash,
              color: "text-green-400",
              bg: "bg-green-500/10 border-green-500/20",
              icon: ArrowDown,
            };
          }
          if (dataLen === 1) {
            const val = evt.data[0];
            if (val === "0x1" || val === "0x0") {
              return {
                type: "asp-approval",
                label: "ASP Approval",
                detail: evt.keys[1].slice(0, 18) + "...",
                txHash: evt.transaction_hash,
                color: "text-gold",
                bg: "bg-gold/10 border-gold/20",
                icon: ShieldCheck,
              };
            }
            return {
              type: "withdrawal",
              label: "Private Withdrawal",
              detail: `to ${val.slice(0, 14)}...`,
              txHash: evt.transaction_hash,
              color: "text-blue-400",
              bg: "bg-blue-500/10 border-blue-500/20",
              icon: ArrowUp,
            };
          }
          return {
            type: "pool-deposit",
            label: "Pool Deposit",
            detail: evt.transaction_hash.slice(0, 18) + "...",
            txHash: evt.transaction_hash,
            color: "text-green-400",
            bg: "bg-green-500/10 border-green-500/20",
            icon: ArrowDown,
          };
        });

      const vaultEvents: TxEvent[] = vaultResult.events
        .filter((evt) => evt.keys.length >= 2 && evt.data.length >= 2)
        .map((evt): TxEvent => {
          const amountLow = BigInt(evt.data[0]);
          const isVusd = amountLow > BigInt(1e15);
          return {
            type: isVusd ? "vault-mint" : "vault-deposit",
            label: isVusd ? "vUSD Minted" : "WBTC Deposited",
            detail: isVusd
              ? `${(Number(amountLow) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 0 })} vUSD`
              : `${(Number(amountLow) / 1e8).toFixed(4)} WBTC`,
            txHash: evt.transaction_hash,
            color: isVusd ? "text-gold" : "text-emerald-400",
            bg: isVusd ? "bg-gold/10 border-gold/20" : "bg-emerald-500/10 border-emerald-500/20",
            icon: isVusd ? Coins : ArrowDownToLine,
          };
        });

      // Combine all events
      const all = [...poolEvents, ...vaultEvents];
      // Sort by type for display
      const typeOrder = ["vault-deposit", "vault-mint", "asp-approval", "pool-deposit", "withdrawal", "zk-withdrawal"];
      all.sort((a, b) => typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type));

      // Deduplicate by txHash
      const seen = new Set<string>();
      const unique = all.filter((evt) => {
        if (seen.has(evt.txHash)) return false;
        seen.add(evt.txHash);
        return true;
      });

      return unique;
    } catch {
      continue;
    }
  }
  return [];
}

export function TransactionEvidence() {
  const [events, setEvents] = useState<TxEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllEvents()
      .then(setEvents)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="glass rounded-2xl overflow-hidden animate-pulse">
        <div className="px-6 py-4 border-b border-void-800/60">
          <div className="h-3 w-24 bg-void-800 rounded mb-2" />
          <div className="h-5 w-56 bg-void-800 rounded" />
          <div className="flex gap-4 mt-3">
            <div className="h-3 w-16 bg-void-800 rounded" />
            <div className="h-3 w-20 bg-void-800 rounded" />
            <div className="h-3 w-16 bg-void-800 rounded" />
          </div>
        </div>
        <div className="px-6 py-4 border-b border-void-800/40 space-y-2.5">
          <div className="h-3 w-40 bg-void-800 rounded" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-lg bg-void-800" />
              <div className="h-3 w-24 bg-void-800 rounded" />
              <div className="flex-1" />
              <div className="h-3 w-20 bg-void-800 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (events.length === 0) return null;

  const deposits = events.filter((e) => e.type === "pool-deposit");
  const withdrawals = events.filter((e) => e.type === "withdrawal");
  const zkWithdrawals = events.filter((e) => e.type === "zk-withdrawal");
  const vaultOps = events.filter((e) => e.type === "vault-deposit" || e.type === "vault-mint");

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-void-800/60">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-[family-name:var(--font-mono)] text-gold/60 tracking-widest mb-1">
              ON-CHAIN EVIDENCE
            </p>
            <p className="text-lg font-[family-name:var(--font-display)] text-void-50">
              Real Transactions on Starknet Sepolia
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] font-[family-name:var(--font-mono)] text-green-400/70">
              LIVE
            </span>
          </div>
        </div>
        {/* Summary counters */}
        <div className="flex items-center gap-4 mt-3">
          {[
            { count: vaultOps.length, label: "Vault ops", color: "text-emerald-400" },
            { count: deposits.length, label: "Pool deposits", color: "text-green-400" },
            { count: zkWithdrawals.length, label: "ZK withdrawals", color: "text-purple-400" },
            { count: withdrawals.length, label: "Withdrawals", color: "text-blue-400" },
          ].map((stat, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className={`text-sm font-semibold font-[family-name:var(--font-mono)] ${stat.color}`}>
                {stat.count}
              </span>
              <span className="text-[10px] font-[family-name:var(--font-mono)] text-void-500">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Full flow evidence: show one tx per type */}
      <div className="px-6 py-4 border-b border-void-800/40">
        <p className="text-[10px] font-[family-name:var(--font-mono)] text-void-500 uppercase tracking-widest mb-3">
          End-to-End Flow (verified on-chain)
        </p>
        <div className="flex flex-col gap-2">
          {["vault-deposit", "vault-mint", "asp-approval", "pool-deposit", "zk-withdrawal", "withdrawal"].map((type) => {
            const evt = events.find((e) => e.type === type);
            if (!evt) return null;
            const Icon = evt.icon;
            return (
              <div key={type} className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border ${evt.bg}`}>
                  <Icon className={`w-3 h-3 ${evt.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${evt.color}`}>{evt.label}</span>
                    <CheckCircle className="w-3 h-3 text-green-400/60" />
                  </div>
                </div>
                <a
                  href={`https://sepolia.voyager.online/tx/${evt.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-[family-name:var(--font-mono)] text-void-600 hover:text-gold transition-colors flex items-center gap-1 shrink-0"
                >
                  {evt.txHash.slice(0, 12)}...
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            );
          })}
        </div>
      </div>

      {/* All transactions */}
      <div className="divide-y divide-void-800/30 max-h-[280px] overflow-y-auto">
        {events.map((evt, i) => {
          const Icon = evt.icon;
          return (
            <div
              key={i}
              className="px-6 py-2.5 flex items-center gap-3 hover:bg-void-900/30 transition-colors group"
            >
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border ${evt.bg}`}>
                <Icon className={`w-3 h-3 ${evt.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-void-200">{evt.label}</p>
                <p className="text-[10px] font-[family-name:var(--font-mono)] text-void-500 truncate">
                  {evt.detail}
                </p>
              </div>
              <a
                href={`https://sepolia.voyager.online/tx/${evt.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-void-600 hover:text-gold transition-colors shrink-0 opacity-0 group-hover:opacity-100"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          );
        })}
      </div>

      {/* Footer with explorer links */}
      <div className="px-6 py-3 border-t border-void-800/40 flex items-center justify-between">
        <span className="text-[10px] font-[family-name:var(--font-mono)] text-void-600">
          {events.length} total transactions
        </span>
        <div className="flex items-center gap-3">
          <a
            href={`https://sepolia.voyager.online/contract/${CONTRACTS.pool}#events`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-[family-name:var(--font-mono)] text-void-500 hover:text-gold transition-colors flex items-center gap-1"
          >
            Pool <ExternalLink className="w-2.5 h-2.5" />
          </a>
          <a
            href={`https://sepolia.voyager.online/contract/${CONTRACTS.vault}#events`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-[family-name:var(--font-mono)] text-void-500 hover:text-gold transition-colors flex items-center gap-1"
          >
            Vault <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
