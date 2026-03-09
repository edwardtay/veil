"use client";

import { useState, useCallback } from "react";
import { Fingerprint, ArrowDown, Loader2 } from "lucide-react";

/**
 * Interactive Poseidon hash demo — shows the 3-stage
 * commitment scheme computing in real time. No wallet needed.
 */
export function HashDemo() {
  const [nullifier, setNullifier] = useState("");
  const [secret, setSecret] = useState("");
  const [amount, setAmount] = useState("1000");
  const [hashes, setHashes] = useState<{
    nullifierHash: string;
    precommitment: string;
    commitment: string;
  } | null>(null);
  const [computing, setComputing] = useState(false);

  const generateRandom = useCallback(() => {
    const rand = () =>
      "0x" +
      Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    setNullifier(rand());
    setSecret(rand());
  }, []);

  const computeHashes = useCallback(async () => {
    if (!nullifier || !secret || !amount) return;
    setComputing(true);
    try {
      const { buildPoseidon } = await import("circomlibjs");
      const poseidon = await buildPoseidon();
      const F = poseidon.F;

      const n = BigInt(nullifier);
      const s = BigInt(secret);
      const v = BigInt(Math.floor(parseFloat(amount) * 1e18));

      const nullifierHash = F.toObject(poseidon([n])).toString();
      const precommitment = F.toObject(poseidon([n, s])).toString();
      const commitment = F.toObject(poseidon([v, BigInt(precommitment)])).toString();

      setHashes({ nullifierHash, precommitment, commitment });
    } catch {
      // silently handle
    } finally {
      setComputing(false);
    }
  }, [nullifier, secret, amount]);

  return (
    <div className="glass rounded-2xl p-6 md:p-8">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[10px] font-[family-name:var(--font-mono)] text-gold/60 tracking-widest mb-1">
            INTERACTIVE
          </p>
          <h3 className="text-lg font-[family-name:var(--font-display)] text-void-50">
            Poseidon Hash Explorer
          </h3>
        </div>
        <Fingerprint className="w-5 h-5 text-gold/40" />
      </div>

      <p className="text-sm text-void-400 mb-5 leading-relaxed">
        See how the 3-stage commitment scheme works. Enter values or generate random ones — watch the Poseidon hash chain compute.
      </p>

      {/* Inputs */}
      <div className="space-y-3 mb-4">
        <div>
          <label className="text-[10px] font-[family-name:var(--font-mono)] text-void-500 uppercase tracking-widest">
            Nullifier
          </label>
          <input
            value={nullifier}
            onChange={(e) => { setNullifier(e.target.value); setHashes(null); }}
            placeholder="0x..."
            className="w-full mt-1 px-3 py-2 rounded-lg bg-void-900/80 border border-void-700/50 text-xs font-[family-name:var(--font-mono)] text-void-200 placeholder:text-void-600 focus:border-gold/30 focus:outline-none transition-colors"
          />
        </div>
        <div>
          <label className="text-[10px] font-[family-name:var(--font-mono)] text-void-500 uppercase tracking-widest">
            Secret
          </label>
          <input
            value={secret}
            onChange={(e) => { setSecret(e.target.value); setHashes(null); }}
            placeholder="0x..."
            className="w-full mt-1 px-3 py-2 rounded-lg bg-void-900/80 border border-void-700/50 text-xs font-[family-name:var(--font-mono)] text-void-200 placeholder:text-void-600 focus:border-gold/30 focus:outline-none transition-colors"
          />
        </div>
        <div>
          <label className="text-[10px] font-[family-name:var(--font-mono)] text-void-500 uppercase tracking-widest">
            Amount (vUSD)
          </label>
          <input
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setHashes(null); }}
            placeholder="1000"
            className="w-full mt-1 px-3 py-2 rounded-lg bg-void-900/80 border border-void-700/50 text-xs font-[family-name:var(--font-mono)] text-void-200 placeholder:text-void-600 focus:border-gold/30 focus:outline-none transition-colors"
          />
        </div>
      </div>

      <div className="flex gap-2 mb-5">
        <button
          onClick={generateRandom}
          className="flex-1 px-3 py-2 glass rounded-lg text-xs text-void-300 hover:text-void-100 transition-colors"
        >
          Random Values
        </button>
        <button
          onClick={computeHashes}
          disabled={!nullifier || !secret || computing}
          className="flex-1 px-3 py-2 bg-gold hover:bg-gold-light text-void-950 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {computing ? (
            <span className="flex items-center justify-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Hashing...
            </span>
          ) : (
            "Compute Hashes"
          )}
        </button>
      </div>

      {/* Hash chain output */}
      {hashes && (
        <div className="space-y-2 animate-fade-up">
          <HashStep
            step={1}
            label="nullifierHash"
            formula="Poseidon(nullifier)"
            value={hashes.nullifierHash}
          />
          <div className="flex justify-center">
            <ArrowDown className="w-3 h-3 text-void-600" />
          </div>
          <HashStep
            step={2}
            label="precommitment"
            formula="Poseidon(nullifier, secret)"
            value={hashes.precommitment}
          />
          <div className="flex justify-center">
            <ArrowDown className="w-3 h-3 text-void-600" />
          </div>
          <HashStep
            step={3}
            label="commitment"
            formula="Poseidon(amount, precommitment)"
            value={hashes.commitment}
            highlight
          />
        </div>
      )}
    </div>
  );
}

function HashStep({
  step,
  label,
  formula,
  value,
  highlight,
}: {
  step: number;
  label: string;
  formula: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-3 rounded-lg ${
        highlight
          ? "bg-gold/5 border border-gold/20"
          : "bg-void-900/60 border border-void-800/50"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className={`text-[10px] font-[family-name:var(--font-mono)] uppercase tracking-widest ${highlight ? "text-gold/60" : "text-void-600"}`}>
          Stage {step}: {label}
        </span>
        <code className="text-[10px] font-[family-name:var(--font-mono)] text-void-500">
          {formula}
        </code>
      </div>
      <p className={`text-[11px] font-[family-name:var(--font-mono)] break-all ${highlight ? "text-gold" : "text-void-300"}`}>
        {value.length > 40 ? `${value.slice(0, 20)}...${value.slice(-20)}` : value}
      </p>
    </div>
  );
}
