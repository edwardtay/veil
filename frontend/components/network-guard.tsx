"use client";

import { useState } from "react";
import { useAccount } from "@starknet-react/core";
import { AlertTriangle, X } from "lucide-react";

export function NetworkGuard() {
  const { isConnected } = useAccount();
  const [dismissed, setDismissed] = useState(false);

  if (!isConnected || dismissed) return null;

  return (
    <div className="glass rounded-xl p-3 flex items-center justify-between border border-amber-500/20 bg-amber-500/5">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
        <p className="text-xs text-void-300">Make sure your wallet is on <span className="text-amber-300 font-medium">Sepolia testnet</span></p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="p-1 rounded hover:bg-void-800 transition-colors shrink-0"
      >
        <X className="w-3.5 h-3.5 text-void-500" />
      </button>
    </div>
  );
}
