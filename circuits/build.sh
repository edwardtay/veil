#!/bin/bash
set -e

echo "=== Veil ZK Circuit Build ==="

# 1. Compile circuit
echo "[1/6] Compiling Circom circuit..."
circom withdraw.circom --r1cs --wasm --sym -o build/ -l node_modules

# 2. Powers of Tau ceremony (dev only — use existing ptau for production)
echo "[2/6] Running trusted setup (Powers of Tau)..."
snarkjs powersoftau new bn128 16 build/pot16_0000.ptau -v
snarkjs powersoftau contribute build/pot16_0000.ptau build/pot16_0001.ptau --name="Veil dev ceremony" -v -e="random entropy for dev"
snarkjs powersoftau prepare phase2 build/pot16_0001.ptau build/pot16_final.ptau -v

# 3. Circuit-specific setup
echo "[3/6] Generating zkey..."
snarkjs groth16 setup build/withdraw.r1cs build/pot16_final.ptau build/withdraw_0000.zkey
snarkjs zkey contribute build/withdraw_0000.zkey build/withdraw_final.zkey --name="Veil contributor" -v -e="more random entropy"

# 4. Export verification key
echo "[4/6] Exporting verification key..."
snarkjs zkey export verificationkey build/withdraw_final.zkey build/verification_key.json

echo "[5/6] Done! Artifacts in build/:"
echo "  - build/withdraw.r1cs"
echo "  - build/withdraw_js/withdraw.wasm"
echo "  - build/withdraw_final.zkey"
echo "  - build/verification_key.json"

echo ""
echo "[6/6] Next steps:"
echo "  pip install garaga"
echo "  garaga gen --system groth16 --vk build/verification_key.json"
echo "  Then copy generated verifier .cairo files into src/"
