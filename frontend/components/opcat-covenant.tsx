"use client";

import { useState } from "react";
import { Copy, Check, Bitcoin, Lock, ShieldCheck, Shield, FileCheck } from "lucide-react";

const COVENANT_SCRIPT = [
  { line: "# Veil STARK-Locked BTC Deposit", highlight: false },
  { line: "# BTC released only when STARK proof of pool deposit is verified", highlight: false },
  { line: "", highlight: false },
  { line: "# --- Witness: <sig> <stark_proof_hash> <merkle_siblings...> ---", highlight: false },
  { line: "", highlight: false },
  { line: "# 1. Rebuild Merkle path via OP_CAT", highlight: false },
  { line: "OP_SHA256                 # hash leaf (pool commitment)", highlight: false },
  { line: "OP_SWAP OP_CAT OP_SHA256  # hash(sibling || leaf)", highlight: true },
  { line: "OP_SWAP OP_CAT OP_SHA256  # hash(sibling || prev)", highlight: true },
  { line: "OP_SWAP OP_CAT OP_SHA256  # ... repeat for tree depth", highlight: true },
  { line: "", highlight: false },
  { line: "# 2. Verify reconstructed root matches known STARK root", highlight: false },
  { line: "<stark_state_root>        # expected Starknet state root", highlight: false },
  { line: "OP_EQUALVERIFY            # root must match", highlight: false },
  { line: "", highlight: false },
  { line: "# 3. Verify proof hash covers this deposit amount", highlight: false },
  { line: "OP_SIZE OP_SWAP OP_CAT    # concat amount || proof_hash", highlight: true },
  { line: "OP_SHA256                 # commitment = H(amount || proof)", highlight: true },
  { line: "<expected_commitment>     # pre-committed deposit binding", highlight: false },
  { line: "OP_EQUALVERIFY            # deposit amount is bound", highlight: false },
  { line: "", highlight: false },
  { line: "# 4. Authorize spend", highlight: false },
  { line: "OP_CHECKSIG               # verify bridge operator sig", highlight: false },
];

const FLOW_STEPS = [
  {
    icon: Bitcoin,
    label: "BTC Locked",
    sublabel: "Covenant UTXO",
    color: "text-orange-400",
    bg: "bg-orange-400/[0.08]",
    border: "border-orange-400/25",
  },
  {
    icon: FileCheck,
    label: "STARK Proof",
    sublabel: "Pool Deposit Proof",
    color: "text-orange-400",
    bg: "bg-orange-400/[0.08]",
    border: "border-orange-400/25",
  },
  {
    icon: ShieldCheck,
    label: "BTC Verifies",
    sublabel: "OP_CAT Merkle Check",
    color: "text-gold",
    bg: "bg-gold/[0.08]",
    border: "border-gold/25",
  },
  {
    icon: Lock,
    label: "Bridge Release",
    sublabel: "Proof-Gated",
    color: "text-gold",
    bg: "bg-gold/[0.08]",
    border: "border-gold/25",
  },
  {
    icon: Shield,
    label: "Privacy Pool",
    sublabel: "ZK Shielded",
    color: "text-green-400",
    bg: "bg-green-400/[0.08]",
    border: "border-green-400/25",
  },
];

