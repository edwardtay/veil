"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Upload,
  Unlock,
  Lock,
  CheckCircle,
  FileKey,
  Cpu,
  Send,
  Loader2,
  AlertCircle,
  ShieldCheck,
  ShieldOff,
  ExternalLink,
  Zap,
  Hash,
  GitBranch,
  Binary,
  Link2Off,
  ArrowRight,
} from "lucide-react";
import { usePoolWithdraw, usePoolStats } from "@/hooks/use-pool";
import { useAccount } from "@starknet-react/core";
import { cn } from "@/lib/cn";
import { decryptNote, type VeilNote } from "@/lib/crypto";
import { resolvePoolForAmount } from "@/lib/constants";
import type { PoolConfig } from "@/lib/constants";

const withdrawSteps = [
  {
    number: "1",
    icon: FileKey,
    title: "Load Key",
    description: "Upload withdrawal key",
    activeOn: ["idle"] as string[],
  },
  {
    number: "2",
    icon: Send,
    title: "Send",
    description: "ZK proof + private send",
    activeOn: ["proving", "verifying", "submitting-root", "submitting"] as string[],
  },
];

function isValidStarknetAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{1,64}$/.test(addr);
}

/** Proof generation progress display — shows each cryptographic phase */
function ProofProgress({ subStep, proofTime }: { subStep: string; proofTime: number }) {
  const phases = [
    { label: "Loading privacy engine...", icon: Binary, key: "Loading" },
    { label: "Computing secure hashes...", icon: Hash, key: "Computing" },
    { label: "Fetching shared commitment registry...", icon: Link2Off, key: "Fetching" },
    { label: "Building Merkle tree from all deposits...", icon: GitBranch, key: "Building" },
    { label: "Generating privacy proof...", icon: Cpu, key: "Generating Groth16" },
    { label: "Preparing on-chain verification...", icon: Zap, key: "Generating Garaga" },
    { label: "Proof complete", icon: CheckCircle, key: "Proof complete" },
  ];

  // Find current phase index by matching substep prefix
  const currentIdx = phases.findIndex((p) => subStep.startsWith(p.key));

  return (
    <div className="p-4 rounded-xl bg-void-900/80 border border-gold/20 space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <Loader2 className="w-4 h-4 text-gold animate-spin" />
        <p className="text-xs font-[family-name:var(--font-mono)] text-gold">
          Zero-Knowledge Proof Generation
        </p>
        {proofTime > 0 && (
          <span className="text-[10px] font-[family-name:var(--font-mono)] text-void-500 ml-auto">
            {(proofTime / 1000).toFixed(1)}s
          </span>
        )}
      </div>
      {phases.map((phase, i) => {
        const isDone = currentIdx > i;
        const isActive = currentIdx === i;
        const isPending = currentIdx < i;
        const Icon = phase.icon;

        return (
          <div
            key={phase.key}
            className={cn(
              "flex items-center gap-2.5 py-1.5 px-2 rounded-lg transition-all duration-300",
              isActive && "bg-gold/5",
              isDone && "opacity-70"
            )}
          >
            <div className="w-5 h-5 flex items-center justify-center shrink-0">
              {isDone ? (
                <CheckCircle className="w-3.5 h-3.5 text-green-400" />
              ) : isActive ? (
                <Loader2 className="w-3.5 h-3.5 text-gold animate-spin" />
              ) : (
                <Icon className="w-3.5 h-3.5 text-void-600" />
              )}
            </div>
            <span
              className={cn(
                "text-[11px] font-[family-name:var(--font-mono)] transition-colors",
                isDone && "text-green-400/70",
                isActive && "text-gold",
                isPending && "text-void-600"
              )}
            >
              {phase.label}
            </span>
          </div>
        );
      })}
      <div className="mt-2 pt-2 border-t border-void-800/50">
        <div className="flex items-center justify-between text-[9px] font-[family-name:var(--font-mono)] text-void-600">
          <span>Circuit: VeilWithdraw</span>
          <span>Curve: BN254</span>
          <span>Verifier: Garaga</span>
        </div>
      </div>
    </div>
  );
}

