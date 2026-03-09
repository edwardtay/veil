import type { VeilNote } from "./crypto";

const TREE_DEPTH = 20;

interface Groth16Proof {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
  protocol: string;
}

export interface WithdrawProofResult {
  proof: Groth16Proof;
  publicSignals: string[];
  /** Garaga calldata — felt252 array for on-chain Groth16 verification */
  garagaCalldata: string[];
  root: string;
  nullifierHash: string;
  /** Number of leaves in the BN128 tree (anonymity set size) */
  anonymitySet: number;
}

// ---------------------------------------------------------------------------
// Sparse BN128 Poseidon Merkle tree
// ---------------------------------------------------------------------------

/**
 * Build a sparse Merkle tree from BN128 commitments.
 * Only stores non-zero nodes — memory-efficient even at depth 20.
 */
function buildSparseMerkleTree(
  poseidon: (inputs: bigint[]) => Uint8Array,
  F: { toObject: (x: Uint8Array) => bigint },
  leaves: Map<number, bigint>,
  depth: number,
): { root: bigint; tree: Map<number, bigint>[]; zeroHashes: bigint[] } {
  // Precompute zero hashes at each level
  const zeroHashes: bigint[] = [0n];
  for (let i = 0; i < depth; i++) {
    zeroHashes.push(F.toObject(poseidon([zeroHashes[i], zeroHashes[i]])));
  }

  // Level 0 = leaf nodes
  let currentLevel = new Map(leaves);
  const tree: Map<number, bigint>[] = [new Map(currentLevel)];

  for (let level = 0; level < depth; level++) {
    const nextLevel = new Map<number, bigint>();
    // Collect parent indices that need recomputing
    const parentIndices = new Set<number>();
    for (const idx of currentLevel.keys()) {
      parentIndices.add(Math.floor(idx / 2));
    }
    for (const parentIdx of parentIndices) {
      const leftIdx = parentIdx * 2;
      const rightIdx = parentIdx * 2 + 1;
      const left = currentLevel.get(leftIdx) ?? zeroHashes[level];
      const right = currentLevel.get(rightIdx) ?? zeroHashes[level];
      nextLevel.set(parentIdx, F.toObject(poseidon([left, right])));
    }
    currentLevel = nextLevel;
    tree.push(new Map(currentLevel));
  }

  const root = currentLevel.get(0) ?? zeroHashes[depth];
  return { root, tree, zeroHashes };
}

function getMerklePath(
  tree: Map<number, bigint>[],
  zeroHashes: bigint[],
  leafIndex: number,
  depth: number,
): { pathElements: string[]; pathIndices: number[] } {
  const pathElements: string[] = [];
  const pathIndices: number[] = [];
  let idx = leafIndex;

  for (let level = 0; level < depth; level++) {
    const isRight = idx % 2 === 1;
    const siblingIdx = isRight ? idx - 1 : idx + 1;
    const sibling = tree[level].get(siblingIdx) ?? zeroHashes[level];
    pathElements.push(sibling.toString());
    pathIndices.push(isRight ? 1 : 0);
    idx = Math.floor(idx / 2);
  }

  return { pathElements, pathIndices };
}

// ---------------------------------------------------------------------------
// On-chain BN128 commitment reader
// ---------------------------------------------------------------------------

async function fetchBN128CommitmentsOnChain(poolAddress: string): Promise<string[]> {
  try {
    const { RpcProvider } = await import("starknet");
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://api.cartridge.gg/x/starknet/sepolia";
    const provider = new RpcProvider({ nodeUrl: rpcUrl });

    // First get commitment_count
    const countResult = await provider.callContract({
      contractAddress: poolAddress,
      entrypoint: "commitment_count",
      calldata: [],
    });
    const count = Number(countResult[0]);
    if (count === 0) return [];

    // Try reading BN128 commitments from on-chain storage
    const commitments: string[] = [];
    for (let i = 0; i < count; i++) {
      const result = await provider.callContract({
        contractAddress: poolAddress,
        entrypoint: "get_bn128_commitment",
        calldata: [i.toString()],
      });
      // Returns u256 as [low, high]
      const low = BigInt(result[0]);
      const high = BigInt(result[1]);
      const val = low + (high << 128n);
      // Skip zero commitments (pre-upgrade deposits without BN128 data)
      if (val === 0n) continue;
      commitments.push(val.toString());
    }

    return commitments;
  } catch (err) {
    // Contract may not be upgraded yet — fall back to empty
    console.warn("[veil] on-chain BN128 read failed (contract may need upgrade):", err);
    return [];
  }
}

