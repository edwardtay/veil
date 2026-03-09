"use client";

import { useState, useCallback } from "react";
import { useReadContract, useSendTransaction } from "@starknet-react/core";
import { POOL_ABI } from "@/lib/contracts";
import { generateWithdrawProof, verifyProofLocally } from "@/lib/prover";
import type { VeilNote } from "@/lib/crypto";
import type { WithdrawProofResult } from "@/lib/prover";
import type { PoolConfig } from "@/lib/constants";

export function usePoolStats(pool: PoolConfig) {
  const { data: countData, ...countQuery } = useReadContract({
    abi: POOL_ABI,
    address: pool.address,
    functionName: "commitment_count",
    args: [],
    refetchInterval: 15_000,
  });

  const { data: amountData, ...amountQuery } = useReadContract({
    abi: POOL_ABI,
    address: pool.address,
    functionName: "deposit_amount",
    args: [],
    refetchInterval: 60_000,
  });

  const commitmentCount = countData ? Number(countData) : 0;
  const depositAmount = amountData ? BigInt(String(amountData)) : 0n;

  return {
    commitmentCount,
    depositAmount,
    isLoading: countQuery.isLoading || amountQuery.isLoading,
  };
}

export function usePoolDeposit(pool: PoolConfig) {
  const { sendAsync } = useSendTransaction({});

  const deposit = async (commitment: string, depositAmount: bigint, bn128Commitment?: string) => {
    // BN128 commitment as u256 (low, high)
    const bn128BigInt = bn128Commitment ? BigInt(bn128Commitment) : 0n;
    const bn128Low = (bn128BigInt & ((1n << 128n) - 1n)).toString();
    const bn128High = (bn128BigInt >> 128n).toString();

    const calls: Parameters<typeof sendAsync>[0] = [
      {
        contractAddress: pool.tokenAddress,
        entrypoint: "approve",
        calldata: [pool.address, depositAmount.toString(), "0"],
      },
      {
        contractAddress: pool.address,
        entrypoint: "deposit",
        calldata: [commitment, bn128Low, bn128High],
      },
    ];

    return sendAsync(calls);
  };

  return { deposit };
}

type WithdrawStep = "idle" | "proving" | "verifying" | "submitting-root" | "submitting" | "done" | "error";