/** Privacy proof panel — the "aha moment" after successful withdrawal */
function PrivacyProofPanel({
  depositor,
  recipient,
  proofResult,
  proofTime,
  txHash,
}: {
  depositor: string;
  recipient: string;
  proofResult: { root: string; nullifierHash: string; garagaCalldata: string[]; anonymitySet: number };
  proofTime: number;
  txHash: string;
}) {
  return (
    <div className="space-y-4 animate-fade-up">
      {/* Success header */}
      <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20 text-center">
        <CheckCircle className="w-7 h-7 text-green-400 mx-auto mb-2" />
        <p className="text-green-300 font-medium text-lg">Sent Privately</p>
        <p className="text-green-400/60 text-xs font-[family-name:var(--font-mono)] mt-1">
          Proof generated in {(proofTime / 1000).toFixed(1)}s — verified on-chain by Garaga
        </p>
      </div>

      {/* Unlinkability visualization */}
      <div className="p-5 rounded-xl bg-void-900/80 border border-void-700/50">
        <div className="flex items-center gap-2 mb-4">
          <Link2Off className="w-4 h-4 text-gold" />
          <p className="text-[10px] font-[family-name:var(--font-mono)] text-gold/80 tracking-widest uppercase">
            Privacy Proof — Unlinkable
          </p>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center mb-4">
          {/* Depositor */}
          <div className="p-3 rounded-lg bg-void-800/60 border border-void-700/50 text-center">
            <p className="text-[9px] font-[family-name:var(--font-mono)] text-void-500 mb-1">DEPOSITOR</p>
            <p className="text-xs font-[family-name:var(--font-mono)] text-void-200 break-all">
              {depositor.slice(0, 10)}...{depositor.slice(-6)}
            </p>
          </div>

          {/* Broken link */}
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <ShieldOff className="w-5 h-5 text-red-400" />
            </div>
            <span className="text-[8px] font-[family-name:var(--font-mono)] text-red-400/70">NO LINK</span>
          </div>

          {/* Recipient */}
          <div className="p-3 rounded-lg bg-void-800/60 border border-void-700/50 text-center">
            <p className="text-[9px] font-[family-name:var(--font-mono)] text-void-500 mb-1">RECIPIENT</p>
            <p className="text-xs font-[family-name:var(--font-mono)] text-void-200 break-all">
              {recipient.slice(0, 10)}...{recipient.slice(-6)}
            </p>
          </div>
        </div>

        {/* What blockchain sees */}
        <div className="p-3 rounded-lg bg-void-950/60 border border-void-800/50 space-y-2">
          <p className="text-[9px] font-[family-name:var(--font-mono)] text-void-500 uppercase tracking-wider">
            What the blockchain sees
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[9px] font-[family-name:var(--font-mono)] text-void-600">Deposit</p>
              <p className="text-[10px] font-[family-name:var(--font-mono)] text-green-400/70 break-all">
                commitment: {proofResult.root.slice(0, 16)}...
              </p>
            </div>
            <div>
              <p className="text-[9px] font-[family-name:var(--font-mono)] text-void-600">Withdrawal</p>
              <p className="text-[10px] font-[family-name:var(--font-mono)] text-blue-400/70 break-all">
                nullifier: {proofResult.nullifierHash.slice(0, 16)}...
              </p>
            </div>
          </div>
          <p className="text-[9px] font-[family-name:var(--font-mono)] text-void-500 italic">
            These values are mathematically unrelated — no observer can link them without the secret
          </p>
        </div>
      </div>

      {/* Technical proof details */}
      <div className="p-4 rounded-xl bg-void-900/50 border border-void-800/50">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-gold" />
          <p className="text-[10px] font-[family-name:var(--font-mono)] text-gold/80 tracking-widest uppercase">
            On-Chain Verification
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Proof System", value: "Groth16" },
            { label: "Curve", value: "BN254" },
            { label: "Anonymity Set", value: proofResult.anonymitySet.toString() },
            { label: "Garaga Felts", value: proofResult.garagaCalldata.length.toLocaleString() },
          ].map((item) => (
            <div key={item.label} className="text-center p-2 rounded-lg bg-void-800/40 border border-void-700/30">
              <p className="text-[9px] font-[family-name:var(--font-mono)] text-void-500">{item.label}</p>
              <p className="text-sm font-[family-name:var(--font-mono)] text-void-200 mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-[family-name:var(--font-mono)]">
          <div>
            <span className="text-void-500">Merkle Root: </span>
            <span className="text-void-400 break-all">{proofResult.root.slice(0, 20)}...</span>
          </div>
          <div>
            <span className="text-void-500">Nullifier Hash: </span>
            <span className="text-void-400 break-all">{proofResult.nullifierHash.slice(0, 20)}...</span>
          </div>
        </div>
        <p className="text-[9px] font-[family-name:var(--font-mono)] text-void-600 mt-2">
          Verified on-chain by Garaga&apos;s BN254 pairing engine — {proofResult.garagaCalldata.length} felt252 values in a single transaction
        </p>
      </div>

      {/* Transaction link */}
      {txHash && (
        <a
          href={`https://sepolia.voyager.online/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 p-3 rounded-xl bg-void-900/50 border border-void-700/50 text-gold/70 hover:text-gold hover:border-gold/30 transition-all text-xs font-[family-name:var(--font-mono)]"
        >
          View withdrawal transaction on Voyager
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}
    </div>
  );
}

/** Privacy strength indicator — warns if anonymity set is too small */
function PrivacyStrength({ commitmentCount }: { commitmentCount: number }) {
  const level =
    commitmentCount >= 100
      ? { label: "Strong", color: "text-green-400", bg: "bg-green-500", tip: "Good anonymity set. Safe to send." }
      : commitmentCount >= 50
        ? { label: "Moderate", color: "text-green-400", bg: "bg-green-500", tip: "Reasonable privacy. Consider waiting for more deposits." }
        : commitmentCount >= 10
          ? { label: "Low", color: "text-amber-400", bg: "bg-amber-500", tip: "Low anonymity. Wait for more deposits if possible." }
          : commitmentCount >= 3
            ? { label: "Weak", color: "text-amber-400", bg: "bg-amber-500", tip: `Only ${commitmentCount} deposits in pool. Sending may be linkable.` }
            : { label: "Unsafe", color: "text-red-400", bg: "bg-red-500", tip: `Only ${commitmentCount} deposit${commitmentCount === 1 ? "" : "s"}. Sending is easily traceable.` };

  const bars = commitmentCount >= 100 ? 5 : commitmentCount >= 50 ? 4 : commitmentCount >= 10 ? 3 : commitmentCount >= 3 ? 2 : commitmentCount >= 1 ? 1 : 0;
  const isWeak = commitmentCount < 10;

  return (
    <div className={cn(
      "p-3 rounded-xl border",
      isWeak ? "bg-amber-500/5 border-amber-500/20" : "bg-void-900/80 border-void-700/50"
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className={cn("w-4 h-4", level.color)} />
          <span className={cn("text-xs font-semibold", level.color)}>{level.label} Privacy</span>
        </div>
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-1.5 h-3 rounded-sm transition-colors",
                i < bars ? level.bg + "/60" : "bg-void-700/30"
              )}
            />
          ))}
        </div>
      </div>
      <p className="text-[10px] font-[family-name:var(--font-mono)] text-void-400">
        {level.tip}
      </p>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px] font-[family-name:var(--font-mono)] text-void-500">
          Anonymity set: {commitmentCount} deposit{commitmentCount !== 1 ? "s" : ""}
        </span>
        <span className="text-[10px] font-[family-name:var(--font-mono)] text-void-500">
          Traceability: 1/{Math.max(commitmentCount, 1)}
        </span>
      </div>
      {isWeak && (
        <p className="text-[10px] font-[family-name:var(--font-mono)] text-amber-400/80 mt-2">
          Tip: Wait for more deposits before sending for stronger privacy.
        </p>
      )}
    </div>
  );
}

export function PoolWithdraw({ pool }: { pool: PoolConfig }) {
  const [note, setNote] = useState<VeilNote | null>(null);
  const [recipient, setRecipient] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const [addressError, setAddressError] = useState("");
  const [decryptPassword, setDecryptPassword] = useState("");
  const [pendingEncrypted, setPendingEncrypted] = useState<string | null>(null);
  const { address } = useAccount();

  // Resolve the correct denomination pool from the note's deposit amount
  const effectivePool = note
    ? resolvePoolForAmount(pool, BigInt(note.depositAmount))
    : pool;

  const { commitmentCount } = usePoolStats(effectivePool);

  const { withdraw, step, proofResult, error, proofTime, proofSubStep, txHash, reset } =
    usePoolWithdraw(effectivePool);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setFileName(file.name);
      setFileError("");
      setPendingEncrypted(null);
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target?.result as string);
          // Check if this is an encrypted note
          if (parsed.encrypted && parsed.iv && parsed.salt) {
            setPendingEncrypted(ev.target?.result as string);
            setFileError("");
            return;
          }
          if (parsed.nullifier && parsed.secret && parsed.depositAmount) {
            setNote(parsed);
            setFileError("");
          } else {
            setNote(null);
            setFileError("Invalid file — this doesn't look like a withdrawal key");
          }
        } catch {
          setNote(null);
          setFileError("Could not read file — make sure it's the .json key from your deposit");
        }
      };
      reader.readAsText(file);
    },
    []
  );

  const handleDecrypt = useCallback(async () => {
    if (!pendingEncrypted || !decryptPassword) return;
    try {
      const decrypted = await decryptNote(pendingEncrypted, decryptPassword);
      setNote(decrypted);
      setPendingEncrypted(null);
      setDecryptPassword("");
      setFileError("");
    } catch {
      setFileError("Wrong password — could not unlock key");
    }
  }, [pendingEncrypted, decryptPassword]);

  /** Load the last deposited note from localStorage (demo convenience) */
  const handleLoadLastDeposit = useCallback(() => {
    try {
      const saved = localStorage.getItem("veil_last_deposit");
      if (!saved) {
        setFileError("No recent deposit found — shield funds first, then come back here");
        return;
      }
      const parsed = JSON.parse(saved);
      if (parsed.nullifier && parsed.secret && parsed.depositAmount) {
        setNote(parsed);
        setFileName("Last deposit note");
        setFileError("");
        // Pre-fill recipient with connected wallet for quick demo
        if (!recipient && address) {
          setRecipient(address);
        }
      } else {
        setFileError("Saved key is invalid");
      }
    } catch {
      setFileError("Could not load saved key");
    }
  }, [recipient]);

  const handleRecipientChange = useCallback((value: string) => {
    setRecipient(value);
    if (value && !isValidStarknetAddress(value)) {
      setAddressError("Enter a valid Starknet address (0x...)");
    } else {
      setAddressError("");
    }
  }, []);

  const handleWithdraw = useCallback(async () => {
    if (!note || !recipient) return;
    if (!isValidStarknetAddress(recipient)) {
      setAddressError("Enter a valid Starknet address (0x...)");
      return;
    }
    try {
      await withdraw(note, recipient);
    } catch {
      // error state is handled by the hook
    }
  }, [note, recipient, withdraw]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Unlock className="w-5 h-5 text-gold" />
          Send
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Withdraw flow steps — compact single row */}
        {step !== "done" && (
          <div className="flex items-center gap-3">
            {withdrawSteps.map((s, i) => {
              const isActive = s.activeOn.includes(step);
              const isDone =
                (["proving", "verifying", "submitting-root", "submitting"].includes(step) && i < 1);
              return (
                <div key={i} className="flex items-center gap-3 flex-1">
                  <div
                    className={cn(
                      "flex items-center gap-3 flex-1 px-4 py-3 rounded-xl border transition-all",
                      isActive
                        ? "bg-gold/5 border-gold/30"
                        : isDone
                          ? "bg-green-500/5 border-green-500/20"
                          : "bg-void-900/80 border-void-700/50"
                    )}
                  >
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                        isActive
                          ? "bg-gold/20 border border-gold/40"
                          : isDone
                            ? "bg-green-500/20 border border-green-500/40"
                            : "bg-void-800 border border-void-600/50"
                      )}
                    >
                      {isActive ? (
                        <Loader2 className="w-4 h-4 text-gold animate-spin" />
                      ) : isDone ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <s.icon className="w-4 h-4 text-void-400" />
                      )}
                    </div>
                    <div>
                      <p className={cn(
                        "text-sm font-semibold",
                        isActive ? "text-gold" : isDone ? "text-green-300" : "text-void-200"
                      )}>
                        {s.title}
                      </p>
                      <p className="text-xs text-void-500">{s.description}</p>
                    </div>
                  </div>
                  {i < withdrawSteps.length - 1 && (
                    <ArrowRight className="w-4 h-4 text-void-600 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Privacy strength indicator */}
        {step === "idle" && <PrivacyStrength commitmentCount={commitmentCount} />}

        {/* Enhanced proof generation progress */}
        {(step === "proving" || step === "verifying" || step === "submitting-root") && (
          <ProofProgress subStep={proofSubStep} proofTime={0} />
        )}

        {/* Submitting status */}
        {step === "submitting" && (
          <div className="p-3 rounded-xl bg-gold/5 border border-gold/20 space-y-2">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-gold animate-spin shrink-0" />
              <p className="text-sm text-gold">
                Sending privately via relayer...
              </p>
            </div>
            <p className="text-[10px] font-[family-name:var(--font-mono)] text-void-500 ml-6">
              {proofSubStep || "Relayer submitting ZK proof on-chain"}
            </p>
          </div>
        )}

        {/* Privacy proof panel — the "aha moment" */}
        {step === "done" && proofResult && (
          <PrivacyProofPanel
            depositor={address || "0x???"}
            recipient={recipient}
            proofResult={proofResult}
            proofTime={proofTime}
            txHash={txHash}
          />
        )}

        {step === "error" && error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/5 border border-red-500/20">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <div>
              <p className="text-sm text-red-400">Proof generation failed</p>
              <p className="text-[10px] text-red-400/60 font-[family-name:var(--font-mono)] mt-0.5 break-all">
                {error}
              </p>
            </div>
          </div>
        )}

        {/* Upload note */}
        {step === "idle" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-void-400">Upload Withdrawal Key</label>
              <button
                onClick={handleLoadLastDeposit}
                className="text-[10px] font-[family-name:var(--font-mono)] text-gold/70 hover:text-gold transition-colors flex items-center gap-1"
              >
                <Zap className="w-3 h-3" />
                Load last deposit
              </button>
            </div>
            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className={cn(
                "flex items-center gap-2 px-4 py-3 border border-dashed rounded-xl text-sm transition-colors",
                fileError
                  ? "border-red-500/40 text-red-400"
                  : "border-void-600 text-void-500 hover:border-gold/30 hover:text-void-400"
              )}>
                <Upload className="w-4 h-4" />
                {fileName || "Choose withdrawal key (.json)"}
              </div>
            </div>
            {fileError && (
              <p className="text-xs text-red-400 flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3 shrink-0" />
                {fileError}
              </p>
            )}
            {/* Encrypted note — ask for password */}
            {pendingEncrypted && (
              <div className="p-3 rounded-xl bg-gold/5 border border-gold/20 space-y-2">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-gold" />
                  <p className="text-xs text-gold">Encrypted key — enter password to unlock</p>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder="Password"
                    value={decryptPassword}
                    onChange={(e) => setDecryptPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleDecrypt()}
                    className="flex-1"
                  />
                  <Button size="sm" onClick={handleDecrypt} disabled={!decryptPassword}>
                    Decrypt
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {note && step === "idle" && (
          <>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/5 border border-green-500/20">
              <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
              <p className="text-sm text-green-400">
                Key loaded — ready to send
              </p>
            </div>
            <div className="p-3 rounded-xl bg-void-900/80 border border-void-700/50 text-xs font-[family-name:var(--font-mono)] text-void-400 break-all space-y-1">
              <div>
                <span className="text-void-500">Nullifier: </span>
                {note.nullifier.slice(0, 16)}...
              </div>
              <div>
                <span className="text-void-500">Amount: </span>
                {(
                  Number(BigInt(note.depositAmount)) / 10 ** pool.tokenDecimals
                ).toLocaleString()}{" "}
                {pool.tokenSymbol}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-void-400">
                Recipient Address
              </label>
              <Input
                placeholder="0x..."
                value={recipient}
                onChange={(e) => handleRecipientChange(e.target.value)}
                className={addressError ? "border-red-500/40" : ""}
              />
              <p className="text-[10px] font-[family-name:var(--font-mono)] text-void-500">
                Any Starknet address — the recipient stays private
              </p>
              {addressError && (
                <p className="text-xs text-red-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  {addressError}
                </p>
              )}
            </div>
          </>
        )}

        {/* Action button */}
        {step === "idle" && (
          <Button
            disabled={!note || !recipient}
            className="w-full"
            variant={note && recipient ? "default" : "outline"}
            onClick={handleWithdraw}
          >
            {!note
              ? "Upload Key to Continue"
              : !recipient
                ? "Enter Recipient Address"
                : "Generate Proof & Send"}
          </Button>
        )}

        {step === "done" && (
          <Button className="w-full" variant="outline" onClick={reset}>
            Send Again
          </Button>
        )}

        {step === "error" && (
          <Button className="w-full" variant="outline" onClick={reset}>
            Try Again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
