use starknet::ContractAddress;

#[starknet::interface]
pub trait IVeil<TContractState> {
    // Deposit a fixed amount of tokens into the pool
    fn deposit(ref self: TContractState, commitment: felt252, bn128_commitment: u256);

    // Withdraw tokens by providing a valid proof
    fn withdraw(
        ref self: TContractState,
        nullifier_hash: felt252,
        recipient: ContractAddress,
        root: felt252,
        proof: Span<felt252>,
    );

    // Emergency exit without proof (forfeits privacy, reveals deposit)
    fn ragequit(ref self: TContractState, nullifier: felt252, secret: felt252, value: u256);

    // View functions
    fn token(self: @TContractState) -> ContractAddress;
    fn deposit_amount(self: @TContractState) -> u256;
    fn is_known_root(self: @TContractState, root: felt252) -> bool;
    fn is_spent(self: @TContractState, nullifier_hash: felt252) -> bool;
    fn commitment_count(self: @TContractState) -> u32;
}

#[starknet::interface]
pub trait IGroth16VerifierBN254<TContractState> {
    fn verify_groth16_proof_bn254(
        self: @TContractState, full_proof_with_hints: Span<felt252>,
    ) -> Result<Span<u256>, felt252>;
}

#[starknet::interface]
pub trait IComplianceManager<TContractState> {
    // Add an address to the approved set
    fn add_to_approved_set(ref self: TContractState, addr: ContractAddress);

    // Remove an address from the approved set
    fn remove_from_approved_set(ref self: TContractState, addr: ContractAddress);

    // Check if an address is in the approved set
    fn is_approved(self: @TContractState, addr: ContractAddress) -> bool;
}