export function usePoolWithdraw(pool: PoolConfig) {
  const [step, setStep] = useState<WithdrawStep>("idle");
  const [proofResult, setProofResult] = useState<WithdrawProofResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proofTime, setProofTime] = useState<number>(0);
  const [proofSubStep, setProofSubStep] = useState<string>("");
  const [txHash, setTxHash] = useState<string>("");

  const withdraw = useCallback(
    async (note: VeilNote, recipient: string) => {
      try {
        setError(null);
        setTxHash("");

        // Step 1: Generate proof (now uses full tree from registry)
        setStep("proving");
        console.log("[veil] generating ZK proof with full BN128 tree...");
        const t0 = performance.now();
        const result = await generateWithdrawProof(
          note,
          (sub) => setProofSubStep(sub),
          pool.address,
        );
        const elapsed = performance.now() - t0;
        setProofTime(Math.round(elapsed));
        setProofResult(result);
        setProofSubStep("");
        console.log(
          `[veil] proof generated in ${(elapsed / 1000).toFixed(1)}s — root: ${result.root.slice(0, 16)}... (anonymity set: ${result.anonymitySet})`,
        );

        // Step 2: Verify locally
        setStep("verifying");
        console.log("[veil] verifying proof locally...");
        const valid = await verifyProofLocally(result.proof, result.publicSignals);
        if (!valid) {
          throw new Error("Local proof verification failed");
        }
        console.log("[veil] local verification passed");

        // Step 3: Submit root via OPERATOR (server-side, unlinkable to user)
        setStep("submitting-root");
        setProofSubStep("Operator submitting BN128 root on-chain...");
        console.log("[veil] requesting operator root submission...");

        const rootRes = await fetch("/api/bn128-registry/submit-root", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            poolAddress: pool.address,
            root: result.root,
            leafCount: result.anonymitySet,
          }),
        });

        if (!rootRes.ok) {
          const errData = await rootRes.json().catch(() => ({}));
          throw new Error(
            `Root submission failed: ${errData.error || rootRes.statusText}`,
          );
        }

        const { txHash: rootTxHash } = await rootRes.json();
        console.log(`[veil] operator submitted root: ${rootTxHash?.slice(0, 16)}...`);

        // Step 4: Random delay to break timing correlation between root submission and withdrawal
        // Without this, an observer can link them by the ~2s gap.
        const delaySec = 30 + Math.floor(Math.random() * 90); // 30-120s
        console.log(`[veil] privacy delay: waiting ${delaySec}s to decorrelate timing...`);
        setStep("submitting");
        for (let i = delaySec; i > 0; i--) {
          setProofSubStep(`Privacy delay: ${i}s remaining (decorrelating timing)...`);
          await new Promise((r) => setTimeout(r, 1000));
        }

        // Step 5: Submit withdrawal via RELAYER (user's wallet never touches the chain)
        setProofSubStep("Relayer submitting withdrawal on-chain...");

        console.log(
          `[veil] relaying withdraw_with_proof (${result.garagaCalldata.length} proof felts)`,
        );

        const relayRes = await fetch("/api/relay-withdraw", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            poolAddress: pool.address,
            nullifierHash: result.nullifierHash,
            recipient,
            proofCalldata: result.garagaCalldata,
          }),
        });

        if (!relayRes.ok) {
          const errData = await relayRes.json().catch(() => ({}));
          throw new Error(
            `Relay withdrawal failed: ${errData.error || relayRes.statusText}`,
          );
        }

        const { txHash: withdrawTxHash } = await relayRes.json();
        if (withdrawTxHash) {
          setTxHash(withdrawTxHash);
          console.log(
            `[veil] relayed tx: ${withdrawTxHash.slice(0, 16)}...`,
          );
        }
        setProofSubStep("");

        // Clear spent note from localStorage
        try {
          localStorage.removeItem("veil_last_deposit");
        } catch {
          /* ignore */
        }

        console.log("[veil] withdrawal complete");
        setStep("done");
      } catch (err) {
        setStep("error");
        const rawMessage = err instanceof Error ? err.message : "Unknown error";
        const normalized = rawMessage.toLowerCase();
        console.error("[veil] withdraw failed:", rawMessage);

        if (
          normalized.includes("already withdrawn") ||
          normalized.includes("already spent")
        ) {
          setError(
            "This deposit was already withdrawn. Each note can only be used once.",
          );
        } else if (
          normalized.includes("unknown bn128 root") ||
          normalized.includes("unknown bn128")
        ) {
          setError(
            "BN128 root not found on-chain. The operator root submission may not have confirmed yet — wait a moment and try again.",
          );
        } else if (
          normalized.includes("operator not configured")
        ) {
          setError(
            "Operator key not configured. Set OPERATOR_PRIVATE_KEY and OPERATOR_ADDRESS in .env.local.",
          );
        } else if (
          normalized.includes("multicall failed") ||
          normalized.includes("not executed")
        ) {
          setError(
            "Transaction simulation failed — the on-chain proof verification may have rejected this proof. Check console for details.",
          );
        } else if (normalized.includes("nonce")) {
          setError(
            "Nonce conflict — please wait a few seconds for the previous transaction to settle, then try again.",
          );
        } else {
          setError(rawMessage);
        }
        throw err;
      }
    },
    [pool.address],
  );

  const reset = useCallback(() => {
    setStep("idle");
    setProofResult(null);
    setError(null);
    setProofTime(0);
    setProofSubStep("");
    setTxHash("");
  }, []);

  return {
    withdraw,
    step,
    proofResult,
    error,
    proofTime,
    proofSubStep,
    txHash,
    reset,
  };
}
