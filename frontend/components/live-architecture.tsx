"use client";

import { useEffect, useState } from "react";

export function LiveArchitecture() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setActive(true), 600);
    return () => clearTimeout(timer);
  }, []);

  const nodes = [
    { id: "wbtc", label: "WBTC", sub: "Collateral", x: 0, delay: 0 },
    { id: "vault", label: "CDP Vault", sub: "Pragma Oracle", x: 1, delay: 200 },
    { id: "vusd", label: "vUSD", sub: "Stablecoin", x: 2, delay: 400 },
    { id: "pool", label: "Privacy Pool", sub: "Poseidon Merkle", x: 3, delay: 600 },
    { id: "proof", label: "ZK Proof", sub: "Garaga BN254", x: 4, delay: 800 },
  ];

  return (
    <div className="relative w-full max-w-2xl mx-auto select-none" aria-hidden="true">
      <p className="text-[10px] font-[family-name:var(--font-mono)] text-green-400/70 uppercase tracking-[0.2em] mb-5 text-center flex items-center justify-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        Live Architecture
      </p>

      {/* Node pipeline */}
      <div className="flex items-center justify-between gap-2">
        {nodes.map((node, i) => (
          <div key={node.id} className="flex items-center gap-2 flex-1">
            <div
              className={`flex-1 text-center px-3 py-4 rounded-xl border transition-all duration-700 ${
                active
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-3"
              } ${
                node.id === "proof"
                  ? "bg-gold/[0.08] border-gold/25"
                  : "bg-void-800/60 border-void-700/50"
              }`}
              style={{ transitionDelay: `${node.delay}ms` }}
            >
              <p className={`text-sm font-[family-name:var(--font-mono)] font-semibold ${
                node.id === "proof" ? "text-gold" : "text-void-100"
              }`}>
                {node.label}
              </p>
              <p className="text-[10px] font-[family-name:var(--font-mono)] text-void-500 mt-1">
                {node.sub}
              </p>
            </div>

            {i < nodes.length - 1 && (
              <svg
                width="20"
                height="14"
                viewBox="0 0 20 14"
                className={`shrink-0 transition-opacity duration-500 ${
                  active ? "opacity-60" : "opacity-0"
                }`}
                style={{ transitionDelay: `${node.delay + 300}ms` }}
              >
                <path
                  d="M 0 7 L 15 7 M 11 3 L 15 7 L 11 11"
                  fill="none"
                  stroke="rgba(212, 168, 67, 0.5)"
                  strokeWidth="1.5"
                />
              </svg>
            )}
          </div>
        ))}
      </div>

      {/* Bottom: ASP compliance layer */}
      <div
        className={`mt-4 flex items-center justify-center gap-2 transition-all duration-700 ${
          active ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        }`}
        style={{ transitionDelay: "1100ms" }}
      >
        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-green-500/20" />
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/[0.06] border border-green-500/15">
          <div className="w-2 h-2 rounded-full bg-green-400/60" />
          <span className="text-[10px] font-[family-name:var(--font-mono)] text-green-400/70 tracking-[0.15em]">
            ASP COMPLIANCE LAYER
          </span>
        </div>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-green-500/20" />
      </div>
    </div>
  );
}
