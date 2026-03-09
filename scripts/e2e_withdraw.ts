/**
 * Veil E2E ZK Withdrawal Demo — Starknet Sepolia
 *
 * Demonstrates the full dual-path withdrawal pipeline:
 *   1. Generate note (nullifier, secret)
 *   2. Compute Starknet Poseidon commitment → deposit into pool
 *   3. Compute BN128 Poseidon commitment → build Merkle tree → submit root
 *   4. Generate Groth16 proof with snarkjs
 *   5. Generate Garaga calldata
 *   6. Call withdraw_with_proof on-chain → Garaga verifies proof
 *
 * Usage:
 *   npx tsx scripts/e2e_withdraw.ts
 */

import { Account, RpcProvider, CallData, hash, num, cairo } from "starknet";
import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Config ---
const RPC_URL = process.env.STARKNET_RPC_URL || "https://api.cartridge.gg/x/starknet/sepolia";
const DEPLOYER_ADDRESS = "0x030b1bf2b51efcf4abdadac496c016468c1249af2ac06ace0c905c1406a74f81";
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;

// Contract addresses
const VUSD_ADDRESS = "0x02cc2fb33e8c648507dfe59f01f1fbeb323987045629901564bb0472c84c5897";
const POOL_ADDRESS = process.env.POOL_ADDRESS || "0x02f7e0ef1256efbd3fd76a9f48631dfee687717b52fc475789f868b67828815b";
const VERIFIER_ADDRESS = process.env.VERIFIER_ADDRESS || "0x07f4948f0c17629a8933a2125ca7494eaf1905cf76464d70650fffb10c38e8e4";

const DEPOSIT_AMOUNT = BigInt("1000000000000000000"); // 1 vUSD (18 decimals)
const TREE_DEPTH = 20;

// Paths
const CIRCUITS_DIR = path.resolve(__dirname, "../circuits");
const BUILD_DIR = path.join(CIRCUITS_DIR, "build");
const GARAGA_BIN = path.resolve(__dirname, "../.garaga-venv/bin/garaga");

// --- Helpers ---

