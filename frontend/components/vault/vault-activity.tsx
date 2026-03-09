"use client";

import { useEffect, useState } from "react";
import { RpcProvider } from "starknet";
import { CONTRACTS, WBTC_DECIMALS, VUSD_DECIMALS, RPC_URL, RPC_FALLBACK, DEPLOY_BLOCK } from "@/lib/constants";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Coins,
  CreditCard,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";

interface VaultEvent {
  type: "deposit" | "withdraw" | "mint" | "repay" | "liquidation";
  user: string;
  amount: string;
  txHash: string;
  blockNumber: number;
}

const RPC_URLS = [RPC_URL, RPC_FALLBACK];

const eventIcons = {
  deposit: { icon: ArrowDownToLine, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20", label: "Collateral Deposited" },
  withdraw: { icon: ArrowUpFromLine, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", label: "Collateral Withdrawn" },
  mint: { icon: Coins, color: "text-gold", bg: "bg-gold/10 border-gold/20", label: "vUSD Minted" },
  repay: { icon: CreditCard, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20", label: "vUSD Repaid" },
  liquidation: { icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", label: "Position Liquidated" },
};

function formatAmount(hex: string, decimals: number): string {
  try {
    const val = BigInt(hex);
    const num = Number(val) / 10 ** decimals;
    if (num >= 1) return num.toLocaleString("en-US", { maximumFractionDigits: 2 });
    return num.toLocaleString("en-US", { maximumFractionDigits: 8 });
  } catch {
    return "?";
  }
}

async function fetchVaultEvents(): Promise<VaultEvent[]> {
  for (const rpcUrl of RPC_URLS) {
    try {
      const provider = new RpcProvider({ nodeUrl: rpcUrl });
      const result = await provider.getEvents({
        address: CONTRACTS.vault,
        from_block: { block_number: DEPLOY_BLOCK },
        to_block: "latest",
        chunk_size: 100,
      });

      return result.events
        .filter((evt) => evt.keys.length >= 2 && evt.data.length >= 2)
        .map((evt): VaultEvent => {
          const user = evt.keys[1];
          const amountLow = evt.data[0];
          const low = BigInt(amountLow);

          // Classify by amount magnitude (heuristic)
          const isVusd = low > BigInt(1e15);
          const type = isVusd ? "mint" : "deposit";
          const decimals = isVusd ? VUSD_DECIMALS : WBTC_DECIMALS;
          const amount = formatAmount(amountLow, decimals);
          const unit = isVusd ? "vUSD" : "WBTC";

          return {
            type,
            user,
            amount: `${amount} ${unit}`,
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

export function VaultActivity() {
  const [events, setEvents] = useState<VaultEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVaultEvents()
      .then(setEvents)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="glass rounded-2xl overflow-hidden animate-pulse">
        <div className="px-5 py-3 border-b border-void-800/50 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-void-700" />
          <div className="h-3 w-24 bg-void-800 rounded" />
        </div>
        <div className="divide-y divide-void-800/30">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="px-5 py-3 flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-void-800" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-28 bg-void-800 rounded" />
                <div className="h-2.5 w-36 bg-void-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (events.length === 0) return null;

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-void-800/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <p className="text-xs font-[family-name:var(--font-mono)] text-void-300">
            Vault Activity
          </p>
          <span className="text-[10px] font-[family-name:var(--font-mono)] text-void-600">
            {events.length} {events.length === 1 ? "transaction" : "transactions"}
          </span>
        </div>
        <a
          href={`https://sepolia.voyager.online/contract/${CONTRACTS.vault}#events`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-[family-name:var(--font-mono)] text-void-500 hover:text-gold transition-colors flex items-center gap-1"
        >
          Voyager <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      <div className="divide-y divide-void-800/30 max-h-[240px] overflow-y-auto">
        {events.map((evt, i) => {
          const config = eventIcons[evt.type];
          const Icon = config.icon;
          return (
            <div
              key={i}
              className="px-5 py-3 flex items-center gap-3 hover:bg-void-900/30 transition-colors group"
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${config.bg}`}>
                <Icon className={`w-3.5 h-3.5 ${config.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-void-200">{config.label}</p>
                <p className="text-[10px] font-[family-name:var(--font-mono)] text-void-500">
                  {evt.amount} · {evt.user.slice(0, 10)}...
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
          );
        })}
      </div>
    </div>
  );
}