function FlowArrow() {
  return (
    <svg
      width="20"
      height="14"
      viewBox="0 0 20 14"
      className="shrink-0 opacity-40"
    >
      <path
        d="M 0 7 L 15 7 M 11 3 L 15 7 L 11 11"
        fill="none"
        stroke="rgba(251, 146, 60, 0.6)"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function OpCatCovenant() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const scriptText = COVENANT_SCRIPT.map((l) => l.line).join("\n");
    navigator.clipboard.writeText(scriptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass rounded-2xl p-6 space-y-6">
      {/* Header */}
      <div>
        <span className="text-[10px] font-[family-name:var(--font-mono)] text-orange-400/80 tracking-widest uppercase">
          Under the Hood
        </span>
        <h3 className="mt-2 text-xl font-[family-name:var(--font-display)] text-void-50">
          The OP_CAT Covenant Script
        </h3>
        <p className="mt-1 text-sm text-void-400 leading-relaxed max-w-lg">
          OP_CAT concatenates stack elements to rebuild Merkle paths in Bitcoin
          Script. The covenant verifies a STARK state root before releasing BTC
          to the bridge.
        </p>
      </div>

      {/* Flow visualization */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto py-2">
        {FLOW_STEPS.map((step, i) => (
          <div key={step.label} className="contents">
            <div
              className={`flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl border ${step.bg} ${step.border} min-w-[90px]`}
            >
              <step.icon className={`w-5 h-5 ${step.color}`} />
              <span
                className={`text-xs font-semibold ${step.color}`}
              >
                {step.label}
              </span>
              <span className="text-[10px] text-void-500">
                {step.sublabel}
              </span>
            </div>
            {i < FLOW_STEPS.length - 1 && <FlowArrow />}
          </div>
        ))}
      </div>

      {/* Script code block */}
      <div className="relative rounded-xl border border-void-700/50 bg-void-900/60 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-void-700/30">
          <span className="text-[10px] font-[family-name:var(--font-mono)] text-void-500 tracking-wider">
            bitcoin-script
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-[10px] font-[family-name:var(--font-mono)] text-void-500 hover:text-void-300 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-green-400" />
                <span className="text-green-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
        <div className="p-4 overflow-x-auto">
          <pre className="text-[11px] font-[family-name:var(--font-mono)] leading-5">
            {COVENANT_SCRIPT.map((entry, i) => (
              <div
                key={i}
                className={`flex ${
                  entry.highlight
                    ? "bg-orange-400/[0.06] -mx-4 px-4 border-l-2 border-orange-400/40"
                    : ""
                }`}
              >
                <span className="w-6 shrink-0 text-void-600 select-none text-right mr-4">
                  {i + 1}
                </span>
                <span
                  className={
                    entry.line.startsWith("#")
                      ? "text-void-500"
                      : entry.line.startsWith("<")
                        ? "text-gold/70"
                        : "text-void-200"
                  }
                >
                  {entry.line}
                </span>
              </div>
            ))}
          </pre>
        </div>
      </div>

      {/* 2-column explainer */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-void-700/30 bg-void-900/30 space-y-2">
          <h4 className="text-xs font-semibold text-orange-400 uppercase tracking-wider">
            How OP_CAT Enables This
          </h4>
          <ul className="text-sm text-void-400 space-y-1.5 leading-relaxed">
            <li className="flex gap-2">
              <span className="text-orange-400/60 mt-0.5">&#x2022;</span>
              Concatenates Merkle siblings to rebuild proof paths in Script
            </li>
            <li className="flex gap-2">
              <span className="text-orange-400/60 mt-0.5">&#x2022;</span>
              Iterative OP_CAT + OP_SHA256 walks the tree from leaf to root
            </li>
            <li className="flex gap-2">
              <span className="text-orange-400/60 mt-0.5">&#x2022;</span>
              Verified root is compared against a known Starknet state root
            </li>
          </ul>
        </div>
        <div className="p-4 rounded-xl border border-void-700/30 bg-void-900/30 space-y-2">
          <h4 className="text-xs font-semibold text-gold uppercase tracking-wider">
            Why It Matters for Veil
          </h4>
          <ul className="text-sm text-void-400 space-y-1.5 leading-relaxed">
            <li className="flex gap-2">
              <span className="text-gold/60 mt-0.5">&#x2022;</span>
              Bitcoin L1 verifies the Starknet deposit — bridge trust is minimized
            </li>
            <li className="flex gap-2">
              <span className="text-gold/60 mt-0.5">&#x2022;</span>
              BTC only unlocks when the privacy pool provably received the deposit
            </li>
            <li className="flex gap-2">
              <span className="text-gold/60 mt-0.5">&#x2022;</span>
              Atomic: no BTC leaves L1 without a corresponding ZK commitment
            </li>
          </ul>
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        {[
          "OP_CAT (0x7e)",
          "Merkle proof in Script",
          "STARK state root verification",
        ].map((tag) => (
          <span
            key={tag}
            className="text-[10px] font-[family-name:var(--font-mono)] text-void-500 tracking-wider px-3 py-1 rounded-full border border-void-700/30"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