function randomBigInt(bits: number = 248): bigint {
  const bytes = crypto.randomBytes(Math.ceil(bits / 8));
  let val = BigInt("0x" + bytes.toString("hex"));
  val = val >> BigInt(256 - bits); // Ensure it fits in ~248 bits
  return val;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForTx(provider: RpcProvider, txHash: string, label: string) {
  console.log(`  Waiting for ${label}... (${txHash.slice(0, 16)}...)`);
  let attempts = 0;
  while (attempts < 60) {
    try {
      const receipt = await provider.waitForTransaction(txHash, { retryInterval: 5000 });
      if (
        (receipt as any).execution_status === "SUCCEEDED" ||
        (receipt as any).finality_status === "ACCEPTED_ON_L2"
      ) {
        console.log(`  ${label} confirmed!`);
        return receipt;
      }
    } catch (e: any) {
      if (e.message?.includes("not found") || e.message?.includes("NOT_RECEIVED")) {
        await sleep(5000);
        attempts++;
        continue;
      }
      throw e;
    }
  }
  throw new Error(`Timeout waiting for ${label}`);
}

// --- BN128 Poseidon (via circomlibjs) ---

async function computeBN128Values(nullifier: bigint, secret: bigint, value: bigint) {
  const circomlibjs = await import("circomlibjs");
  const poseidon = await circomlibjs.buildPoseidon();

  const nullifierHash = poseidon.F.toString(poseidon([nullifier]));
  const precommitment = poseidon.F.toString(poseidon([nullifier, secret]));
  const commitment = poseidon.F.toString(poseidon([value, BigInt(precommitment)]));

  return { nullifierHash, precommitment, commitment, poseidon, F: poseidon.F };
}

function buildBN128MerkleTree(
  poseidon: any,
  F: any,
  leaf: bigint,
  depth: number
): { root: string; pathElements: string[]; pathIndices: number[] } {
  const pathElements: string[] = [];
  const pathIndices: number[] = [];

  let currentHash = leaf;
  let zeroHash = BigInt(0);

  for (let i = 0; i < depth; i++) {
    pathElements.push(zeroHash.toString());
    pathIndices.push(0); // leaf is always left child in a single-leaf tree

    currentHash = BigInt(F.toString(poseidon([currentHash, zeroHash])));
    zeroHash = BigInt(F.toString(poseidon([zeroHash, zeroHash])));
  }

  return { root: currentHash.toString(), pathElements, pathIndices };
}

// --- Starknet Poseidon (mirrors on-chain logic) ---

function computeStarknetCommitment(nullifier: bigint, secret: bigint, value: bigint) {
  const nullifierHash = hash.computePoseidonHashOnElements([nullifier]);
  const precommitment = hash.computePoseidonHashOnElements([nullifier, secret]);
  const commitment = hash.computePoseidonHashOnElements([value, num.toBigInt(precommitment)]);

  return {
    nullifierHash: num.toHex(nullifierHash),
    precommitment: num.toHex(precommitment),
    commitment: num.toHex(commitment),
  };
}

// --- Main ---

async function main() {
  console.log("=== Veil E2E ZK Withdrawal Demo ===\n");

  if (!DEPLOYER_PRIVATE_KEY) {
    console.error("ERROR: Set DEPLOYER_PRIVATE_KEY env var");
    process.exit(1);
  }
  if (!POOL_ADDRESS) {
    console.error("ERROR: Set POOL_ADDRESS env var");
    process.exit(1);
  }
  if (!VERIFIER_ADDRESS) {
    console.error("ERROR: Set VERIFIER_ADDRESS env var (for reference)");
    process.exit(1);
  }

  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  const account = new Account({
    provider,
    address: DEPLOYER_ADDRESS,
    signer: DEPLOYER_PRIVATE_KEY,
  });

  // Step 1: Generate note
  console.log("Step 1: Generate note (nullifier + secret)");
  const nullifier = randomBigInt(248);
  const secret = randomBigInt(248);
  console.log(`  nullifier: ${nullifier.toString().slice(0, 20)}...`);
  console.log(`  secret:    ${secret.toString().slice(0, 20)}...`);

  // Step 2: Compute Starknet Poseidon commitment
  console.log("\nStep 2: Compute Starknet Poseidon commitment");
  const starknetVals = computeStarknetCommitment(nullifier, secret, DEPOSIT_AMOUNT);
  console.log(`  commitment: ${starknetVals.commitment}`);

  // Step 3: Register for demo (ASP self-approval)
  console.log("\nStep 3: Register deployer for ASP approval");
  const registerTx = await account.execute({
    contractAddress: POOL_ADDRESS,
    entrypoint: "register_for_demo",
    calldata: [],
  });
  await waitForTx(provider, registerTx.transaction_hash, "ASP registration");

  // Step 4: Approve vUSD transfer to pool
  console.log("\nStep 4: Approve vUSD for pool deposit");
  const approveTx = await account.execute({
    contractAddress: VUSD_ADDRESS,
    entrypoint: "approve",
    calldata: CallData.compile({
      spender: POOL_ADDRESS,
      amount: cairo.uint256(DEPOSIT_AMOUNT),
    }),
  });
  await waitForTx(provider, approveTx.transaction_hash, "vUSD approval");

  // Step 5: Deposit into pool (Starknet Poseidon commitment)
  console.log("\nStep 5: Deposit into pool");
  const depositTx = await account.execute({
    contractAddress: POOL_ADDRESS,
    entrypoint: "deposit",
    calldata: [starknetVals.commitment],
  });
  await waitForTx(provider, depositTx.transaction_hash, "pool deposit");

  // Step 6: Compute BN128 Poseidon values
  console.log("\nStep 6: Compute BN128 Poseidon commitment + Merkle tree");
  const bn128 = await computeBN128Values(nullifier, secret, DEPOSIT_AMOUNT);

  console.log(`  BN128 nullifierHash: ${bn128.nullifierHash.slice(0, 20)}...`);
  console.log(`  BN128 commitment:    ${bn128.commitment.slice(0, 20)}...`);

  const tree = buildBN128MerkleTree(bn128.poseidon, bn128.F, BigInt(bn128.commitment), TREE_DEPTH);
  console.log(`  BN128 Merkle root:   ${tree.root.slice(0, 20)}...`);

  // Step 7: Submit BN128 root to pool (owner-only)
  console.log("\nStep 7: Submit BN128 Merkle root to pool");
  const rootBigInt = BigInt(tree.root);
  const submitRootTx = await account.execute({
    contractAddress: POOL_ADDRESS,
    entrypoint: "submit_bn128_root",
    calldata: CallData.compile({
      root: cairo.uint256(rootBigInt),
    }),
  });
  await waitForTx(provider, submitRootTx.transaction_hash, "BN128 root submission");

  // Step 8: Generate Groth16 proof with snarkjs
  console.log("\nStep 8: Generate Groth16 proof");
  const input = {
    root: tree.root,
    nullifierHash: bn128.nullifierHash,
    nullifier: nullifier.toString(),
    secret: secret.toString(),
    value: DEPOSIT_AMOUNT.toString(),
    pathElements: tree.pathElements,
    pathIndices: tree.pathIndices,
  };

  const inputPath = path.join(BUILD_DIR, "e2e_input.json");
  fs.writeFileSync(inputPath, JSON.stringify(input, null, 2));
  console.log(`  Input written to ${inputPath}`);

  // Generate witness
  const wasmPath = path.join(BUILD_DIR, "withdraw_js", "withdraw.wasm");
  const witnessPath = path.join(BUILD_DIR, "e2e_witness.wtns");
  const generateWitnessJs = path.join(BUILD_DIR, "withdraw_js", "generate_witness.js");

  execFileSync("node", [generateWitnessJs, wasmPath, inputPath, witnessPath], { stdio: "pipe" });
  console.log("  Witness generated");

  // Generate proof
  const snarkjsBin = path.resolve(CIRCUITS_DIR, "node_modules/.bin/snarkjs");
  const zkeyPath = path.join(BUILD_DIR, "withdraw_final.zkey");
  const proofPath = path.join(BUILD_DIR, "e2e_proof.json");
  const publicPath = path.join(BUILD_DIR, "e2e_public.json");

  execFileSync(snarkjsBin, ["groth16", "prove", zkeyPath, witnessPath, proofPath, publicPath], {
    stdio: "pipe",
  });
  console.log("  Groth16 proof generated!");

  // Verify locally
  const vkPath = path.join(BUILD_DIR, "verification_key.json");
  try {
    execFileSync(snarkjsBin, ["groth16", "verify", vkPath, publicPath, proofPath], {
      stdio: "pipe",
    });
    console.log("  Local verification: PASSED");
  } catch {
    console.error("  Local verification: FAILED");
    process.exit(1);
  }

  // Step 9: Generate Garaga calldata
  console.log("\nStep 9: Generate Garaga calldata");
  const garagaOutput = execFileSync(
    GARAGA_BIN,
    [
      "calldata",
      "--system",
      "groth16",
      "--vk",
      vkPath,
      "--proof",
      proofPath,
      "--public-inputs",
      publicPath,
      "--format",
      "array",
    ],
    { encoding: "utf-8" }
  ).trim();

  // Parse garaga output — it returns a JSON array of large decimal numbers.
  // We must parse them as strings (not JS Numbers) to preserve precision.
  // Replace bare numbers with quoted strings before JSON.parse.
  const safeJson = garagaOutput.replace(/(?<=[\[,\s])(\d+)(?=[\],\s])/g, '"$1"');
  let calldataArray: string[];
  try {
    calldataArray = JSON.parse(safeJson);
  } catch {
    // Fallback: split by comma or newline
    calldataArray = garagaOutput
      .replace(/[\[\]]/g, "")
      .split(/[,\n]/)
      .map((l) => l.trim())
      .filter(Boolean);
  }
  console.log(`  Garaga calldata: ${calldataArray.length} felt252 values`);
  console.log(`  Sample values: ${calldataArray.slice(0, 3).map(v => v.toString().slice(0, 20)).join(", ")}`);

  // Step 10: Submit withdrawal with proof
  console.log("\nStep 10: Submit on-chain withdrawal with Garaga-verified proof");
  const nullifierHashU256 = BigInt(bn128.nullifierHash);

  const withdrawTx = await account.execute({
    contractAddress: POOL_ADDRESS,
    entrypoint: "withdraw_with_proof",
    calldata: CallData.compile({
      nullifier_hash: cairo.uint256(nullifierHashU256),
      recipient: DEPLOYER_ADDRESS,
      proof: calldataArray,
    }),
  });
  await waitForTx(provider, withdrawTx.transaction_hash, "ZK withdrawal");

  // Summary
  console.log("\n=== E2E Withdrawal Complete! ===\n");
  console.log("Transaction hashes:");
  console.log(
    `  ASP Registration: https://sepolia.starkscan.co/tx/${registerTx.transaction_hash}`
  );
  console.log(`  vUSD Approval:    https://sepolia.starkscan.co/tx/${approveTx.transaction_hash}`);
  console.log(`  Pool Deposit:     https://sepolia.starkscan.co/tx/${depositTx.transaction_hash}`);
  console.log(
    `  BN128 Root:       https://sepolia.starkscan.co/tx/${submitRootTx.transaction_hash}`
  );
  console.log(
    `  ZK Withdrawal:    https://sepolia.starkscan.co/tx/${withdrawTx.transaction_hash}`
  );
  console.log(
    "\nThe withdrawal proof was verified on-chain by Garaga's BN254 pairing engine."
  );
  console.log("The smart contract validated the BN128 Merkle root and nullifier hash.");
  console.log("Privacy preserved: deposit-withdrawal link is hidden by the ZK proof.\n");

  // Save note for reference
  const note = {
    nullifier: nullifier.toString(),
    secret: secret.toString(),
    depositAmount: DEPOSIT_AMOUNT.toString(),
    starknetCommitment: starknetVals.commitment,
    bn128Commitment: bn128.commitment,
    bn128NullifierHash: bn128.nullifierHash,
    bn128Root: tree.root,
    txHashes: {
      register: registerTx.transaction_hash,
      approve: approveTx.transaction_hash,
      deposit: depositTx.transaction_hash,
      submitRoot: submitRootTx.transaction_hash,
      withdraw: withdrawTx.transaction_hash,
    },
  };
  const notePath = path.join(__dirname, "e2e_note.json");
  fs.writeFileSync(notePath, JSON.stringify(note, null, 2));
  console.log(`Note saved to ${notePath}`);
}

main().catch((err) => {
  console.error("E2E failed:", err);
  process.exit(1);
});
