"use client";

import { useAccount, useReadContract, useSendTransaction } from "@starknet-react/core";
import { RpcProvider } from "starknet";
import { VAULT_ABI, ERC20_ABI, CONTRACT_ADDRESSES } from "@/lib/contracts";
import { RPC_URL } from "@/lib/constants";

export function useVaultPosition() {
  const { address } = useAccount();

  const { data: position, ...positionQuery } = useReadContract({
    abi: VAULT_ABI,
    address: CONTRACT_ADDRESSES.vault,
    functionName: "get_position",
    args: address ? [address] : undefined,
    enabled: !!address,
    refetchInterval: 10_000,
  });

  const { data: ratio, ...ratioQuery } = useReadContract({
    abi: VAULT_ABI,
    address: CONTRACT_ADDRESSES.vault,
    functionName: "get_collateral_ratio",
    args: address ? [address] : undefined,
    enabled: !!address,
    refetchInterval: 10_000,
  });

  const positionData = position as bigint[] | undefined;
  const collateral = positionData ? BigInt(String(positionData[0] ?? 0)) : 0n;
  const debt = positionData ? BigInt(String(positionData[1] ?? 0)) : 0n;
  // Contract returns u256::MAX when debt is 0 — treat as 0 (no ratio to display)
  const rawRatio = ratio ? BigInt(String(ratio)) : 0n;
  const collateralRatio = rawRatio > 100_000n ? 0n : rawRatio;

  return {
    collateral,
    debt,
    collateralRatio,
    isLoading: positionQuery.isLoading || ratioQuery.isLoading,
    refetch: () => {
      positionQuery.refetch();
      ratioQuery.refetch();
    },
  };
}

/** Pre-flight: simulate each call via RPC to surface revert reasons */
async function simulateCalls(
  calls: { contractAddress: string; entrypoint: string; calldata: string[] }[],
) {
  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  for (const call of calls) {
    try {
      await provider.callContract(
        { contractAddress: call.contractAddress, entrypoint: call.entrypoint, calldata: call.calldata },
        "latest",
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[preflight] ${call.entrypoint} failed:`, msg);
      // Extract short revert reason if present
      const match = msg.match(/Failure reason:\s*"?([^"]+)"?/) || msg.match(/error:\s*"?([^"]+)"?/i);
      throw new Error(match ? `${call.entrypoint}: ${match[1]}` : `${call.entrypoint} reverted — check console`);
    }
  }
}

export function useVaultActions() {
  const { sendAsync } = useSendTransaction({});
  const { address } = useAccount();

  const depositCollateral = async (amount: bigint) => {
    const calls = [
      {
        contractAddress: CONTRACT_ADDRESSES.wbtc,
        entrypoint: "approve",
        calldata: [CONTRACT_ADDRESSES.vault, amount.toString(), "0"],
      },
      {
        contractAddress: CONTRACT_ADDRESSES.vault,
        entrypoint: "deposit_collateral",
        calldata: [amount.toString(), "0"],
      },
    ];
    return sendAsync(calls);
  };

  const withdrawCollateral = async (amount: bigint) => {
    const calls = [
      {
        contractAddress: CONTRACT_ADDRESSES.vault,
        entrypoint: "withdraw_collateral",
        calldata: [amount.toString(), "0"],
      },
    ];
    return sendAsync(calls);
  };

  const mintVusd = async (amount: bigint) => {
    const calls = [
      {
        contractAddress: CONTRACT_ADDRESSES.vault,
        entrypoint: "mint_vusd",
        calldata: [amount.toString(), "0"],
      },
    ];
    return sendAsync(calls);
  };

  const repayVusd = async (amount: bigint) => {
    const calls = [
      {
        contractAddress: CONTRACT_ADDRESSES.vusd,
        entrypoint: "approve",
        calldata: [CONTRACT_ADDRESSES.vault, amount.toString(), "0"],
      },
      {
        contractAddress: CONTRACT_ADDRESSES.vault,
        entrypoint: "repay_vusd",
        calldata: [amount.toString(), "0"],
      },
    ];
    // Pre-flight the repay call (skip approve — it's a write that won't simulate as the user)
    try {
      const provider = new RpcProvider({ nodeUrl: RPC_URL });
      // Check user's vUSD balance
      const bal = await provider.callContract(
        { contractAddress: CONTRACT_ADDRESSES.vusd, entrypoint: "balance_of", calldata: [address!] },
        "latest",
      );
      console.log("[preflight] vUSD balance:", bal);
      // Check debt
      const pos = await provider.callContract(
        { contractAddress: CONTRACT_ADDRESSES.vault, entrypoint: "get_position", calldata: [address!] },
        "latest",
      );
      console.log("[preflight] position (collateral, debt):", pos);
    } catch (e) {
      console.error("[preflight] read failed:", e);
    }
    return sendAsync(calls);
  };

  const depositAndMint = async (wbtcAmount: bigint, vusdAmount: bigint) => {
    const calls = [
      {
        contractAddress: CONTRACT_ADDRESSES.wbtc,
        entrypoint: "approve",
        calldata: [CONTRACT_ADDRESSES.vault, wbtcAmount.toString(), "0"],
      },
      {
        contractAddress: CONTRACT_ADDRESSES.vault,
        entrypoint: "deposit_collateral",
        calldata: [wbtcAmount.toString(), "0"],
      },
      {
        contractAddress: CONTRACT_ADDRESSES.vault,
        entrypoint: "mint_vusd",
        calldata: [vusdAmount.toString(), "0"],
      },
    ];
    return sendAsync(calls);
  };

  return { depositCollateral, withdrawCollateral, mintVusd, repayVusd, depositAndMint };
}
