import Link from "next/link";
import { ArrowRight, Shield, Vault, Eye, Lock, ShieldCheck, EyeOff, Code, Landmark, KeyRound } from "lucide-react";
import { RevealSection } from "@/components/reveal-section";
import { HeroStats } from "@/components/hero-stats";
import { AnonymityPool } from "@/components/anonymity-pool";
import { DualOnramp } from "@/components/dual-onramp";

const steps = [
  {
    number: "01",
    icon: Vault,
    title: "Deposit Bitcoin",
    description:
      "Lock your BTC or WBTC as collateral and mint vUSD — a dollar-pegged stablecoin backed 150% by real Bitcoin.",
    href: "/vault",
  },
  {
    number: "02",
    icon: ShieldCheck,
    title: "Pass a Quick Check",
    description:
      "A one-time compliance screen adds your address to the approved list. After that, your identity is never shared again.",
    href: "/pool",
  },
  {
    number: "03",
    icon: EyeOff,
    title: "Send Without a Trace",
    description:
      "Deposit vUSD into the privacy pool. When you withdraw, zero-knowledge proofs guarantee nobody can link sender to receiver.",
    href: "/pool",
  },
];

const whyCards = [
  {
    icon: Eye,
    title: "Your Balance, Your Business",
    description:
      "On-chain payments expose your entire wallet history. Veil breaks that link so only you know what you hold.",
  },
  {
    icon: ShieldCheck,
    title: "Safe and Legal",
    description:
      "Every depositor passes an approved-sender check. You get privacy without mixing with bad actors.",
  },
  {
    icon: Lock,
    title: "Backed by Real Bitcoin",
    description:
      "Every vUSD in circulation is over-collateralized by BTC. No algorithmic tricks — just hard assets.",
  },
];

const trustItems = [
  {
    icon: Landmark,
    title: "Compliance Layer",
    description: "Approved-sender list ensures bad actors can't enter the pool.",
  },
  {
    icon: KeyRound,
    title: "Non-Custodial",
    description: "Your keys, your coins. Veil never holds your funds.",
  },
  {
    icon: Code,
    title: "Open Source",
    description: "Every contract is verified and readable on-chain.",
  },
  {
    icon: Shield,
    title: "Over-Collateralized",
    description: "150% minimum backing — your BTC is always safe.",
  },
];

