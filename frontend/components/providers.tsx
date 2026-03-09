"use client";

import { sepolia } from "@starknet-react/chains";
import { StarknetConfig, argent, braavos, jsonRpcProvider } from "@starknet-react/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { RPC_URL } from "@/lib/constants";
import { BtcWalletProvider } from "@/hooks/use-btc-wallet";

const connectors = [argent(), braavos()];

function rpcProvider() {
  return jsonRpcProvider({
    rpc: () => ({
      nodeUrl: RPC_URL,
    }),
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <StarknetConfig
        chains={[sepolia]}
        provider={rpcProvider()}
        connectors={connectors}
        autoConnect
      >
        <BtcWalletProvider>{children}</BtcWalletProvider>
      </StarknetConfig>
    </QueryClientProvider>
  );
}
