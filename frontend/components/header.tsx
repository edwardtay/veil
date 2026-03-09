"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useConnect, useDisconnect } from "@starknet-react/core";
import { Wallet, LogOut, ChevronDown, Menu, X, Copy, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/cn";
import { useBtcWallet } from "@/hooks/use-btc-wallet";

const WALLET_LABELS: Record<string, string> = {
  unisat: "Unisat",
  xverse: "Xverse",
  leather: "Leather",
};

const WALLET_ICONS: Record<string, string> = {
  unisat: "/wallets/unisat.svg",
  xverse: "/wallets/xverse.jpg",
  leather: "/wallets/leather.jpg",
};

function BitcoinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1.7 14.5h-1v1.8h-1.4v-1.8h-.9v1.8H9v-1.8H7.5v-1.3H9V8.8H7.5V7.5H9V5.7h1.4v1.8h.9V5.7h1.4v1.9c1.7.2 2.9 1 2.9 2.4 0 1-.5 1.7-1.3 2.1 1.1.3 1.8 1.2 1.8 2.3 0 1.6-1.3 2.6-3.4 2.8v-.7zm-.3-6.1c0-.9-.7-1.3-1.8-1.3h-.3v2.7h.3c1.1 0 1.8-.5 1.8-1.4zm.3 3.7c0-1-.7-1.5-2-1.5h-.4v3h.4c1.3 0 2-.5 2-1.5z" />
    </svg>
  );
}

