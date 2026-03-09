import { ExternalLink } from "lucide-react";
import { CONTRACTS } from "@/lib/constants";

const contracts = [
  { name: "Send", address: CONTRACTS.pool },
  { name: "Mint", address: CONTRACTS.vault },
  { name: "vUSD", address: CONTRACTS.vusd },
  { name: "Oracle", address: CONTRACTS.oracle },
];

function explorerUrl(address: string) {
  return `https://sepolia.voyager.online/contract/${address}`;
}

export function Footer() {
  return (
    <footer className="border-t border-void-800/50 mt-20">
      <div className="mx-auto max-w-4xl px-6 py-12">
        {/* Deployed contracts */}
        <div className="mb-8">
          <p className="text-[10px] font-[family-name:var(--font-mono)] text-gold/60 tracking-widest mb-4">
            CONTRACTS
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {contracts.map((c) => (
              <a
                key={c.name}
                href={explorerUrl(c.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="group glass rounded-xl p-3 hover:border-gold/20 transition-all"
              >
                <p className="text-xs text-void-400 mb-1">{c.name}</p>
                <div className="flex items-center gap-1.5">
                  <p className="text-[11px] font-[family-name:var(--font-mono)] text-void-300 truncate">
                    {c.address.slice(0, 8)}...{c.address.slice(-6)}
                  </p>
                  <ExternalLink className="w-3 h-3 text-void-500 group-hover:text-gold transition-colors shrink-0" />
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Bottom row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-void-800/30">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-gold to-gold-dark" />
            <span className="font-[family-name:var(--font-display)] text-sm text-void-400">
              Veil
            </span>
          </div>
          <p className="text-[10px] text-void-500 font-[family-name:var(--font-mono)] text-center max-w-md">
            Testnet demo on Starknet Sepolia. Not audited. Do not use with real funds.
          </p>
        </div>
      </div>
    </footer>
  );
}
