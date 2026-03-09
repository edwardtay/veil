# Veil

**Private, BTC-backed stablecoins on Starknet.**

Deposit WBTC. Mint vUSD. Send it privately — verified on-chain with zero-knowledge proofs.

**[Try the MVP →](https://starknet-veil.vercel.app)**

---

## How It Works

```
WBTC ──→ CDP Vault ──→ vUSD ──→ Privacy Pool ──→ ZK Withdraw
            │                        │                 │
       Pragma Oracle          Poseidon Merkle     Garaga Groth16
       (BTC/USD)              (depth 20, ~1M)     (BN254 on-chain)
```

1. **Collateralize** — Lock WBTC in a CDP vault at 150% collateral ratio
2. **Mint** — Receive vUSD stablecoin backed by your BTC position
3. **Shield** — Deposit vUSD into a fixed-denomination privacy pool
4. **Send** — Withdraw to any address with a Groth16 ZK proof — no link to the depositor

## Privacy Model

| Layer | How it works |
|-------|-------------|
| **ZK Proofs** | Groth16 BN254 proves "I own a valid deposit" without revealing which one |
| **Relayer** | Withdrawals submitted by an operator — user's wallet never touches the withdraw tx |
| **Timing** | Random 30–120s delay between root submission and withdrawal defeats timing analysis |
| **Compliance** | ASP-approved address set enforced at the contract level — privacy with guardrails |

On-chain view: `Deposit from A → ... → Withdrawal from relayer R to B`. No link between A and B.

## Dual-Path ZK Architecture

Starknet's native field ≠ BN128. Veil bridges the gap:

- **Deposits** commit in both Starknet Poseidon (on-chain state) and BN128 Poseidon (proof system)
- **Proofs** are generated client-side over the BN128 Merkle tree via Circom + snarkjs
- **Verification** happens on-chain through Garaga's BN254 pairing engine (~1,949 felt252 per proof)
- **Anchoring** — the contract enforces `leaf_count == commitment_count` when accepting BN128 roots, preventing phantom root injection

## Stack

| | |
|---|---|
| **Contracts** | Cairo · OpenZeppelin (pausable, ownable, ERC20, circuit breaker) |
| **Proofs** | Circom · snarkjs · Groth16 (5,602 constraints, depth-20 Poseidon Merkle) |
| **Verification** | Garaga — on-chain Groth16 BN254 pairing verification |
| **Oracle** | Pragma — live BTC/USD feed with staleness checks |
| **Frontend** | Next.js 15 · starknet-react · in-browser proof generation |

## Contracts (Starknet Sepolia)

| Contract | Address |
|---|---|
| vUSD Pool (1 vUSD) | [`0x0115...01db`](https://sepolia.starkscan.co/contract/0x01150440ebed5cd3b4033f5a8b386701bd78da100d66793cb69eaded364601db) |
| vUSD Pool (10) | [`0x0235...2049`](https://sepolia.starkscan.co/contract/0x023516140ad855098beb5a28556a1c5df28809e03d8bd8a5e1b7c084e2b92049) |
| vUSD Pool (100) | [`0x0533...ba4`](https://sepolia.starkscan.co/contract/0x0533cc9dca4c9c65a8996def0224dfaafa6a6231e4625fd71a0582bf5ce54ba4) |
| vUSD Pool (1000) | [`0x0601...bc6`](https://sepolia.starkscan.co/contract/0x0601850deea1b6c23aee6164271741de698408600049f30dbe894ee3c7aafbc6) |
| WBTC Pool (0.001) | [`0x059f...05da`](https://sepolia.starkscan.co/contract/0x059fef88dff753192fc76d87b5af52fb2418d219bfcd640cea28e38c8e9f05da) |
| Garaga Verifier | [`0x07f4...e8e4`](https://sepolia.starkscan.co/contract/0x07f4948f0c17629a8933a2125ca7494eaf1905cf76464d70650fffb10c38e8e4) |
| CDP Vault | [`0x03b6...2084`](https://sepolia.starkscan.co/contract/0x03b6ad9665b47bea278b8dcc90d9821f440ad3145a0a02d58026711495662084) |
| vUSD Token | [`0x02cc...5897`](https://sepolia.starkscan.co/contract/0x02cc2fb33e8c648507dfe59f01f1fbeb323987045629901564bb0472c84c5897) |
| Oracle (Pragma) | [`0x004e...d436`](https://sepolia.starkscan.co/contract/0x004ec6a96c4229a51d948d7f6db8d58283c47ed0d7e043f907ddd75c5d76d436) |
| WBTC Mock | [`0x061a...e357`](https://sepolia.starkscan.co/contract/0x061a9d3f95920ce5ecb1639357c8624fb0727e49e030967313f9fe70cb11e357) |

## Run Locally

```bash
# Contracts
scarb build
snforge test          # 33 tests

# Frontend
cd frontend
pnpm install && pnpm dev
```

## Security

| Feature | Detail |
|---------|--------|
| BN128 commitment anchoring | Proof system anchored to real deposits — no phantom roots |
| Leaf count validation | `submit_bn128_root` enforces `leaf_count == commitment_count` |
| Relayer withdrawal | User wallet never appears in the withdrawal tx |
| Timing decorrelation | Random 30–120s delay between root and withdrawal |
| Circuit breaker | Rate-limited withdrawals with owner kill switch |
| ASP compliance | Approved address set checked on every withdrawal |
| Ragequit | Emergency exit by revealing deposit preimage (forfeits privacy) |

## Known Limitations

| Issue | Path Forward |
|-------|-------------|
| Depositor address stored on-chain | Commitment-only ragequit proofs |
| Recipient visible (compliance by design) | Optional stealth addresses |
| Single operator | Multi-sig or decentralized relayer set |
| Small anonymity sets (testnet) | Mainnet usage grows the set organically |

## License

MIT
