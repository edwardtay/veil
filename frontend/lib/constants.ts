export const WBTC_DECIMALS = 8;
export const VUSD_DECIMALS = 18;
export const ORACLE_DECIMALS = 8;
export const CR_BASIS_POINTS = 100; // 15000 = 150.00%

// Starknet Sepolia deployed contract addresses
export const CONTRACTS = {
  vault: "0x03b6ad9665b47bea278b8dcc90d9821f440ad3145a0a02d58026711495662084",
  vusd: "0x02cc2fb33e8c648507dfe59f01f1fbeb323987045629901564bb0472c84c5897",
  oracle: "0x004ec6a96c4229a51d948d7f6db8d58283c47ed0d7e043f907ddd75c5d76d436",
  pool: "0x01150440ebed5cd3b4033f5a8b386701bd78da100d66793cb69eaded364601db",
  pool_wbtc: "0x059fef88dff753192fc76d87b5af52fb2418d219bfcd640cea28e38c8e9f05da",
  verifier: "0x07f4948f0c17629a8933a2125ca7494eaf1905cf76464d70650fffb10c38e8e4",
  wbtc: "0x061a9d3f95920ce5ecb1639357c8624fb0727e49e030967313f9fe70cb11e357",
} as const;

export const POOL_DEPOSIT_AMOUNT = BigInt("1000000000000000000"); // 1 vUSD (18 decimals)

// Pool configurations for dual-pool support
export type PoolType = "vusd" | "wbtc";

export interface DenominationConfig {
  label: string;
  value: number;
  depositAmount: bigint;
  poolAddress: `0x${string}`;
}

export interface PoolConfig {
  address: `0x${string}`;
  tokenAddress: `0x${string}`;
  tokenSymbol: string;
  tokenDecimals: number;
  defaultDepositAmount: bigint;
  description: string;
  denominations: DenominationConfig[];
}

export const POOL_CONFIGS: Record<PoolType, PoolConfig> = {
  vusd: {
    address: CONTRACTS.pool as `0x${string}`,
    tokenAddress: CONTRACTS.vusd as `0x${string}`,
    tokenSymbol: "vUSD",
    tokenDecimals: VUSD_DECIMALS,
    defaultDepositAmount: BigInt("1000000000000000000"), // 1 vUSD
    description: "Privacy pool for vUSD stablecoin",
    denominations: [
      { label: "1", value: 1, depositAmount: BigInt("1000000000000000000"), poolAddress: CONTRACTS.pool as `0x${string}` },
      { label: "10", value: 10, depositAmount: BigInt("10000000000000000000"), poolAddress: "0x023516140ad855098beb5a28556a1c5df28809e03d8bd8a5e1b7c084e2b92049" },
      { label: "100", value: 100, depositAmount: BigInt("100000000000000000000"), poolAddress: "0x0533cc9dca4c9c65a8996def0224dfaafa6a6231e4625fd71a0582bf5ce54ba4" },
      { label: "1,000", value: 1000, depositAmount: BigInt("1000000000000000000000"), poolAddress: "0x0601850deea1b6c23aee6164271741de698408600049f30dbe894ee3c7aafbc6" },
    ],
  },
  wbtc: {
    address: CONTRACTS.pool_wbtc as `0x${string}`,
    tokenAddress: CONTRACTS.wbtc as `0x${string}`,
    tokenSymbol: "WBTC",
    tokenDecimals: WBTC_DECIMALS,
    defaultDepositAmount: BigInt("100000"), // 0.001 WBTC (100,000 sats)
    description: "Privacy pool for WBTC (direct BTC mixing)",
    denominations: [
      { label: "0.001", value: 0.001, depositAmount: BigInt("100000"), poolAddress: CONTRACTS.pool_wbtc as `0x${string}` },
      { label: "0.01", value: 0.01, depositAmount: BigInt("1000000"), poolAddress: "0x03ba814e52a58a9efc563394973faad206f8a9547c554a356074e4f43ad30620" },
      { label: "0.1", value: 0.1, depositAmount: BigInt("10000000"), poolAddress: "0x023e4c4b03d4a0d21844fe945f478c8e0e4613409d4d81d39e6c9d7482136de2" },
      { label: "1", value: 1, depositAmount: BigInt("100000000"), poolAddress: "0x0127b81fd29c0303ffc4f1ac83827176ac88ed69acc550174bbd0566fe53a4d9" },
    ],
  },
};

/** Resolve a PoolConfig for a specific denomination amount */
export function resolvePoolForAmount(pool: PoolConfig, depositAmount: bigint): PoolConfig {
  const denom = pool.denominations.find(d => d.depositAmount === depositAmount);
  if (!denom) return pool;
  return { ...pool, address: denom.poolAddress, defaultDepositAmount: denom.depositAmount };
}

// Block number just before contract deployment — avoids scanning millions of empty blocks
export const DEPLOY_BLOCK = 6340000;

// Starknet Sepolia RPC — env var with public fallback
export const RPC_FALLBACK = "https://api.cartridge.gg/x/starknet/sepolia";
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || RPC_FALLBACK;