/** Fallback: fetch BN128 commitments from the legacy ephemeral registry */
async function fetchRegistryFallback(poolAddress: string): Promise<string[]> {
  try {
    const res = await fetch(`/api/bn128-registry?pool=${poolAddress}`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Main proof generation
// ---------------------------------------------------------------------------

/**
 * Generate a Groth16 withdrawal proof in the browser.
 * Builds a full BN128 Poseidon Merkle tree from ALL deposits in the registry
 * so the anonymity set equals the total number of deposits.
 */
export async function generateWithdrawProof(
  note: VeilNote,
  onProgress?: (step: string) => void,
  poolAddress?: string,
): Promise<WithdrawProofResult> {
  onProgress?.("Loading cryptographic libraries...");

  const [snarkjs, { buildPoseidon }] = await Promise.all([
    import("snarkjs"),
    import("circomlibjs"),
  ]);

  onProgress?.("Computing BN128 Poseidon hashes...");

  const poseidon = await buildPoseidon();
  const F = poseidon.F;

  const nullifier = BigInt(note.nullifier);
  const secret = BigInt(note.secret);
  const value = BigInt(note.depositAmount);

  // Recompute hashes with BN128 Poseidon (matching the Circom circuit)
  const nullifierHash = F.toObject(poseidon([nullifier]));
  const precommitment = F.toObject(poseidon([nullifier, secret]));
  const commitment = F.toObject(poseidon([value, precommitment]));
  const myCommitmentStr = commitment.toString();

  // Fetch all BN128 commitments — try on-chain first, then legacy registry
  onProgress?.("Reading BN128 commitments from on-chain...");

  let registry: string[] = [];
  if (poolAddress) {
    registry = await fetchBN128CommitmentsOnChain(poolAddress);
    // Fall back to legacy ephemeral registry if on-chain has nothing
    if (registry.length === 0) {
      onProgress?.("Falling back to legacy registry...");
      registry = await fetchRegistryFallback(poolAddress);
    }
  }

  // Last resort: single-leaf tree with just our commitment
  if (registry.length === 0) {
    registry = [myCommitmentStr];
  }

  const myLeafIndex = registry.indexOf(myCommitmentStr);
  if (myLeafIndex === -1) {
    throw new Error("BN128 commitment not found in registry after registration");
  }

  onProgress?.(`Building Merkle tree (${registry.length} deposits, depth ${TREE_DEPTH})...`);

  // Build sparse Merkle tree from all registered commitments
  const leaves = new Map<number, bigint>();
  for (let i = 0; i < registry.length; i++) {
    leaves.set(i, BigInt(registry[i]));
  }

  const { root, tree, zeroHashes } = buildSparseMerkleTree(
    (inputs) => poseidon(inputs),
    F,
    leaves,
    TREE_DEPTH,
  );

  const { pathElements, pathIndices } = getMerklePath(
    tree,
    zeroHashes,
    myLeafIndex,
    TREE_DEPTH,
  );

  // Build circuit input
  const input = {
    root: root.toString(),
    nullifierHash: nullifierHash.toString(),
    nullifier: nullifier.toString(),
    secret: secret.toString(),
    value: value.toString(),
    pathElements,
    pathIndices,
  };

  onProgress?.("Generating Groth16 proof (5,602 constraints)...");

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    "/circuits/withdraw.wasm",
    "/circuits/withdraw_final.zkey",
  );

  // Load verification key for Garaga calldata generation
  const vkeyResponse = await fetch("/circuits/verification_key.json");
  if (!vkeyResponse.ok) throw new Error("Failed to load verification key");
  const vkey = await vkeyResponse.json();

  onProgress?.("Generating Garaga calldata (BN254 pairing)...");

  const garagaCalldata = await generateGaragaCalldata(proof, publicSignals, vkey);

  onProgress?.("Proof complete");

  return {
    proof,
    publicSignals,
    garagaCalldata,
    root: root.toString(),
    nullifierHash: nullifierHash.toString(),
    anonymitySet: registry.length,
  };
}

/**
 * Generate Garaga calldata for on-chain Groth16 verification.
 */
async function generateGaragaCalldata(
  proof: Groth16Proof,
  publicSignals: string[],
  vkey: Record<string, unknown>,
): Promise<string[]> {
  const { init, getGroth16CallData, CurveId } = await import("garaga");
  await init();

  const garagaProof = {
    a: {
      x: BigInt(proof.pi_a[0]),
      y: BigInt(proof.pi_a[1]),
      curveId: CurveId.BN254,
    },
    b: {
      x: [BigInt(proof.pi_b[0][0]), BigInt(proof.pi_b[0][1])] as [bigint, bigint],
      y: [BigInt(proof.pi_b[1][0]), BigInt(proof.pi_b[1][1])] as [bigint, bigint],
      curveId: CurveId.BN254,
    },
    c: {
      x: BigInt(proof.pi_c[0]),
      y: BigInt(proof.pi_c[1]),
      curveId: CurveId.BN254,
    },
    publicInputs: publicSignals.map((s) => BigInt(s)),
  };

  const vkAlpha = (vkey as { vk_alpha_1: string[] }).vk_alpha_1;
  const vkBeta = (vkey as { vk_beta_2: string[][] }).vk_beta_2;
  const vkGamma = (vkey as { vk_gamma_2: string[][] }).vk_gamma_2;
  const vkDelta = (vkey as { vk_delta_2: string[][] }).vk_delta_2;
  const vkIC = (vkey as { IC: string[][] }).IC;

  const garagaVk = {
    alpha: { x: BigInt(vkAlpha[0]), y: BigInt(vkAlpha[1]), curveId: CurveId.BN254 },
    beta: {
      x: [BigInt(vkBeta[0][0]), BigInt(vkBeta[0][1])] as [bigint, bigint],
      y: [BigInt(vkBeta[1][0]), BigInt(vkBeta[1][1])] as [bigint, bigint],
      curveId: CurveId.BN254,
    },
    gamma: {
      x: [BigInt(vkGamma[0][0]), BigInt(vkGamma[0][1])] as [bigint, bigint],
      y: [BigInt(vkGamma[1][0]), BigInt(vkGamma[1][1])] as [bigint, bigint],
      curveId: CurveId.BN254,
    },
    delta: {
      x: [BigInt(vkDelta[0][0]), BigInt(vkDelta[0][1])] as [bigint, bigint],
      y: [BigInt(vkDelta[1][0]), BigInt(vkDelta[1][1])] as [bigint, bigint],
      curveId: CurveId.BN254,
    },
    ic: vkIC.map((pt: string[]) => ({
      x: BigInt(pt[0]),
      y: BigInt(pt[1]),
      curveId: CurveId.BN254,
    })),
  };

  const calldataBigInts = getGroth16CallData(garagaProof, garagaVk, CurveId.BN254);

  // Strip WASM length prefix — Starknet ABI adds its own
  const proofData = calldataBigInts.slice(1);
  return proofData.map((v: bigint) => v.toString());
}

/**
 * Compute the BN128 Merkle root from the full registry (for operator tooling).
 */
export async function computeBN128Root(
  note: VeilNote,
  poolAddress?: string,
): Promise<{ root: string; commitment: string; anonymitySet: number }> {
  const { buildPoseidon } = await import("circomlibjs");
  const poseidon = await buildPoseidon();
  const F = poseidon.F;

  const nullifier = BigInt(note.nullifier);
  const secret = BigInt(note.secret);
  const value = BigInt(note.depositAmount);

  const precommitment = F.toObject(poseidon([nullifier, secret]));
  const commitment = F.toObject(poseidon([value, BigInt(precommitment)]));
  const myCommitmentStr = commitment.toString();

  // Fetch on-chain commitments, fall back to legacy
  let registry: string[] = [];
  if (poolAddress) {
    registry = await fetchBN128CommitmentsOnChain(poolAddress);
    if (registry.length === 0) {
      registry = await fetchRegistryFallback(poolAddress);
    }
  }
  if (!registry.includes(myCommitmentStr)) {
    registry = [...registry, myCommitmentStr];
  }

  const leaves = new Map<number, bigint>();
  for (let i = 0; i < registry.length; i++) {
    leaves.set(i, BigInt(registry[i]));
  }

  const { root } = buildSparseMerkleTree(
    (inputs) => poseidon(inputs),
    F,
    leaves,
    TREE_DEPTH,
  );

  return {
    root: root.toString(),
    commitment: commitment.toString(),
    anonymitySet: registry.length,
  };
}

/**
 * Verify a proof locally (for debugging / UI feedback).
 */
export async function verifyProofLocally(
  proof: Groth16Proof,
  publicSignals: string[],
): Promise<boolean> {
  const snarkjs = await import("snarkjs");
  const vkeyResponse = await fetch("/circuits/verification_key.json");
  if (!vkeyResponse.ok) throw new Error("Failed to load verification key");
  const vkey = await vkeyResponse.json();
  return snarkjs.groth16.verify(vkey, publicSignals, proof);
}
