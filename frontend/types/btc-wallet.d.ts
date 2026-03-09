/* Ambient types for BTC browser extension wallets */

interface UnisatWallet {
  requestAccounts(): Promise<string[]>;
  getAccounts(): Promise<string[]>;
  getBalance(): Promise<{ confirmed: number; unconfirmed: number; total: number }>;
  getNetwork(): Promise<string>;
  on(event: "accountsChanged", handler: (accounts: string[]) => void): void;
  removeListener(event: "accountsChanged", handler: (accounts: string[]) => void): void;
}

interface XverseAddress {
  address: string;
  publicKey: string;
  purpose: "payment" | "ordinals" | "stacks";
}

interface XverseProvider {
  getAddress(): Promise<{ addresses: XverseAddress[] }>;
}

interface LeatherAddress {
  symbol: string;
  type: string;
  address: string;
}

interface LeatherProvider {
  request(
    method: "getAddresses"
  ): Promise<{ result: { addresses: LeatherAddress[] } }>;
}

interface Window {
  unisat?: UnisatWallet;
  BitcoinProvider?: XverseProvider;
  LeatherProvider?: LeatherProvider;
}
