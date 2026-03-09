"use client";

import { useState, useCallback } from "react";
import { Cpu, CheckCircle, Shield, Loader2, Play, Copy, Check } from "lucide-react";

type DemoStep = "idle" | "loading" | "proving" | "verifying" | "garaga" | "done" | "error";

interface DemoResult {
  proofTime: number;
  verifyTime: number;
  garagaTime: number;
  garagaFelts: number;
  root: string;
  nullifierHash: string;
  proofElements: number;
  verified: boolean;
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="p-1 rounded hover:bg-void-700/50 transition-colors shrink-0"
      title="Copy to clipboard"
      aria-label={copied ? "Copied" : "Copy to clipboard"}
    >
      {copied ? (
        <Check className="w-3 h-3 text-green-400" />
      ) : (
        <Copy className="w-3 h-3 text-void-600 hover:text-void-400" />
      )}
    </button>
  );
}

/**
 * Live proof generation demo — generates a real Groth16 proof in the browser
 * with random inputs, no wallet needed.
 */
export function ProofDemo() {
  const [step, setStep] = useState<DemoStep>("idle");
  const [result, setResult] = useState<DemoResult | null>(null);
  const [error, setError] = useState("");

  const runDemo = useCallback(async () => {
    setStep("loading");
    setResult(null);
    setError("");

    try {
      // Dynamic imports for heavy deps
      const [snarkjs, { buildPoseidon }] = await Promise.all([
        import("snarkjs"),
        import("circomlibjs"),
      ]);

      const poseidon = await buildPoseidon();
      const F = poseidon.F;

      // Generate random inputs
      const nullifier = BigInt(
        "0x" + Array.from(crypto.getRandomValues(new Uint8Array(31)))
          .map((b) => b.toString(16).padStart(2, "0")).join("")
      );
      const secret = BigInt(
        "0x" + Array.from(crypto.getRandomValues(new Uint8Array(31)))
          .map((b) => b.toString(16).padStart(2, "0")).join("")
      );
      const value = BigInt("1000000000000000000000"); // 1000 vUSD

      // Compute commitment chain (BN128 Poseidon)
      const nullifierHash = F.toObject(poseidon([nullifier]));
      const precommitment = F.toObject(poseidon([nullifier, secret]));
      const commitment = F.toObject(poseidon([value, precommitment]));

      console.group("%c[Veil] ZK Proof Generation", "color: #d4a843; font-weight: bold");
      console.log("%cPoseidon commitment chain:", "color: #888");
      console.log("  nullifier     =", nullifier.toString().slice(0, 32) + "...");
      console.log("  secret        =", secret.toString().slice(0, 32) + "...");
      console.log("  nullifierHash =", nullifierHash.toString());
      console.log("  precommitment =", precommitment.toString());
      console.log("  commitment    =", commitment.toString());

      // Build single-leaf Merkle tree
      const pathElements: string[] = [];
      const pathIndices: number[] = [];
      let currentHash = commitment;
      for (let i = 0; i < 20; i++) {
        pathElements.push("0");
        pathIndices.push(0);
        currentHash = F.toObject(poseidon([currentHash, BigInt(0)]));
      }
      const root = currentHash;
      console.log("%cMerkle tree (depth 20):", "color: #888");
      console.log("  leaf (commitment) =", commitment.toString());
      console.log("  root              =", root.toString());

      const input = {
        root: root.toString(),
        nullifierHash: nullifierHash.toString(),
        nullifier: nullifier.toString(),
        secret: secret.toString(),
        value: value.toString(),
        pathElements,
        pathIndices,
      };

      // Generate proof
      setStep("proving");
      console.log("%cGenerating Groth16 proof (5,602 constraints)...", "color: #d4a843");
      const proveStart = performance.now();
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        "/circuits/withdraw.wasm",
        "/circuits/withdraw_final.zkey"
      );
      const proofTime = performance.now() - proveStart;
      console.log(`%cProof generated in ${(proofTime / 1000).toFixed(2)}s`, "color: #4ade80");
      console.log("  pi_a:", proof.pi_a[0].slice(0, 32) + "...");
      console.log("  pi_b:", proof.pi_b[0][0].slice(0, 32) + "...");
      console.log("  pi_c:", proof.pi_c[0].slice(0, 32) + "...");
      console.log("  publicSignals:", publicSignals);

      // Verify proof
      setStep("verifying");
      console.log("%cVerifying proof locally...", "color: #d4a843");
      const verifyStart = performance.now();
      const vkeyResponse = await fetch("/circuits/verification_key.json");
      const vkey = await vkeyResponse.json();
      const verified = await snarkjs.groth16.verify(vkey, publicSignals, proof);
      const verifyTime = performance.now() - verifyStart;
      console.log(`%cVerification: ${verified ? "VALID" : "INVALID"} (${verifyTime.toFixed(0)}ms)`, verified ? "color: #4ade80; font-weight: bold" : "color: #f87171; font-weight: bold");

      // Generate Garaga calldata for on-chain verification
      setStep("garaga");
      console.log("%cGenerating Garaga calldata (BN254 pairing)...", "color: #d4a843");
      const garagaStart = performance.now();
      let garagaFelts = 0;
      try {
        const { init, getGroth16CallData, CurveId } = await import("garaga");
        await init();

        const vkAlpha = vkey.vk_alpha_1;
        const vkBeta = vkey.vk_beta_2;
        const vkGamma = vkey.vk_gamma_2;
        const vkDelta = vkey.vk_delta_2;
        const vkIC = vkey.IC;

        const garagaProof = {
          a: { x: BigInt(proof.pi_a[0]), y: BigInt(proof.pi_a[1]), curveId: CurveId.BN254 },
          b: {
            x: [BigInt(proof.pi_b[0][0]), BigInt(proof.pi_b[0][1])] as [bigint, bigint],
            y: [BigInt(proof.pi_b[1][0]), BigInt(proof.pi_b[1][1])] as [bigint, bigint],
            curveId: CurveId.BN254,
          },
          c: { x: BigInt(proof.pi_c[0]), y: BigInt(proof.pi_c[1]), curveId: CurveId.BN254 },
          publicInputs: publicSignals.map((s: string) => BigInt(s)),
        };

        const garagaVk = {
          alpha: { x: BigInt(vkAlpha[0]), y: BigInt(vkAlpha[1]), curveId: CurveId.BN254 },
          beta: {
            x: [BigInt(vkBeta[0][0]), BigInt(vkBeta[0][1])] as [bigint, bigint],
            y: [BigInt(vkBeta[1][0]), BigInt(vkBeta[1][1])] as [bigint, bigint],
            curveId: CurveId.BN254,
          },
          gamma: {
            x: [BigInt(vkGamma[0][0]), BigInt(vkGamma[0][1])] as [bigint, bigint],
            y: [BigInt(vkGamma[1][0]), BigInt(vkGamma[1][1])] as [bigint, bigint],
            curveId: CurveId.BN254,
          },
          delta: {
            x: [BigInt(vkDelta[0][0]), BigInt(vkDelta[0][1])] as [bigint, bigint],
            y: [BigInt(vkDelta[1][0]), BigInt(vkDelta[1][1])] as [bigint, bigint],
            curveId: CurveId.BN254,
          },
          ic: vkIC.map((pt: string[]) => ({
            x: BigInt(pt[0]),
            y: BigInt(pt[1]),
            curveId: CurveId.BN254,
          })),
        };

        const calldataBigInts = getGroth16CallData(garagaProof, garagaVk, CurveId.BN254);
        garagaFelts = calldataBigInts.length;
        console.log(`%cGaraga calldata: ${garagaFelts} felt252 values`, "color: #4ade80; font-weight: bold");
      } catch (e) {
        console.log("%cGaraga calldata generation skipped (WASM not available in demo)", "color: #888");
      }
      const garagaTime = performance.now() - garagaStart;
      console.groupEnd();

      setResult({
        proofTime,
        verifyTime,
        garagaTime,
        garagaFelts,
        root: root.toString(),
        nullifierHash: nullifierHash.toString(),
        proofElements: 8,
        verified,
        pi_a: proof.pi_a.slice(0, 2).map((v: string) => v.slice(0, 24) + "..."),
        pi_b: proof.pi_b.slice(0, 2).map((pair: string[]) =>
          pair.map((v: string) => v.slice(0, 16) + "...")
        ),
        pi_c: proof.pi_c.slice(0, 2).map((v: string) => v.slice(0, 24) + "..."),
      });
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Proof generation failed");
      setStep("error");
    }
  }, []);

  return (
    <div className="glass rounded-2xl p-6 md:p-8">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[10px] font-[family-name:var(--font-mono)] text-gold/60 tracking-widest mb-1">
            ZK PROOF
          </p>
          <h3 className="text-lg font-[family-name:var(--font-display)] text-void-50">
            Generate a ZK Proof
          </h3>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-[family-name:var(--font-mono)] text-void-500">
          <Cpu className="w-3 h-3" />
          Browser WASM
        </div>
      </div>

      <p className="text-sm text-void-400 mb-6 leading-relaxed">
        This is the exact proof users generate when withdrawing from the privacy pool — same circuit, same keys.
        It proves Merkle membership without revealing which deposit is yours.
      </p>

      {step === "idle" && (
        <button
          onClick={runDemo}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gold hover:bg-gold-light text-void-950 rounded-xl text-sm font-semibold transition-all duration-200 glow-gold"
        >
          <Play className="w-4 h-4" />
          Generate Proof
        </button>
      )}

      {(step === "loading" || step === "proving" || step === "verifying" || step === "garaga") && (
        <ProvingSteps step={step} />
      )}

      {step === "done" && result && (
        <div className="space-y-4">
          {/* Success header */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
            <Shield className="w-4 h-4 text-green-400 shrink-0" />
            <div>
              <p className="text-sm text-green-400 font-medium">
                Proof {result.verified ? "verified" : "generated"}
              </p>
              <p className="text-[10px] text-green-400/60 font-[family-name:var(--font-mono)]">
                Prove: {(result.proofTime / 1000).toFixed(1)}s | Verify: {result.verifyTime.toFixed(0)}ms
              </p>
            </div>
          </div>

          {/* Public signals */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-void-900/60">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] font-[family-name:var(--font-mono)] text-void-600 uppercase tracking-widest">Merkle Root</p>
                <CopyBtn text={result.root} />
              </div>
              <p className="text-xs font-[family-name:var(--font-mono)] text-void-300 break-all">
                {result.root.slice(0, 20)}...
              </p>
            </div>
            <div className="p-3 rounded-lg bg-void-900/60">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] font-[family-name:var(--font-mono)] text-void-600 uppercase tracking-widest">Nullifier Hash</p>
                <CopyBtn text={result.nullifierHash} />
              </div>
              <p className="text-xs font-[family-name:var(--font-mono)] text-void-300 break-all">
                {result.nullifierHash.slice(0, 20)}...
              </p>
            </div>
          </div>

          {/* Proof structure */}
          <div className="p-3 rounded-lg bg-void-900/60 space-y-1.5">
            <p className="text-[9px] font-[family-name:var(--font-mono)] text-void-600 uppercase tracking-widest mb-2">Proof Structure</p>
            {[
              { label: "pi_a", values: result.pi_a, color: "text-gold/80" },
              { label: "pi_b", values: result.pi_b.flat(), color: "text-blue-400/80" },
              { label: "pi_c", values: result.pi_c, color: "text-green-400/80" },
            ].map((group) => (
              <div key={group.label} className="flex items-start gap-2">
                <span className={`text-[10px] font-[family-name:var(--font-mono)] ${group.color} w-8 shrink-0`}>
                  {group.label}
                </span>
                <span className="text-[10px] font-[family-name:var(--font-mono)] text-void-500 break-all">
                  [{group.values.join(", ")}]
                </span>
              </div>
            ))}
          </div>

          {/* Garaga calldata summary */}
          {result.garagaFelts > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
              <Cpu className="w-4 h-4 text-purple-400 shrink-0" />
              <div>
                <p className="text-sm text-purple-300 font-medium">
                  Garaga calldata: {result.garagaFelts.toLocaleString()} felt252 values
                </p>
                <p className="text-[10px] text-purple-400/60 font-[family-name:var(--font-mono)]">
                  BN254 pairing check ready for on-chain verification ({(result.garagaTime / 1000).toFixed(1)}s)
                </p>
              </div>
            </div>
          )}

          {/* Verification summary */}
          <div className="p-3 rounded-lg bg-void-900/60 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div>
              <p className="text-[9px] font-[family-name:var(--font-mono)] text-void-600 uppercase">Groth16</p>
              <p className="text-sm font-[family-name:var(--font-mono)] text-void-200 mt-0.5">{(result.proofTime / 1000).toFixed(1)}s</p>
            </div>
            <div>
              <p className="text-[9px] font-[family-name:var(--font-mono)] text-void-600 uppercase">Verify</p>
              <p className="text-sm font-[family-name:var(--font-mono)] text-void-200 mt-0.5">{result.verifyTime.toFixed(0)}ms</p>
            </div>
            <div>
              <p className="text-[9px] font-[family-name:var(--font-mono)] text-void-600 uppercase">Garaga</p>
              <p className="text-sm font-[family-name:var(--font-mono)] text-void-200 mt-0.5">
                {result.garagaFelts > 0 ? `${result.garagaFelts}` : "~200B"}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-[family-name:var(--font-mono)] text-void-600 uppercase">Status</p>
              <p className={`text-sm font-[family-name:var(--font-mono)] mt-0.5 ${result.verified ? "text-green-400" : "text-red-400"}`}>
                {result.verified ? "VALID" : "INVALID"}
              </p>
            </div>
          </div>

          <button
            onClick={() => { setStep("idle"); setResult(null); }}
            className="w-full px-4 py-2.5 glass rounded-xl text-sm text-void-300 hover:text-void-100 transition-colors"
          >
            Run Again
          </button>
        </div>
      )}

      {step === "error" && (
        <div className="space-y-3">
          <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
            <p className="text-sm text-red-400">{error}</p>
          </div>
          <button
            onClick={() => { setStep("idle"); setError(""); }}
            className="w-full px-4 py-2.5 glass rounded-xl text-sm text-void-300 hover:text-void-100 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

function ProvingSteps({ step }: { step: string }) {
  const stepOrder = ["loading", "proving", "verifying", "garaga", "done"];
  const currentIdx = stepOrder.indexOf(step);

  const steps = [
    { key: "loading", label: "Loading snarkjs + circomlibjs" },
    { key: "proving", label: "Generating Groth16 proof (5,602 constraints)" },
    { key: "verifying", label: "Verifying proof locally" },
    { key: "garaga", label: "Generating Garaga calldata (BN254 pairing)" },
  ];

  return (
    <div className="space-y-3">
      {steps.map((s) => {
        const sIdx = stepOrder.indexOf(s.key);
        const isActive = step === s.key;
        const isDone = currentIdx > sIdx;
        const isPending = currentIdx < sIdx;

        return (
          <div
            key={s.key}
            className={`flex items-center gap-3 p-3 rounded-lg ${
              isActive ? "bg-gold/5 border border-gold/20" : isDone ? "bg-green-500/5 border border-green-500/20" : "bg-void-900/60 border border-void-800/50"
            }`}
          >
            {isActive ? (
              <Loader2 className="w-4 h-4 text-gold animate-spin shrink-0" />
            ) : isDone ? (
              <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
            ) : (
              <div className="w-4 h-4 rounded-full border border-void-600 shrink-0" />
            )}
            <span className={`text-sm ${isPending ? "text-void-500" : "text-void-300"}`}>
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
