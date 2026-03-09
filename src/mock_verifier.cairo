/// Mock Groth16 verifier for testing — always returns Ok with the inputs passed to it.
/// In real deployment, the actual Garaga verifier is used.
#[starknet::contract]
pub mod MockGroth16Verifier {
    #[storage]
    struct Storage {}

    #[abi(embed_v0)]
    impl MockVerifier of crate::interfaces::IGroth16VerifierBN254<ContractState> {
        fn verify_groth16_proof_bn254(
            self: @ContractState, full_proof_with_hints: Span<felt252>,
        ) -> Result<Span<u256>, felt252> {
            // The mock verifier extracts the first 4 felts as two u256 public inputs
            // (root_low, root_high, nullifier_low, nullifier_high) and returns them.
            // This allows tests to control what the "verified" public inputs are.
            assert(full_proof_with_hints.len() >= 4, 'need 4 felts for mock');
            let root_low: u128 = (*full_proof_with_hints.at(0)).try_into().unwrap();
            let root_high: u128 = (*full_proof_with_hints.at(1)).try_into().unwrap();
            let null_low: u128 = (*full_proof_with_hints.at(2)).try_into().unwrap();
            let null_high: u128 = (*full_proof_with_hints.at(3)).try_into().unwrap();

            let root = u256 { low: root_low, high: root_high };
            let nullifier = u256 { low: null_low, high: null_high };

            let mut result = array![root, nullifier];
            Result::Ok(result.span())
        }
    }
}
