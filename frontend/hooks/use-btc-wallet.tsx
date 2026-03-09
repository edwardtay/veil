"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type WalletName = "unisat" | "xverse" | "leather";

const INSTALL_URLS: Record<WalletName, string> = {
  unisat: "https://unisat.io/download",
  xverse: "https://www.xverse.app/download",
  leather: "https://leather.io/install-extension",
};

interface BtcWalletState {
  address: string;
  balance: number;
  balanceBTC: string;
  network: string;
  walletName: WalletName | null;
  isConnected: boolean;
  isConnecting: boolean;
  availableWallets: WalletName[];
  connect: (wallet: WalletName) => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
}

const BtcWalletContext = createContext<BtcWalletState | null>(null);

function satsToBTC(sats: number): string {
  return (sats / 1e8).toFixed(8).replace(/\.?0+$/, "");
}

export function BtcWalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState("");
  const [balance, setBalance] = useState(0);
  const [network, setNetwork] = useState("");
  const [walletName, setWalletName] = useState<WalletName | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [availableWallets, setAvailableWallets] = useState<WalletName[]>([]);

  // Always show all 3 wallets — handle "not installed" at connect time
  useEffect(() => {
    setAvailableWallets(["unisat", "xverse", "leather"]);
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!walletName || !address) return;
    try {
      if (walletName === "unisat" && window.unisat) {
        const bal = await window.unisat.getBalance();
        setBalance(bal.confirmed);
      }
    } catch {
      // balance refresh is best-effort
    }
  }, [walletName, address]);

  const connect = useCallback(async (wallet: WalletName) => {
    setIsConnecting(true);
    try {
      if (wallet === "unisat") {
        if (!window.unisat) {
          window.open(INSTALL_URLS.unisat, "_blank");
          return;
        }
        const accounts = await window.unisat.requestAccounts();
        if (!accounts[0]) throw new Error("No account");
        setAddress(accounts[0]);
        const bal = await window.unisat.getBalance();
        setBalance(bal.confirmed);
        const net = await window.unisat.getNetwork();
        setNetwork(net);
        setWalletName("unisat");
      } else if (wallet === "xverse") {
        if (!window.BitcoinProvider) {
          window.open(INSTALL_URLS.xverse, "_blank");
          return;
        }
        const resp = await window.BitcoinProvider.getAddress();
        const payment = resp.addresses.find((a) => a.purpose === "payment");
        if (!payment) throw new Error("No payment address");
        setAddress(payment.address);
        setBalance(0);
        setNetwork("livenet");
        setWalletName("xverse");
      } else if (wallet === "leather") {
        if (!window.LeatherProvider) {
          window.open(INSTALL_URLS.leather, "_blank");
          return;
        }
        const resp = await window.LeatherProvider.request("getAddresses");
        const btcAddr = resp.result.addresses.find(
          (a) => a.symbol === "BTC" && a.type === "p2wpkh"
        );
        if (!btcAddr) throw new Error("No BTC address");
        setAddress(btcAddr.address);
        setBalance(0);
        setNetwork("mainnet");
        setWalletName("leather");
      }
    } catch (err) {
      console.error(`Failed to connect ${wallet}:`, err);
      setAddress("");
      setBalance(0);
      setWalletName(null);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress("");
    setBalance(0);
    setNetwork("");
    setWalletName(null);
  }, []);

  // Listen to Unisat account changes
  useEffect(() => {
    if (walletName !== "unisat" || !window.unisat) return;
    const handler = (accounts: string[]) => {
      if (accounts[0]) {
        setAddress(accounts[0]);
        refreshBalance();
      } else {
        disconnect();
      }
    };
    window.unisat.on("accountsChanged", handler);
    return () => window.unisat?.removeListener("accountsChanged", handler);
  }, [walletName, refreshBalance, disconnect]);

  return (
    <BtcWalletContext.Provider
      value={{
        address,
        balance,
        balanceBTC: satsToBTC(balance),
        network,
        walletName,
        isConnected: !!address,
        isConnecting,
        availableWallets,
        connect,
        disconnect,
        refreshBalance,
      }}
    >
      {children}
    </BtcWalletContext.Provider>
  );
}

export function useBtcWallet() {
  const ctx = useContext(BtcWalletContext);
  if (!ctx) throw new Error("useBtcWallet must be used within BtcWalletProvider");
  return ctx;
}
