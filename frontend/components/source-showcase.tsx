"use client";

import { useState } from "react";
import { FileCode2, ExternalLink } from "lucide-react";

const tabs = [
  {
    id: "circom",
    label: "withdraw.circom",
    language: "Circom / Groth16",
    link: null,
    lines: [
      { n: 34, code: "template VeilWithdraw(levels) {", hl: true },
      { n: 35, code: "    // --- Public inputs ---" },
      { n: 36, code: '    signal input root;              // Merkle root' },
      { n: 37, code: '    signal input nullifierHash;     // double-spend prevention' },
      { n: 38, code: "" },
      { n: 39, code: "    // --- Private inputs ---" },
      { n: 40, code: "    signal input nullifier;         // Random secret #1" },
      { n: 41, code: "    signal input secret;            // Random secret #2" },
      { n: 42, code: "    signal input value;             // Deposit amount" },
      { n: 43, code: "    signal input pathElements[levels];" },
      { n: 44, code: "    signal input pathIndices[levels];" },
      { n: 45, code: "" },
      { n: 46, code: "    // 1. Verify nullifierHash == Poseidon(nullifier)", hl: true },
      { n: 47, code: "    component nullHasher = Poseidon(1);" },
      { n: 48, code: "    nullHasher.inputs[0] <== nullifier;" },
      { n: 49, code: "    nullHasher.out === nullifierHash;" },
      { n: 50, code: "" },
      { n: 51, code: "    // 2. Compute precommitment = Poseidon(nullifier, secret)", hl: true },
      { n: 52, code: "    component precommHasher = Poseidon(2);" },
      { n: 55, code: "" },
      { n: 56, code: "    // 3. Compute commitment = Poseidon(value, precommitment)", hl: true },
      { n: 57, code: "    component commitHasher = Poseidon(2);" },
      { n: 60, code: "" },
      { n: 61, code: "    // 4. Verify Merkle membership", hl: true },
      { n: 62, code: "    component tree = MerkleTreeChecker(levels);" },
      { n: 63, code: "    tree.leaf <== commitHasher.out;" },
      { n: 68, code: "    tree.root === root;" },
      { n: 69, code: "}" },
      { n: 71, code: "// 20-level tree supports 2^20 = ~1M deposits" },
      { n: 72, code: "component main {public [root, nullifierHash]} = VeilWithdraw(20);", hl: true },
    ],
  },
  {
    id: "cairo",
    label: "pool.cairo",
    language: "Cairo / Starknet",
    link: "https://sepolia.voyager.online/contract/0x004831ca58c1c1c6634bb45e2cf13af597ae4065c12346c67e151d8282dd1f52",
    lines: [
      { n: 1, code: "#[starknet::contract]", hl: true },
      { n: 2, code: "pub mod VeilPool {" },
      { n: 3, code: "    use core::poseidon::poseidon_hash_span;", hl: true },
      { n: 4, code: "    use core::num::traits::Zero;" },
      { n: 5, code: "" },
      { n: 6, code: "    use starknet::{" },
      { n: 7, code: "        ContractAddress, get_caller_address," },
      { n: 8, code: "        storage::{Map, StoragePointerReadAccess ...}" },
      { n: 9, code: "    };" },
      { n: 10, code: "" },
      { n: 19, code: "    const ROOT_HISTORY_SIZE: u32 = 30;", hl: true },
      { n: 22, code: "    const TREE_DEPTH: u32 = 20;", hl: true },
      { n: 23, code: "" },
      { n: 31, code: "    #[event]" },
      { n: 32, code: "    #[derive(Drop, starknet::Event)]" },
      { n: 33, code: "    pub enum Event {" },
      { n: 34, code: "        Deposited: Deposited," },
      { n: 35, code: "        Withdrawn: Withdrawn," },
      { n: 36, code: "        RagequitExecuted: RagequitExecuted," },
      { n: 37, code: "        ApprovedSetUpdated: ApprovedSetUpdated," },
      { n: 38, code: "    }" },
      { n: 39, code: "" },
      { n: 70, code: "    #[storage]" },
      { n: 71, code: "    struct Storage {" },
      { n: 72, code: "        deposit_amount: u256," },
      { n: 73, code: "        token_address: ERC20ABIDispatcher," },
      { n: 76, code: "        next_index: u32,            // leaf counter", hl: true },
      { n: 77, code: "        filled_subtrees: Map<u32, felt252>,", hl: true },
      { n: 78, code: "        roots: Map<u32, felt252>,   // ring buffer", hl: true },
      { n: 79, code: "        current_root_index: u32," },
      { n: 89, code: "        approved_addresses: Map<ContractAddress, bool>,", hl: true },
      { n: 90, code: "        // ... nullifiers, deposits" },
      { n: 91, code: "    }" },
      { n: 92, code: "" },
      { n: 195, code: "    // ASP compliance: recipient must be approved", hl: true },
      { n: 196, code: "    assert(self.approved_addresses.entry(recipient).read(),", hl: true },
      { n: 197, code: "        'recipient not approved');" },
    ],
  },
  {
    id: "vault",
    label: "vault.cairo",
    language: "Cairo / CDP Engine",
    link: "https://sepolia.voyager.online/contract/0x0456b226a477d1f7262f8aa4c8f0ae615636ad7f77385281d41caf5a5d7d642e",
    lines: [
      { n: 1, code: "#[starknet::contract]", hl: true },
      { n: 2, code: "pub mod VeilVault {" },
      { n: 3, code: "    use core::num::traits::Zero;" },
      { n: 4, code: "" },
      { n: 8, code: "    // 150% min, 120% liquidation" },
      { n: 9, code: "    const MIN_COLLATERAL_RATIO: u256 = 15000;", hl: true },
      { n: 10, code: "    const LIQUIDATION_THRESHOLD: u256 = 12000;", hl: true },
      { n: 11, code: "    const LIQUIDATION_BONUS: u256 = 1100; // 10%", hl: true },
      { n: 12, code: "    const BASIS_POINTS: u256 = 10000;" },
      { n: 13, code: "    const DECIMAL_SCALE: u256 = 10_000_000_000;" },
      { n: 14, code: "" },
      { n: 30, code: "    #[storage]" },
      { n: 31, code: "    struct Storage {" },
      { n: 32, code: "        collateral: Map<ContractAddress, u256>," },
      { n: 33, code: "        debt: Map<ContractAddress, u256>," },
      { n: 34, code: "        wbtc_token: ERC20ABIDispatcher," },
      { n: 35, code: "        vusd_token: ContractAddress," },
      { n: 36, code: "        oracle: IOracleDispatcher," },
      { n: 37, code: "    }" },
      { n: 38, code: "" },
      { n: 50, code: "    fn get_collateral_ratio(", hl: true },
      { n: 51, code: "        self: @ContractState," },
      { n: 52, code: "        user: ContractAddress" },
      { n: 53, code: "    ) -> u256 {" },
      { n: 54, code: "        let collateral = self.collateral.entry(user).read();" },
      { n: 55, code: "        let debt = self.debt.entry(user).read();" },
      { n: 56, code: "        let price = self.oracle.read().get_price();" },
      { n: 57, code: "        // (collateral * price * 10000) / debt" },
      { n: 58, code: "        (collateral * price * DECIMAL_SCALE * BASIS_POINTS)" },
      { n: 59, code: "            / (debt * PRICE_SCALE)" },
      { n: 60, code: "    }" },
    ],
  },
];

