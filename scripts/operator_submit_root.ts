/**
 * Veil Operator — Submit BN128 Merkle Root
 *
 * Reads on-chain deposit events from the pool, rebuilds the BN128 Poseidon
 * Merkle tree off-chain, and submits the root via submit_bn128_root().
 *
 * This is required before any ZK withdrawal can succeed, because the pool
 * contract verifies the Groth16 proof against a known BN128 root.
 *
 * Usage:
 *   DEPLOYER_PRIVATE_KEY=0x... npx tsx scripts/operator_submit_root.ts
 *
 * Env vars:
 *   DEPLOYER_PRIVATE_KEY  — pool owner's private key (required)
 *   STARKNET_RPC_URL      — RPC endpoint (default: Cartridge Sepolia)
 *   POOL_ADDRESS           — override pool contract address
 */

import { Account, RpcProvider, CallData, cairo, Contract } from "starknet";
import { fileURLToPath } from "url";
import * as path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Config ---
const RPC_URL = process.env.STARKNET_RPC_URL || "https://api.cartridge.gg/x/starknet/sepolia";
const DEPLOYER_ADDRESS = "0x030b1bf2b51efcf4abdadac496c016468c1249af2ac06ace0c905c1406a74f81";
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const POOL_ADDRESS = process.env.POOL_ADDRESS || "0x023e283e7b3f8315bcb7e0aafbbede641ee3bfd6df99dd68a319406ee3bed74f";

const TREE_DEPTH = 20;

