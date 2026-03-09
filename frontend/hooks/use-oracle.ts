"use client";

import { useReadContract, useSendTransaction } from "@starknet-react/core";
import { ORACLE_ABI, CONTRACT_ADDRESSES } from "@/lib/contracts";
import { CONTRACTS } from "@/lib/constants";
import { useCallback, useState } from "react";
import { CallData } from "starknet";

export function useOraclePrice() {
  const { data, ...query } = useReadContract({
    abi: ORACLE_ABI,
    address: CONTRACT_ADDRESSES.oracle,
    functionName: "get_price",
    args: [],
    refetchInterval: 30_000,
  });

  const price = data ? BigInt(String(data)) : 0n;

  return { price, ...query };
}

export function useRefreshOraclePrice() {
  const { sendAsync } = useSendTransaction({});
  const [isPending, setIsPending] = useState(false);

  const refresh = useCallback(async () => {
    setIsPending(true);
    try {
      await sendAsync([
        {
          contractAddress: CONTRACTS.oracle,
          entrypoint: "refresh_from_pragma",
          calldata: CallData.compile({}),
        },
      ]);
    } finally {
      setIsPending(false);
    }
  }, [sendAsync]);

  return { refresh, isPending };
}
