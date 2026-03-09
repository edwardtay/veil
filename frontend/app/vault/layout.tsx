import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vault — Veil",
  description: "Lock WBTC collateral and mint vUSD stablecoins at 150% collateral ratio.",
};

export default function VaultLayout({ children }: { children: React.ReactNode }) {
  return children;
}
