import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Pool — Veil",
  description: "Deposit vUSD into the compliant privacy pool. ZK proofs hide your identity, ASPs ensure legality.",
};

export default function PoolLayout({ children }: { children: React.ReactNode }) {
  return children;
}
