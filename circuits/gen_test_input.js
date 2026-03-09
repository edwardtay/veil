const { buildPoseidon } = require("circomlibjs");
const crypto = require("crypto");

async function main() {
  const poseidon = await buildPoseidon();
  const F = poseidon.F;

  // Generate random secrets
  const nullifier = BigInt("123456789");
  const secret = BigInt("987654321");
  const value = BigInt("1000000000000000000000"); // 1000 vUSD (18 decimals)

  // Compute 3-stage commitment scheme (matches pool.cairo)
  // nullifierHash = Poseidon(nullifier)
  const nullifierHash = F.toObject(poseidon([nullifier]));

  // precommitment = Poseidon(nullifier, secret)
  const precommitment = F.toObject(poseidon([nullifier, secret]));

  // commitment = Poseidon(value, precommitment)
  const commitment = F.toObject(poseidon([value, precommitment]));

  // Build a simple Merkle tree with this single leaf
  // All other leaves are 0, so we just hash up with zeros
  const DEPTH = 20;
  const pathElements = [];
  const pathIndices = [];

  let currentHash = commitment;
  for (let i = 0; i < DEPTH; i++) {
    pathElements.push("0");
    pathIndices.push(0);
    // hash(currentHash, 0) since we're always the left child
    currentHash = F.toObject(poseidon([currentHash, BigInt(0)]));
  }

  const root = currentHash;

  const input = {
    root: root.toString(),
    nullifierHash: nullifierHash.toString(),
    nullifier: nullifier.toString(),
    secret: secret.toString(),
    value: value.toString(),
    pathElements,
    pathIndices,
  };

  console.log(JSON.stringify(input, null, 2));
}

main().catch(console.error);
