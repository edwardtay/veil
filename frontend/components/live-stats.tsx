"use client";

import { usePoolStats } from "@/hooks/use-pool";
import { useBtcPrice } from "@/hooks/use-btc-price";
import { formatUSD } from "@/lib/format";
import { POOL_CONFIGS } from "@/lib/constants";

export function LiveStats() {
  const { commitmentCount, depositAmount, isLoading } = usePoolStats(POOL_CONFIGS.vusd);
  const { price: btcPrice, isLoading: priceLoading } = useBtcPrice();

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-xs font-[family-name:var(--font-mono)]">
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        <span className="text-void-500">Live on Sepolia</span>
      </div>
      {btcPrice > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-void-500">BTC/USD:</span>
          <span className="text-void-300">
            {priceLoading ? "..." : `$${btcPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          </span>
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="text-void-500">Pool deposits:</span>
        <span className="text-void-300">
          {isLoading ? "..." : commitmentCount}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-void-500">Fixed amount:</span>
        <span className="text-void-300">
          {isLoading ? "..." : `${formatUSD(depositAmount)} vUSD`}
        </span>
      </div>
    </div>
  );
}
