"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useVaultActions, useVaultPosition } from "@/hooks/use-vault";
import { useBtcPrice } from "@/hooks/use-btc-price";
import { useAccount } from "@starknet-react/core";
import { useWbtcBalance, useVusdBalance } from "@/hooks/use-vusd";
import { parseWBTC, parseVUSD, formatBTC, formatUSD } from "@/lib/format";
import { WBTC_DECIMALS, VUSD_DECIMALS } from "@/lib/constants";
import { ArrowDownToLine, ArrowUpFromLine, Coins, CreditCard, ArrowRight, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

function ActionForm({
  label,
  placeholder,
  buttonText,
  icon: Icon,
  onSubmit,
  parse,
  hint,
  maxLabel,
  onMax,
}: {
  label: string;
  placeholder: string;
  buttonText: string;
  icon: React.ElementType;
  onSubmit: (amount: bigint) => Promise<unknown>;
  parse: (v: string) => bigint;
  hint?: string;
  maxLabel?: string;
  onMax?: (setValue: (v: string) => void) => void;
}) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { isConnected } = useAccount();

  const handleSubmit = async () => {
    setError("");
    const amount = parse(value);
    if (amount <= 0n) {
      setError("Enter a valid amount");
      return;
    }
    setLoading(true);
    try {
      await onSubmit(amount);
      setValue("");
      toast.success("Transaction submitted", { description: `${buttonText} confirmed` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Transaction failed";
      setError(msg);
      toast.error("Transaction failed", { description: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm text-void-400">{label}</label>
        {maxLabel && onMax && (
          <button
            onClick={() => onMax(setValue)}
            className="text-[10px] font-[family-name:var(--font-mono)] text-gold/70 hover:text-gold transition-colors"
          >
            {maxLabel}
          </button>
        )}
      </div>
      <Input
        type="text"
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {hint && !error && (
        <p className="text-[10px] font-[family-name:var(--font-mono)] text-void-500">{hint}</p>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
      <Button
        onClick={handleSubmit}
        disabled={!isConnected || loading || !value}
        className="w-full"
      >
        <Icon className="w-4 h-4 mr-2" />
        {loading ? "Confirming..." : !isConnected ? "Connect Wallet" : buttonText}
      </Button>
    </div>
  );
}

function QuickMintForm({ btcPrice }: { btcPrice: number }) {
  const [wbtcValue, setWbtcValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { isConnected } = useAccount();
  const { balance: wbtcBalance } = useWbtcBalance();
  const { depositAndMint } = useVaultActions();

  const wbtcAmount = parseWBTC(wbtcValue);
  const estimatedVusd = btcPrice > 0 && wbtcAmount > 0n
    ? Math.floor((Number(wbtcAmount) / 10 ** WBTC_DECIMALS) * btcPrice / 1.5)
    : 0;

  const handleSubmit = async () => {
    setError("");
    if (wbtcAmount <= 0n) {
      setError("Enter a valid WBTC amount");
      return;
    }
    if (estimatedVusd <= 0) {
      setError("BTC price unavailable");
      return;
    }
    setLoading(true);
    try {
      const vusdAmount = BigInt(estimatedVusd) * 10n ** BigInt(VUSD_DECIMALS);
      await depositAndMint(wbtcAmount, vusdAmount);
      setWbtcValue("");
      toast.success("Quick Mint complete", { description: `Deposited WBTC and minted ~${estimatedVusd} vUSD` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Transaction failed";
      setError(msg);
      toast.error("Transaction failed", { description: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm text-void-400">WBTC to deposit &amp; mint</label>
        {wbtcBalance > 0n && (
          <button
            onClick={() => setWbtcValue((Number(wbtcBalance) / 10 ** WBTC_DECIMALS).toString())}
            className="text-[10px] font-[family-name:var(--font-mono)] text-gold/70 hover:text-gold transition-colors"
          >
            Max: {formatBTC(wbtcBalance)}
          </button>
        )}
      </div>
      <Input
        type="text"
        inputMode="decimal"
        placeholder="0.00 WBTC"
        value={wbtcValue}
        onChange={(e) => setWbtcValue(e.target.value)}
      />
      {estimatedVusd > 0 && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/5 border border-green-500/20">
          <ArrowRight className="w-3 h-3 text-green-400" />
          <span className="text-xs text-green-400 font-[family-name:var(--font-mono)]">
            ≈ {estimatedVusd.toLocaleString()} vUSD at 150% ratio
          </span>
        </div>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
      <p className="text-[10px] font-[family-name:var(--font-mono)] text-void-500">
        One wallet confirmation: approve + deposit + mint
      </p>
      <Button
        onClick={handleSubmit}
        disabled={!isConnected || loading || !wbtcValue}
        className="w-full"
      >
        <Zap className="w-4 h-4 mr-2" />
        {loading ? "Confirming..." : !isConnected ? "Connect Wallet" : "Quick Mint vUSD"}
      </Button>
    </div>
  );
}

export function VaultActions() {
  const { depositCollateral, withdrawCollateral, mintVusd, repayVusd } =
    useVaultActions();
  const { balance: wbtcBalance } = useWbtcBalance();
  const { balance: vusdBalance } = useVusdBalance();
  const { collateral, debt } = useVaultPosition();
  const { price: btcPrice } = useBtcPrice();

  // Calculate max mintable vUSD at 150% ratio
  const collateralUsd = btcPrice > 0
    ? (Number(collateral) / 10 ** WBTC_DECIMALS) * btcPrice
    : 0;
  const maxMintable = Math.max(0, collateralUsd / 1.5 - Number(debt) / 10 ** VUSD_DECIMALS);

  // Calculate safe max withdrawal (keeping ratio >= 150%)
  const debtUsd = Number(debt) / 10 ** VUSD_DECIMALS;
  const minCollateralUsd = debtUsd * 1.5;
  const safeWithdrawBtc = btcPrice > 0 ? Math.max(0, (collateralUsd - minCollateralUsd) / btcPrice) : 0;
  const collateralBtc = Number(collateral) / 10 ** WBTC_DECIMALS;
  const maxWithdraw = debt === 0n ? collateralBtc : Math.min(safeWithdrawBtc, collateralBtc);

  // Smart default tab: "quick" for new users, existing positions go to deposit
  const defaultTab = collateral === 0n ? "quick" : debt === 0n ? "mint" : "deposit";

  // Contextual hint: what should the user do next?
  const showMintHint = collateral > 0n && debt === 0n && vusdBalance === 0n;
  const showPoolHint = vusdBalance > 0n;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Contextual next-step hint */}
        {showMintHint && (
          <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-gold/5 border border-gold/20 animate-fade-up">
            <Sparkles className="w-4 h-4 text-gold shrink-0" />
            <p className="text-xs text-gold">
              Collateral deposited — now switch to <span className="font-medium">Mint</span> to get vUSD
            </p>
          </div>
        )}
        {showPoolHint && (
          <Link
            href="/pool"
            className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-green-500/5 border border-green-500/20 hover:bg-green-500/10 transition-colors animate-fade-up"
          >
            <Sparkles className="w-4 h-4 text-green-400 shrink-0" />
            <p className="text-xs text-green-400 flex-1">
              You have vUSD — send it privately
            </p>
            <ArrowRight className="w-3 h-3 text-green-400" />
          </Link>
        )}

        <Tabs defaultValue={defaultTab}>
          <TabsList>
            <TabsTrigger value="quick">
              <Zap className="w-3 h-3 mr-1" />
              Quick
            </TabsTrigger>
            <TabsTrigger value="deposit">Deposit</TabsTrigger>
            <TabsTrigger value="mint">
              Mint
              {showMintHint && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />}
            </TabsTrigger>
            <TabsTrigger value="repay">Return</TabsTrigger>
            <TabsTrigger value="withdraw">Unlock</TabsTrigger>
          </TabsList>

          <TabsContent value="quick">
            <QuickMintForm btcPrice={btcPrice} />
          </TabsContent>

          <TabsContent value="deposit">
            <ActionForm
              label="Deposit WBTC as collateral"
              placeholder="0.00 WBTC"
              buttonText="Deposit WBTC"
              icon={ArrowDownToLine}
              onSubmit={depositCollateral}
              parse={parseWBTC}
              hint={wbtcBalance > 0n ? `Wallet: ${formatBTC(wbtcBalance)} WBTC` : undefined}
              maxLabel={wbtcBalance > 0n ? `Max: ${formatBTC(wbtcBalance)}` : undefined}
              onMax={wbtcBalance > 0n ? (set) => set((Number(wbtcBalance) / 10 ** WBTC_DECIMALS).toString()) : undefined}
            />
          </TabsContent>

          <TabsContent value="mint">
            <ActionForm
              label="Mint vUSD stablecoins"
              placeholder="0.00 vUSD"
              buttonText="Mint vUSD"
              icon={Coins}
              onSubmit={mintVusd}
              parse={parseVUSD}
              hint={maxMintable > 0 ? `Safe max: ~${maxMintable.toLocaleString("en-US", { maximumFractionDigits: 0 })} vUSD` : undefined}
              maxLabel={maxMintable > 0 ? `Safe max: ${maxMintable.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : undefined}
              onMax={maxMintable > 0 ? (set) => set(Math.floor(maxMintable).toString()) : undefined}
            />
          </TabsContent>

          <TabsContent value="repay">
            <ActionForm
              label="Return vUSD"
              placeholder="0.00 vUSD"
              buttonText="Return vUSD"
              icon={CreditCard}
              onSubmit={repayVusd}
              parse={parseVUSD}
              hint={vusdBalance > 0n ? `Wallet: ${formatUSD(vusdBalance)} vUSD` : undefined}
              maxLabel={debt > 0n ? `Debt: ${formatUSD(debt)}` : undefined}
              onMax={debt > 0n && vusdBalance > 0n ? (set) => {
                const repayable = debt < vusdBalance ? debt : vusdBalance;
                set((Number(repayable) / 10 ** VUSD_DECIMALS).toString());
              } : undefined}
            />
          </TabsContent>

          <TabsContent value="withdraw">
            <ActionForm
              label="Unlock WBTC collateral"
              placeholder="0.00 WBTC"
              buttonText="Unlock WBTC"
              icon={ArrowUpFromLine}
              onSubmit={withdrawCollateral}
              parse={parseWBTC}
              hint={collateral > 0n ? `Deposited: ${formatBTC(collateral)} WBTC` : undefined}
              maxLabel={maxWithdraw > 0 ? `Safe max: ${maxWithdraw.toFixed(4)}` : undefined}
              onMax={maxWithdraw > 0 ? (set) => set(maxWithdraw.toFixed(8)) : undefined}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
