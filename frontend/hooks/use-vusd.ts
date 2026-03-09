"use client";

import { useAccount, useReadContract } from "@starknet-react/core";
import { ERC20_ABI, CONTRACT_ADDRESSES } from "@/lib/contracts";

export function useVusdBalance() {
  const { address } = useAccount();

  const { data, ...query } = useReadContract({
    abi: ERC20_ABI,
    address: CONTRACT_ADDRESSES.vusd,
    functionName: "balance_of",
    args: address ? [address] : undefined,
    enabled: !!address,
    refetchInterval: 10_000,
  });

  const balance = data ? BigInt(String(data)) : 0n;

  return { balance, ...query };
}

export function useWbtcBalance() {
  const { address } = useAccount();

  const { data, ...query } = useReadContract({
    abi: ERC20_ABI,
    address: CONTRACT_ADDRESSES.wbtc,
    functionName: "balance_of",
    args: address ? [address] : undefined,
    enabled: !!address,
    refetchInterval: 10_000,
  });

  const balance = data ? BigInt(String(data)) : 0n;

  return { balance, ...query };
}
