/**
 * Operator account helper for server-side Starknet transactions.
 * Used by API routes (submit-root, relay-withdraw) on Vercel.
 *
 * Uses starknet v9 (installed as "starknet-v7") with RPC09 channel
 * for proper V3 transaction support (l2_gas, l1_data_gas).
 * The frontend uses starknet v6 via starknet-react — server-side only.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — starknet-v7 is an npm alias for starknet@9.x
import { RpcProvider, Account, RPC09 } from "starknet-v7";

const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ||
  "https://api.cartridge.gg/x/starknet/sepolia";

/** Patch "pending" block_id to "latest" for Cartridge RPC compatibility */
async function patchedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  if (init?.body && typeof init.body === "string" && init.body.includes('"pending"')) {
    init = { ...init, body: init.body.replace(/"pending"/g, '"latest"') };
  }
  return globalThis.fetch(input, init);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedProvider: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedAccount: any = null;

export function getOperatorAccount() {
  if (cachedAccount) return cachedAccount;

  const address = process.env.OPERATOR_ADDRESS?.trim();
  const privateKey = process.env.OPERATOR_PRIVATE_KEY?.trim();

  if (!address || !privateKey) {
    throw new Error("Operator not configured");
  }

  const channel = new RPC09.RpcChannel({ nodeUrl: RPC_URL });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (channel as any).baseFetch = patchedFetch;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const provider = new RpcProvider(channel as any);
  cachedProvider = provider;

  cachedAccount = new Account({ provider, address, signer: privateKey });
  return cachedAccount;
}

export async function operatorInvoke(
  calls: { contractAddress: string; entrypoint: string; calldata: string[] }[],
): Promise<string> {
  const account = getOperatorAccount();
  const result = await account.execute(
    calls.map((c: { contractAddress: string; entrypoint: string; calldata: string[] }) => ({
      contractAddress: c.contractAddress,
      entrypoint: c.entrypoint,
      calldata: c.calldata,
    })),
  );
  return result.transaction_hash;
}

export async function operatorCall(
  contractAddress: string,
  entrypoint: string,
  calldata: string[],
): Promise<string[]> {
  // Ensure provider is initialized
  if (!cachedProvider) getOperatorAccount();
  return cachedProvider.callContract({ contractAddress, entrypoint, calldata });
}