export default function HomePage() {
  return (
    <div className="relative">
      {/* Grid background */}
      <div className="absolute inset-0 grid-bg pointer-events-none" />
      {/* Radial glow behind hero */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gold/[0.04] rounded-full blur-[120px] pointer-events-none" />
      {/* Pulse rings */}
      <div className="absolute top-32 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full border border-gold/10 pulse-ring pointer-events-none" />
      <div className="absolute top-32 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full border border-gold/5 pulse-ring-delayed pointer-events-none" />

      <div className="relative mx-auto max-w-4xl px-6">
        {/* Hero */}
        <section className="pt-28 pb-20 text-center">
          <h1 className="animate-fade-up delay-100 font-[family-name:var(--font-display)] text-5xl sm:text-7xl text-void-50 leading-[1.1] tracking-tight">
            Send Money Privately.
            <br />
            <span className="text-shimmer">Backed by Bitcoin.</span>
          </h1>
          <p className="animate-fade-up delay-200 text-lg text-void-400 mt-8 max-w-md mx-auto leading-relaxed">
            Turn your BTC into a private stablecoin. Send payments no one can
            trace — without breaking any rules.
          </p>
          <div className="animate-fade-up delay-300 mt-10 flex items-center justify-center gap-4">
            <Link
              href="/vault"
              className="group inline-flex items-center gap-2 px-7 py-3.5 bg-gold hover:bg-gold-light text-void-950 rounded-xl text-sm font-semibold transition-all duration-200 glow-gold"
            >
              Get Started
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 px-7 py-3.5 glass rounded-xl text-sm font-medium text-void-300 hover:text-void-100 transition-colors"
            >
              How It Works
            </a>
          </div>

          {/* Trust badges */}
          <div className="animate-fade-up delay-300 mt-10">
            <HeroStats />
          </div>
        </section>

        {/* Why Go Private? */}
        <RevealSection className="pb-20">
          <div className="text-center mb-8">
            <h2 className="font-[family-name:var(--font-display)] text-3xl text-void-50">
              Why Go Private?
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {whyCards.map((card) => (
              <div
                key={card.title}
                className="glass rounded-2xl p-6 hover:border-gold/30 hover:glow-soft transition-all duration-300"
              >
                <card.icon className="w-5 h-5 text-gold mb-4" />
                <h3 className="text-base font-semibold text-void-100 mb-2">
                  {card.title}
                </h3>
                <p className="text-sm text-void-500 leading-relaxed">
                  {card.description}
                </p>
              </div>
            ))}
          </div>
        </RevealSection>

        {/* How it works — 3 steps */}
        <RevealSection className="pb-20">
          <div id="how-it-works" className="text-center mb-8">
            <h2 className="font-[family-name:var(--font-display)] text-3xl text-void-50">
              How It Works
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {steps.map((step, i) => (
              <Link
                key={i}
                href={step.href}
                className="group relative glass glass-lift rounded-2xl p-6 hover:border-gold/30 hover:glow-soft"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-[10px] font-[family-name:var(--font-mono)] text-gold/60 tracking-widest">
                    {step.number}
                  </span>
                  <div className="h-px flex-1 bg-void-700/50" />
                  <step.icon className="w-4 h-4 text-void-500 group-hover:text-gold transition-colors duration-300" />
                </div>
                <h3 className="text-base font-semibold text-void-100 mb-2 group-hover:text-void-50 transition-colors">
                  {step.title}
                </h3>
                <p className="text-sm text-void-500 leading-relaxed">
                  {step.description}
                </p>
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-2 w-4 h-px bg-gradient-to-r from-void-600/50 to-transparent" />
                )}
              </Link>
            ))}
          </div>
        </RevealSection>

        {/* Dual on-ramp: Native BTC vs WBTC */}
        <RevealSection className="pb-20">
          <div className="text-center mb-8">
            <h2 className="font-[family-name:var(--font-display)] text-3xl text-void-50">
              Your Bitcoin, Two Ways In
            </h2>
            <p className="mt-2 text-sm text-void-400 max-w-md mx-auto leading-relaxed">
              Use native BTC or wrapped BTC — both paths lead to the same
              private pool.
            </p>
          </div>
          <DualOnramp />
        </RevealSection>

        {/* Built for Trust */}
        <RevealSection className="pb-20">
          <div className="text-center mb-8">
            <h2 className="font-[family-name:var(--font-display)] text-3xl text-void-50">
              Built for Trust
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {trustItems.map((item) => (
              <div
                key={item.title}
                className="glass rounded-2xl p-5 hover:border-gold/30 transition-all duration-300"
              >
                <item.icon className="w-4 h-4 text-gold mb-3" />
                <h3 className="text-sm font-semibold text-void-100 mb-1">
                  {item.title}
                </h3>
                <p className="text-xs text-void-500 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </RevealSection>

        {/* Anonymity set visualization */}
        <RevealSection className="pb-20">
          <AnonymityPool />
        </RevealSection>

        {/* Final CTA */}
        <RevealSection className="pb-24">
          <div className="glass rounded-2xl p-10 text-center">
            <h2 className="font-[family-name:var(--font-display)] text-3xl text-void-50 mb-3">
              Ready to Go Private?
            </h2>
            <p className="text-sm text-void-400 max-w-md mx-auto mb-8">
              Deposit Bitcoin, mint vUSD, and send payments that can&apos;t be
              traced — all in under a minute.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/vault"
                className="group inline-flex items-center gap-2 px-7 py-3.5 bg-gold hover:bg-gold-light text-void-950 rounded-xl text-sm font-semibold transition-all duration-200 glow-gold"
              >
                Get Started
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href="https://github.com/edwardtay/veil"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-7 py-3.5 glass rounded-xl text-sm font-medium text-void-300 hover:text-void-100 transition-colors"
              >
                View Source
              </a>
            </div>
          </div>
        </RevealSection>
      </div>
    </div>
  );
}
