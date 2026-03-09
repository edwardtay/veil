"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HealthBar } from "./health-bar";
import { formatBTC, formatUSD } from "@/lib/format";
import { WBTC_DECIMALS } from "@/lib/constants";
import { useVaultPosition } from "@/hooks/use-vault";
import { useBtcPrice } from "@/hooks/use-btc-price";
import { TrendingUp } from "lucide-react";

export function PositionCard() {
  const { collateral, debt, collateralRatio, isLoading } = useVaultPosition();
  const { price: btcPrice } = useBtcPrice();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Your Position</CardTitle>
          {btcPrice > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-void-400">
              <TrendingUp className="w-4 h-4" />
              <span className="font-[family-name:var(--font-mono)]">
                BTC ${btcPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="h-3 bg-void-800 rounded shimmer w-16" />
                <div className="h-7 bg-void-800 rounded shimmer w-24" />
                <div className="h-3 bg-void-800 rounded shimmer w-10" />
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-void-800 rounded shimmer w-12" />
                <div className="h-7 bg-void-800 rounded shimmer w-20" />
                <div className="h-3 bg-void-800 rounded shimmer w-10" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-void-800 rounded shimmer w-full" />
              <div className="h-1.5 bg-void-800 rounded-full shimmer w-full" />
            </div>
          </div>
        ) : collateral === 0n && debt === 0n ? (
          <div className="text-center py-4">
            <p className="text-void-400 text-sm">No position yet</p>
            <p className="text-void-600 text-xs mt-1 font-[family-name:var(--font-mono)]">
              Claim WBTC from the faucet, then deposit below
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-[10px] text-void-500 uppercase tracking-widest font-[family-name:var(--font-mono)]">
                  Collateral
                </p>
                <p className="text-2xl font-semibold font-[family-name:var(--font-mono)] text-void-50">
                  {formatBTC(collateral)}
                </p>
                <p className="text-xs text-void-500">
                  WBTC
                  {btcPrice > 0 && collateral > 0n && (
                    <span className="text-void-400 ml-1">
                      (~${(
                        (Number(collateral) / 10 ** WBTC_DECIMALS) * btcPrice
                      ).toLocaleString("en-US", { maximumFractionDigits: 0 })})
                    </span>
                  )}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-void-500 uppercase tracking-widest font-[family-name:var(--font-mono)]">
                  Debt
                </p>
                <p className="text-2xl font-semibold font-[family-name:var(--font-mono)] text-void-50">
                  {formatUSD(debt)}
                </p>
                <p className="text-xs text-void-500">vUSD</p>
              </div>
            </div>
            <HealthBar ratioBps={collateralRatio} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
