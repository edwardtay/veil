pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";

// Veil 3-stage commitment scheme:
//   nullifierHash  = Poseidon(nullifier)
//   precommitment  = Poseidon(nullifier, secret)
//   commitment     = Poseidon(value, precommitment)
//
// Merkle membership proof over an incremental Poseidon Merkle tree (depth 20).

template MerkleTreeChecker(levels) {
    signal input leaf;
    signal input pathElements[levels];
    signal input pathIndices[levels]; // 0 = leaf is left child, 1 = leaf is right child
    signal output root;

    signal hashes[levels + 1];
    hashes[0] <== leaf;

    component hashers[levels];
    for (var i = 0; i < levels; i++) {
        hashers[i] = Poseidon(2);
        // If pathIndices[i] == 0: hash(current, sibling)
        // If pathIndices[i] == 1: hash(sibling, current)
        hashers[i].inputs[0] <== hashes[i] + pathIndices[i] * (pathElements[i] - hashes[i]);
        hashers[i].inputs[1] <== pathElements[i] + pathIndices[i] * (hashes[i] - pathElements[i]);
        hashes[i + 1] <== hashers[i].out;
    }

    root <== hashes[levels];
}

template VeilWithdraw(levels) {
    // --- Public inputs ---
    signal input root;              // Merkle root (known on-chain)
    signal input nullifierHash;     // Poseidon(nullifier) — revealed for double-spend prevention

    // --- Private inputs ---
    signal input nullifier;         // Random secret #1
    signal input secret;            // Random secret #2
    signal input value;             // Deposit amount (encoded as felt252)
    signal input pathElements[levels];
    signal input pathIndices[levels];

    // 1. Verify nullifierHash == Poseidon(nullifier)
    component nullHasher = Poseidon(1);
    nullHasher.inputs[0] <== nullifier;
    nullHasher.out === nullifierHash;

    // 2. Compute precommitment = Poseidon(nullifier, secret)
    component precommHasher = Poseidon(2);
    precommHasher.inputs[0] <== nullifier;
    precommHasher.inputs[1] <== secret;

    // 3. Compute commitment = Poseidon(value, precommitment)
    component commitHasher = Poseidon(2);
    commitHasher.inputs[0] <== value;
    commitHasher.inputs[1] <== precommHasher.out;

    // 4. Verify Merkle membership: commitment is a leaf in the tree with given root
    component tree = MerkleTreeChecker(levels);
    tree.leaf <== commitHasher.out;
    tree.pathElements <== pathElements;
    tree.pathIndices <== pathIndices;

    // 5. Constrain computed root == public root
    tree.root === root;
}

// 20-level tree supports 2^20 = ~1M deposits
component main {public [root, nullifierHash]} = VeilWithdraw(20);