export function SourceShowcase() {
  const [activeTab, setActiveTab] = useState("circom");
  const active = tabs.find((t) => t.id === activeTab)!;

  return (
    <div className="glass rounded-2xl overflow-hidden">
      {/* Tab header */}
      <div className="flex items-center justify-between border-b border-void-800/60 px-4">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-xs font-[family-name:var(--font-mono)] transition-colors relative ${
                activeTab === tab.id
                  ? "text-gold"
                  : "text-void-500 hover:text-void-300"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gold" />
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-[family-name:var(--font-mono)] text-void-600 uppercase tracking-widest hidden sm:block">
            {active.language}
          </span>
          {active.link && (
            <a
              href={active.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-void-500 hover:text-gold transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Code content */}
      <div className="p-4 overflow-x-auto">
        <pre className="text-[12px] leading-[1.7] font-[family-name:var(--font-mono)]">
          {active.lines.map((line, i) => (
            <div
              key={i}
              className={`flex ${
                line.hl
                  ? "bg-gold/[0.04] -mx-4 px-4 border-l-2 border-gold/30"
                  : ""
              }`}
            >
              <span className="w-8 shrink-0 text-void-700 text-right mr-4 select-none">
                {line.n}
              </span>
              <span className={line.hl ? "text-void-100" : "text-void-400"}>
                {line.code}
              </span>
            </div>
          ))}
        </pre>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-void-800/60 bg-void-900/30">
        <div className="flex items-center gap-2">
          <FileCode2 className="w-3.5 h-3.5 text-void-600" />
          <span className="text-[10px] font-[family-name:var(--font-mono)] text-void-500">
            {activeTab === "circom"
              ? "5,602 constraints · VeilWithdraw(20) · Groth16 BN254"
              : activeTab === "cairo"
              ? "Depth-20 Poseidon Merkle · 30-root history · ASP gating"
              : "150% collateral · 120% liquidation · Oracle-priced"}
          </span>
        </div>
        {activeTab !== "circom" && (
          <span className="text-[10px] font-[family-name:var(--font-mono)] text-green-400/70 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            32 tests passing
          </span>
        )}
      </div>
    </div>
  );
}