export function Header() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const btc = useBtcWallet();

  const [showWallets, setShowWallets] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showBtcMenu, setShowBtcMenu] = useState(false);
  const [showBtcPicker, setShowBtcPicker] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [copied, setCopied] = useState<"starknet" | "btc" | null>(null);

  const copyAddress = (addr: string, type: "starknet" | "btc") => {
    navigator.clipboard.writeText(addr);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const dropdownRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const btcMenuRef = useRef<HTMLDivElement>(null);
  const btcPickerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowWallets(false);
      }
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setShowAccountMenu(false);
      }
      if (btcMenuRef.current && !btcMenuRef.current.contains(e.target as Node)) {
        setShowBtcMenu(false);
      }
      if (btcPickerRef.current && !btcPickerRef.current.contains(e.target as Node)) {
        setShowBtcPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const truncatedAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "";

  const truncatedBtc = btc.address
    ? `${btc.address.slice(0, 6)}...${btc.address.slice(-4)}`
    : "";

  const navItems = [
    { href: "/vault", label: "Mint", step: "1" },
    { href: "/pool", label: "Send", step: "2" },
  ];

  const neitherConnected = !isConnected && !btc.isConnected;

  return (
    <header className="border-b border-void-800/80 bg-void-950/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-6 h-14">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <img src="/veil-logo.png" alt="Veil" className="w-7 h-7 rounded" />
            <span className="font-[family-name:var(--font-display)] text-xl text-void-50">
              Veil
            </span>
          </Link>
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md bg-void-800/50 border border-void-700/30">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] font-[family-name:var(--font-mono)] text-void-500">
              Starknet Sepolia
            </span>
          </div>
          <nav className="hidden sm:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors",
                  pathname === item.href
                    ? "bg-void-800 text-void-50"
                    : "text-void-400 hover:text-void-200 hover:bg-void-800/50"
                )}
              >
                <span className="text-[10px] font-[family-name:var(--font-mono)] text-void-500">
                  {item.step}
                </span>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {/* Starknet connected badge */}
          {isConnected && (
            <div className="relative" ref={accountRef}>
              <button
                onClick={() => setShowAccountMenu(!showAccountMenu)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm glass rounded-lg text-void-300 hover:text-void-100 transition-colors"
              >
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="font-[family-name:var(--font-mono)] text-xs">
                  {truncatedAddress}
                </span>
                <ChevronDown className={cn("w-3 h-3 transition-transform", showAccountMenu && "rotate-180")} />
              </button>
              {showAccountMenu && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-void-900 border border-void-700 rounded-xl overflow-hidden animate-fade-up shadow-2xl">
                  <div className="px-4 py-3 border-b border-void-700/50">
                    <p className="text-[10px] font-[family-name:var(--font-mono)] text-void-500">Starknet</p>
                    <p className="text-xs font-[family-name:var(--font-mono)] text-void-300 mt-0.5">{truncatedAddress}</p>
                  </div>
                  <button
                    onClick={() => address && copyAddress(address, "starknet")}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-void-800 transition-colors flex items-center gap-2 text-void-400 hover:text-void-200"
                  >
                    {copied === "starknet" ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied === "starknet" ? "Copied!" : "Copy Address"}
                  </button>
                  <button
                    onClick={() => {
                      disconnect();
                      setShowAccountMenu(false);
                    }}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-red-500/10 transition-colors flex items-center gap-2 text-void-400 hover:text-red-400"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          )}

          {/* BTC connected badge */}
          {btc.isConnected && (
            <div className="relative" ref={btcMenuRef}>
              <button
                onClick={() => setShowBtcMenu(!showBtcMenu)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm glass rounded-lg text-void-300 hover:text-void-100 transition-colors border border-orange-400/20"
              >
                <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                {btc.walletName && <img src={WALLET_ICONS[btc.walletName]} alt={WALLET_LABELS[btc.walletName]} className="w-4 h-4 rounded" />}
                <span className="font-[family-name:var(--font-mono)] text-xs">
                  {truncatedBtc}
                </span>
                <ChevronDown className={cn("w-3 h-3 transition-transform", showBtcMenu && "rotate-180")} />
              </button>
              {showBtcMenu && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-void-900 border border-void-700 rounded-xl overflow-hidden animate-fade-up shadow-2xl">
                  <div className="px-4 py-3 border-b border-void-700/50">
                    <p className="text-[10px] font-[family-name:var(--font-mono)] text-orange-400">
                      {btc.walletName ? WALLET_LABELS[btc.walletName] : "Bitcoin"}
                    </p>
                    <p className="text-xs font-[family-name:var(--font-mono)] text-void-300 mt-0.5">{truncatedBtc}</p>
                    {btc.balance > 0 && (
                      <p className="text-xs font-[family-name:var(--font-mono)] text-orange-400/70 mt-1">
                        {btc.balanceBTC} BTC
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => btc.address && copyAddress(btc.address, "btc")}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-void-800 transition-colors flex items-center gap-2 text-void-400 hover:text-void-200"
                  >
                    {copied === "btc" ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied === "btc" ? "Copied!" : "Copy Address"}
                  </button>
                  <button
                    onClick={() => {
                      btc.disconnect();
                      setShowBtcMenu(false);
                    }}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-red-500/10 transition-colors flex items-center gap-2 text-void-400 hover:text-red-400"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          )}

          {/* "+ BTC" button — shown when Starknet connected but BTC not, and BTC wallets detected */}
          {isConnected && !btc.isConnected && btc.availableWallets.length > 0 && (
            <div className="relative" ref={btcPickerRef}>
              <button
                onClick={() => setShowBtcPicker(!showBtcPicker)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-orange-400/30 text-orange-400 hover:bg-orange-400/10 transition-colors"
              >
                <BitcoinIcon className="w-3 h-3" />
                + BTC
              </button>
              {showBtcPicker && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-void-900 border border-void-700 rounded-xl overflow-hidden animate-fade-up shadow-2xl">
                  <div className="px-4 py-2 border-b border-void-700/50">
                    <p className="text-[10px] font-[family-name:var(--font-mono)] text-orange-400">Connect Bitcoin</p>
                  </div>
                  {btc.availableWallets.map((w) => (
                    <button
                      key={w}
                      onClick={() => {
                        btc.connect(w);
                        setShowBtcPicker(false);
                      }}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-void-700/50 transition-colors flex items-center gap-3 text-void-300 hover:text-void-100"
                    >
                      <img src={WALLET_ICONS[w]} alt={WALLET_LABELS[w]} className="w-5 h-5 rounded" />
                      {WALLET_LABELS[w]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Unified connect dropdown — when neither wallet connected */}
          {neitherConnected && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowWallets(!showWallets)}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-gold hover:bg-gold-light text-void-950 rounded-lg transition-colors font-medium"
              >
                <Wallet className="w-3.5 h-3.5" />
                Connect
                <ChevronDown className={cn("w-3 h-3 transition-transform", showWallets && "rotate-180")} />
              </button>
              {showWallets && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-void-900 border border-void-700 rounded-xl overflow-hidden animate-fade-up shadow-2xl">
                  {/* Starknet section */}
                  <div className="px-4 py-2 border-b border-void-700/50">
                    <p className="text-[10px] font-[family-name:var(--font-mono)] text-green-400">Starknet</p>
                  </div>
                  {connectors.map((connector) => (
                    <button
                      key={connector.id}
                      onClick={() => {
                        connect({ connector });
                        setShowWallets(false);
                      }}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-void-700/50 transition-colors flex items-center gap-3 text-void-300 hover:text-void-100"
                    >
                      {connector.icon && (
                        <img
                          src={typeof connector.icon === "string" ? connector.icon : connector.icon.light}
                          alt={connector.name}
                          className="w-5 h-5 rounded"
                        />
                      )}
                      {connector.name}
                    </button>
                  ))}

                  {/* Bitcoin section — only if wallets detected */}
                  {btc.availableWallets.length > 0 && (
                    <>
                      <div className="px-4 py-2 border-t border-b border-void-700/50">
                        <p className="text-[10px] font-[family-name:var(--font-mono)] text-orange-400">Bitcoin</p>
                      </div>
                      {btc.availableWallets.map((w) => (
                        <button
                          key={w}
                          onClick={() => {
                            btc.connect(w);
                            setShowWallets(false);
                          }}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-void-700/50 transition-colors flex items-center gap-3 text-void-300 hover:text-void-100"
                        >
                          <img src={WALLET_ICONS[w]} alt={WALLET_LABELS[w]} className="w-5 h-5 rounded" />
                          {WALLET_LABELS[w]}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Connect button — when only BTC connected (no Starknet) */}
          {!isConnected && btc.isConnected && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowWallets(!showWallets)}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-gold hover:bg-gold-light text-void-950 rounded-lg transition-colors font-medium"
              >
                <Wallet className="w-3.5 h-3.5" />
                Connect Starknet
              </button>
              {showWallets && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-void-900 border border-void-700 rounded-xl overflow-hidden animate-fade-up shadow-2xl">
                  {connectors.map((connector) => (
                    <button
                      key={connector.id}
                      onClick={() => {
                        connect({ connector });
                        setShowWallets(false);
                      }}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-void-700/50 transition-colors flex items-center gap-3 text-void-300 hover:text-void-100"
                    >
                      {connector.icon && (
                        <img
                          src={typeof connector.icon === "string" ? connector.icon : connector.icon.light}
                          alt={connector.name}
                          className="w-5 h-5 rounded"
                        />
                      )}
                      {connector.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Mobile menu toggle */}
          <button
            className="sm:hidden text-void-400 hover:text-void-200 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-void-800/50 bg-void-950/95 backdrop-blur-xl animate-fade-in">
          <nav className="flex flex-col px-6 py-3 gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                  pathname === item.href
                    ? "bg-void-800 text-void-50"
                    : "text-void-400 hover:text-void-200 hover:bg-void-800/50"
                )}
              >
                <span className="text-[10px] font-[family-name:var(--font-mono)] text-void-500">
                  {item.step}
                </span>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
