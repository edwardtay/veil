"use client";

import { ExternalLink } from "lucide-react";
import { CONTRACTS } from "@/lib/constants";

const contracts = [
  {
    name: "Private Settlement",
    address: CONTRACTS.pool,
    desc: "Dual-path: Poseidon deposits + Garaga-verified ZK withdrawals",
  },
  {
    name: "Garaga Verifier",
    address: CONTRACTS.verifier,
    desc: "On-chain Groth16 BN254 proof verification",
  },
  {
    name: "CDP Vault",
    address: CONTRACTS.vault,
    desc: "Collateral, mint/repay, liquidation",
  },
  {
    name: "vUSD Token",
    address: CONTRACTS.vusd,
    desc: "ERC20 stablecoin, vault-only mint",
  },
  {
    name: "Oracle (Pragma)",
    address: CONTRACTS.oracle,
    desc: "Live BTC/USD price feed",
  },
  {
    name: "WBTC Mock",
    address: CONTRACTS.wbtc,
    desc: "Test collateral token (with faucet)",
  },
];

export function DeployedContracts() {
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-void-800/60">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <p className="text-[10px] font-[family-name:var(--font-mono)] text-void-400 tracking-widest uppercase">
            Deployed on Starknet Sepolia
          </p>
        </div>
        <span className="text-[10px] font-[family-name:var(--font-mono)] text-void-600">
          6 contracts
        </span>
      </div>
      <div className="divide-y divide-void-800/40">
        {contracts.map((c) => (
          <a
            key={c.name}
            href={`https://sepolia.voyager.online/contract/${c.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 px-5 py-3.5 hover:bg-void-800/30 transition-colors group"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm text-void-200 font-medium">{c.name}</p>
                <ExternalLink className="w-3 h-3 text-void-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-[10px] font-[family-name:var(--font-mono)] text-void-600 mt-0.5">
                {c.desc}
              </p>
            </div>
            <code className="text-[11px] font-[family-name:var(--font-mono)] text-void-500 group-hover:text-gold transition-colors shrink-0 hidden sm:block">
              {c.address.slice(0, 8)}...{c.address.slice(-4)}
            </code>
          </a>
        ))}
      </div>
    </div>
  );
}
