"use client";

import { usePoolStats } from "@/hooks/use-pool";
import { useBtcPrice } from "@/hooks/use-btc-price";
import { formatUSD, formatBTC } from "@/lib/format";
import type { PoolConfig } from "@/lib/constants";

export function PoolStats({ pool }: { pool: PoolConfig }) {
  const { commitmentCount, depositAmount, isLoading } = usePoolStats(pool);
  const { price: btcPrice } = useBtcPrice();
  const formatAmount = (v: bigint) =>
    pool.tokenDecimals === 8 ? formatBTC(v) : formatUSD(v);

  const totalLocked = isLoading ? "..." : formatAmount(depositAmount * BigInt(commitmentCount));

  return (
    <div className="glass rounded-xl px-5 py-3 flex items-center justify-between text-sm font-[family-name:var(--font-mono)]">
      <div className="flex items-center gap-6">
        <div>
          <span className="text-void-500 text-xs">Deposits</span>
          <p className="text-void-50 font-semibold">{isLoading ? "..." : commitmentCount}</p>
        </div>
        <div className="w-px h-8 bg-void-700/50" />
        <div>
          <span className="text-void-500 text-xs">Fixed</span>
          <p className="text-void-50 font-semibold">{isLoading ? "..." : formatAmount(depositAmount)} {pool.tokenSymbol}</p>
        </div>
        <div className="w-px h-8 bg-void-700/50" />
        <div>
          <span className="text-void-500 text-xs">TVL</span>
          <p className="text-void-50 font-semibold">{totalLocked} {pool.tokenSymbol}</p>
        </div>
      </div>
      {btcPrice > 0 && (
        <div className="text-right">
          <span className="text-void-500 text-xs">BTC</span>
          <p className="text-void-50 font-semibold">${btcPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
        </div>
      )}
    </div>
  );
}
