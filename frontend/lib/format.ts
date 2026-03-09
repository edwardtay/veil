import { WBTC_DECIMALS, VUSD_DECIMALS, ORACLE_DECIMALS, CR_BASIS_POINTS } from "./constants";

export function formatBTC(value: bigint): string {
  const num = Number(value) / 10 ** WBTC_DECIMALS;
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  });
}

export function formatUSD(value: bigint): string {
  const num = Number(value) / 10 ** VUSD_DECIMALS;
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatOraclePrice(value: bigint): string {
  const num = Number(value) / 10 ** ORACLE_DECIMALS;
  return num.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function formatRatio(basisPoints: bigint): string {
  const pct = Number(basisPoints) / CR_BASIS_POINTS;
  return `${pct.toFixed(2)}%`;
}

export function parseWBTC(value: string): bigint {
  const num = parseFloat(value);
  if (isNaN(num) || num < 0) return 0n;
  return BigInt(Math.floor(num * 10 ** WBTC_DECIMALS));
}

export function parseVUSD(value: string): bigint {
  const num = parseFloat(value);
  if (isNaN(num) || num < 0) return 0n;
  return BigInt(Math.floor(num * 10 ** VUSD_DECIMALS));
}