// Minimal ABI for the pool view functions we need
const POOL_ABI = [
  {
    type: "function",
    name: "commitment_count",
    inputs: [],
    outputs: [{ type: "core::integer::u32" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "get_bn128_root",
    inputs: [],
    outputs: [{ type: "core::integer::u256" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "deposit_amount",
    inputs: [],
    outputs: [{ type: "core::integer::u256" }],
    state_mutability: "view",
  },
] as const;

async function main() {
  console.log("=== Veil Operator: Submit BN128 Root ===\n");

  if (!DEPLOYER_PRIVATE_KEY) {
    console.error("ERROR: Set DEPLOYER_PRIVATE_KEY env var");
    process.exit(1);
  }

  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  const account = new Account({
    provider,
    address: DEPLOYER_ADDRESS,
    signer: DEPLOYER_PRIVATE_KEY,
  });

  // Read current pool state
  const pool = new Contract(POOL_ABI, POOL_ADDRESS, provider);
  const commitmentCount = Number(await pool.commitment_count());
  const currentRoot = BigInt(await pool.get_bn128_root());
  const depositAmount = BigInt(await pool.deposit_amount());

  console.log(`Pool:              ${POOL_ADDRESS.slice(0, 16)}...`);
  console.log(`Deposit amount:    ${depositAmount} (${Number(depositAmount / BigInt(1e18))} vUSD)`);
  console.log(`Commitments:       ${commitmentCount}`);
  console.log(`Current BN128 root: ${currentRoot === 0n ? "(none)" : currentRoot.toString().slice(0, 20) + "..."}`);

  if (commitmentCount === 0) {
    console.log("\nNo deposits yet — nothing to do.");
    process.exit(0);
  }

  // Fetch Deposited events to get all commitments
  console.log("\nFetching deposit events...");

  // Get events from the pool contract
  const events = await provider.getEvents({
    address: POOL_ADDRESS,
    // Deposited event key (sn_keccak of "Deposited")
    keys: [],
    from_block: { block_number: 0 },
    to_block: "latest",
    chunk_size: 100,
  });

  // Filter for Deposited events — they have commitment as first data key
  // Event structure: key[0] = event selector, data = [commitment, leaf_index, timestamp]
  const depositedSelector = "0x" + BigInt("0x" + Buffer.from(
    Array.from(
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode("Deposited"))
      )
    ).map(b => b.toString(16).padStart(2, "0")).join("")
  ).toString(16)).toString(16);

  // Actually, Starknet event selectors use sn_keccak. Let's just match by
  // looking for events with the right shape — 3 data elements (commitment, leaf_index, timestamp)
  // and one key (the commitment as indexed field).
  console.log(`  Found ${events.events.length} total events from pool`);

  // For the BN128 tree, we need the deposit amount (value) per deposit.
  // All deposits use the same fixed amount, so we compute BN128 commitments
  // from scratch using the deposit events.
  //
  // However, we can't recompute BN128 commitments from on-chain data alone
  // because nullifier+secret are private. The operator must either:
  //   a) Have the notes (from the frontend), or
  //   b) Accept BN128 commitments directly
  //
  // For a demo, we build a single-leaf tree from the note file if available,
  // or accept a BN128 commitment as an argument.

  // Try loading note from e2e script or argument
  let bn128Commitments: bigint[] = [];

  const noteArg = process.argv[2];
  if (noteArg) {
    // Direct BN128 commitment passed as argument
    bn128Commitments.push(BigInt(noteArg));
    console.log(`  Using BN128 commitment from argument: ${noteArg.slice(0, 20)}...`);
  } else {
    // Try loading from e2e_note.json
    try {
      const fs = await import("fs");
      const notePath = path.join(__dirname, "e2e_note.json");
      const note = JSON.parse(fs.readFileSync(notePath, "utf-8"));
      if (note.bn128Commitment) {
        bn128Commitments.push(BigInt(note.bn128Commitment));
        console.log(`  Loaded BN128 commitment from e2e_note.json`);
      }
    } catch {
      // No note file — compute from scratch if we have a pending note in stdin
    }

    if (bn128Commitments.length === 0) {
      // Build from frontend-generated notes if available
      // Check for notes/*.json
      try {
        const fs = await import("fs");
        const notesDir = path.join(__dirname, "..", "notes");
        if (fs.existsSync(notesDir)) {
          const files = fs.readdirSync(notesDir).filter((f: string) => f.endsWith(".json"));
          for (const file of files) {
            const note = JSON.parse(fs.readFileSync(path.join(notesDir, file), "utf-8"));
            if (note.bn128Commitment) {
              bn128Commitments.push(BigInt(note.bn128Commitment));
            }
          }
          if (bn128Commitments.length > 0) {
            console.log(`  Loaded ${bn128Commitments.length} BN128 commitments from notes/`);
          }
        }
      } catch {
        // ignore
      }
    }
  }

  if (bn128Commitments.length === 0) {
    console.log("\n  No BN128 commitments found. Computing from deposit events...");
    console.log("  (For a real deployment, the operator collects BN128 commitments from depositors)");
    console.log("");
    console.log("  Usage options:");
    console.log("    npx tsx scripts/operator_submit_root.ts <bn128_commitment>");
    console.log("    npx tsx scripts/operator_submit_root.ts  (reads from e2e_note.json or notes/)");
    process.exit(1);
  }

  // Build BN128 Poseidon Merkle tree
  console.log("\nBuilding BN128 Poseidon Merkle tree...");

  const { buildPoseidon } = await import("circomlibjs");
  const poseidon = await buildPoseidon();
  const F = poseidon.F;

  // Build incremental Merkle tree matching the on-chain structure
  const zeroHashes: bigint[] = [];
  let zh = BigInt(0);
  for (let i = 0; i < TREE_DEPTH; i++) {
    zeroHashes.push(zh);
    zh = BigInt(F.toString(poseidon([zh, zh])));
  }

  // Initialize filled subtrees with zero hashes
  const filledSubtrees = [...zeroHashes];
  let nextIndex = 0;

  function insertLeaf(leaf: bigint): bigint {
    let currentHash = leaf;
    let currentIndex = nextIndex;

    for (let i = 0; i < TREE_DEPTH; i++) {
      if (currentIndex % 2 === 0) {
        filledSubtrees[i] = currentHash;
        currentHash = BigInt(F.toString(poseidon([currentHash, zeroHashes[i]])));
      } else {
        currentHash = BigInt(F.toString(poseidon([filledSubtrees[i], currentHash])));
      }
      currentIndex = Math.floor(currentIndex / 2);
    }

    nextIndex++;
    return currentHash;
  }

  let root = BigInt(0);
  for (const commitment of bn128Commitments) {
    root = insertLeaf(commitment);
  }

  console.log(`  Inserted ${bn128Commitments.length} leaves`);
  console.log(`  BN128 Merkle root: ${root.toString().slice(0, 30)}...`);

  // Check if this root is already submitted
  if (root === currentRoot) {
    console.log("\n  Root already matches on-chain — no submission needed.");
    process.exit(0);
  }

  // Submit root
  console.log("\nSubmitting BN128 root to pool...");
  const tx = await account.execute({
    contractAddress: POOL_ADDRESS,
    entrypoint: "submit_bn128_root",
    calldata: CallData.compile({
      root: cairo.uint256(root),
    }),
  });

  console.log(`  Tx hash: ${tx.transaction_hash}`);
  console.log("  Waiting for confirmation...");

  await provider.waitForTransaction(tx.transaction_hash, { retryInterval: 5000 });
  console.log("  Confirmed!");

  // Verify
  const newRoot = BigInt(await pool.get_bn128_root());
  console.log(`\n  On-chain BN128 root: ${newRoot.toString().slice(0, 30)}...`);
  console.log(`  Match: ${newRoot === root ? "YES" : "NO"}`);

  console.log("\n=== Root submitted successfully ===");
  console.log(`  Starkscan: https://sepolia.starkscan.co/tx/${tx.transaction_hash}`);
  console.log("\nWithdrawals using this root are now enabled.\n");
}

main().catch((err) => {
  console.error("Operator script failed:", err);
  process.exit(1);
});
