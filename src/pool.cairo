#[starknet::contract]
pub mod VeilPool {
    use core::poseidon::poseidon_hash_span;
    use core::num::traits::Zero;

    use starknet::{
        ContractAddress, get_caller_address, get_contract_address,
        storage::{Map, StoragePointerReadAccess, StoragePointerWriteAccess, StoragePathEntry}
    };

    use openzeppelin_token::erc20::{ERC20ABIDispatcher, ERC20ABIDispatcherTrait};
    use openzeppelin_access::ownable::OwnableComponent;
    use openzeppelin_security::pausable::PausableComponent;

    use crate::interfaces::{
        IVeil, IComplianceManager, IGroth16VerifierBN254Dispatcher,
        IGroth16VerifierBN254DispatcherTrait,
    };

    // How many historical roots to keep for withdrawal validation
    const ROOT_HISTORY_SIZE: u32 = 30;

    // How many BN128 roots to keep (mirrors ROOT_HISTORY_SIZE)
    const BN128_ROOT_HISTORY_SIZE: u32 = 30;

    // Merkle tree depth (supports 2^20 = ~1M deposits)
    const TREE_DEPTH: u32 = 20;

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    component!(path: PausableComponent, storage: pausable, event: PausableEvent);

    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    #[abi(embed_v0)]
    impl PausableImpl = PausableComponent::PausableImpl<ContractState>;
    impl PausableInternalImpl = PausableComponent::InternalImpl<ContractState>;

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        Deposited: Deposited,
        Withdrawn: Withdrawn,
        WithdrawnWithProof: WithdrawnWithProof,
        RagequitExecuted: RagequitExecuted,
        ApprovedSetUpdated: ApprovedSetUpdated,
        BN128RootSubmitted: BN128RootSubmitted,
        OwnableEvent: OwnableComponent::Event,
        PausableEvent: PausableComponent::Event,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Deposited {
        #[key]
        pub commitment: felt252,
        pub bn128_commitment: u256,
        pub leaf_index: u32,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Withdrawn {
        #[key]
        pub nullifier_hash: felt252,
        pub recipient: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct RagequitExecuted {
        #[key]
        pub nullifier_hash: felt252,
        pub depositor: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct WithdrawnWithProof {
        #[key]
        pub nullifier_hash: u256,
        pub recipient: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct BN128RootSubmitted {
        pub root: u256,
        pub leaf_count: u32,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ApprovedSetUpdated {
        #[key]
        pub addr: ContractAddress,
        pub added: bool,
    }

    #[storage]
    struct Storage {
        // Pool config
        deposit_amount: u256,
        token_address: ERC20ABIDispatcher,

        // Incremental Merkle tree state
        next_index: u32,
        filled_subtrees: Map<u32, felt252>,
        roots: Map<u32, felt252>,
        current_root_index: u32,

        // Nullifier tracking
        nullifiers: Map<felt252, bool>,

        // Commitment tracking
        commitments: Map<felt252, bool>,

        // Compliance: approved set
        approved_addresses: Map<ContractAddress, bool>,

        // Ragequit: store depositor per commitment for emergency exit
        depositors: Map<felt252, ContractAddress>,

        // Groth16 proof verifier (Garaga)
        verifier_contract: IGroth16VerifierBN254Dispatcher,

        // BN128 dual-path: on-chain commitment storage + ring buffer of roots + nullifier tracking
        bn128_commitments: Map<u32, u256>,
        bn128_roots: Map<u32, u256>,
        bn128_root_index: u32,
        bn128_nullifiers: Map<u256, bool>,

        // Testnet mode: when true, register_for_demo() is available
        demo_mode: bool,

        // Ownable
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,

        // Pausable
        #[substorage(v0)]
        pausable: PausableComponent::Storage,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        token: ContractAddress,
        amount: u256,
        owner: ContractAddress,
        verifier: ContractAddress,
    ) {
        assert(!token.is_zero(), 'token address is zero');
        assert(!amount.is_zero(), 'deposit amount is zero');
        assert(!owner.is_zero(), 'owner address is zero');
        assert(!verifier.is_zero(), 'verifier address is zero');

        self.deposit_amount.write(amount);
        self.token_address.write(ERC20ABIDispatcher { contract_address: token });
        self
            .verifier_contract
            .write(IGroth16VerifierBN254Dispatcher { contract_address: verifier });
        self.ownable.initializer(owner);

        // Demo mode off by default (owner can enable for testnet)
        self.demo_mode.write(false);

        // Initialize incremental Merkle tree with zero values
        let mut current_zero = 0_felt252;
        let mut i: u32 = 0;
        while i < TREE_DEPTH {
            self.filled_subtrees.entry(i).write(current_zero);
            current_zero = hash_pair(current_zero, current_zero);
            i += 1;
        };

        // Set initial root
        self.roots.entry(0).write(current_zero);
    }

    #[abi(embed_v0)]
    impl VeilImpl of IVeil<ContractState> {
        fn deposit(ref self: ContractState, commitment: felt252, bn128_commitment: u256) {
            self.pausable.assert_not_paused();
            assert(!self.commitments.entry(commitment).read(), 'duplicate commitment');
            assert(bn128_commitment != 0.into(), 'bn128 commitment is zero');

            // Transfer tokens from depositor to pool
            let caller = get_caller_address();
            self
                .token_address
                .read()
                .transfer_from(caller, get_contract_address(), self.deposit_amount.read());

            // Insert commitment into incremental Merkle tree
            let leaf_index = self.next_index.read();
            assert(leaf_index < pow2(TREE_DEPTH), 'tree is full');

            let new_root = insert_leaf(ref self, commitment);

            // Track commitment and depositor
            self.commitments.entry(commitment).write(true);
            self.depositors.entry(commitment).write(caller);

            // Store BN128 commitment on-chain (indexed by deposit order)
            self.bn128_commitments.entry(leaf_index).write(bn128_commitment);

            // Store root in history
            let root_idx = (self.current_root_index.read() + 1) % ROOT_HISTORY_SIZE;
            self.current_root_index.write(root_idx);
            self.roots.entry(root_idx).write(new_root);

            let timestamp = starknet::get_block_timestamp();
            self.emit(Deposited { commitment, bn128_commitment, leaf_index, timestamp });
        }

        fn withdraw(
            ref self: ContractState,
            nullifier_hash: felt252,
            recipient: ContractAddress,
            root: felt252,
            proof: Span<felt252>,
        ) {
            self.pausable.assert_not_paused();

            // Double-spend prevention: each nullifier can only be used once
            assert(!self.nullifiers.entry(nullifier_hash).read(), 'already spent');

            // [FIX #1] Validate that root is in the pool's root history
            assert(is_known_root_internal(@self, root), 'unknown root');

            // ASP compliance: recipient must be in the approved set
            assert(self.approved_addresses.entry(recipient).read(), 'recipient not approved');

            // On-chain Groth16 verification via Garaga BN254 pairing engine.
            // The proof span contains full_proof_with_hints (proof + MSM/pairing hints).
            // The verifier returns Ok(public_inputs) where public_inputs = [root, nullifierHash].
            let verifier = self.verifier_contract.read();
            let result = verifier.verify_groth16_proof_bn254(proof);
            match result {
                Result::Ok(public_inputs) => {
                    // Verify the proof's public inputs match the claimed values.
                    // public_inputs[0] = Merkle root, public_inputs[1] = nullifier hash
                    assert(public_inputs.len() >= 2, 'invalid public inputs');
                    let proven_root: felt252 = (*public_inputs.at(0)).try_into().unwrap();
                    let proven_nullifier: felt252 = (*public_inputs.at(1)).try_into().unwrap();
                    assert(proven_root == root, 'root mismatch');
                    assert(proven_nullifier == nullifier_hash, 'nullifier mismatch');
                },
                Result::Err(_) => {
                    panic!("groth16 proof verification failed");
                },
            }

            // Mark nullifier as spent
            self.nullifiers.entry(nullifier_hash).write(true);

            // Transfer tokens to recipient
            self.token_address.read().transfer(recipient, self.deposit_amount.read());

            self.emit(Withdrawn { nullifier_hash, recipient });
        }

        fn ragequit(ref self: ContractState, nullifier: felt252, secret: felt252, value: u256) {
            self.pausable.assert_not_paused();

            // Recompute the commitment from the provided preimage
            let nullifier_hash = compute_nullifier_hash(nullifier);
            let precommitment = compute_precommitment(nullifier, secret);
            let commitment = compute_commitment(value, precommitment);

            // Verify this commitment exists
            assert(self.commitments.entry(commitment).read(), 'unknown commitment');

            // Verify caller is the original depositor
            let caller = get_caller_address();
            let depositor = self.depositors.entry(commitment).read();
            assert(caller == depositor, 'not the depositor');

            // Verify nullifier not already spent
            assert(!self.nullifiers.entry(nullifier_hash).read(), 'already spent');

            // Mark nullifier as spent
            self.nullifiers.entry(nullifier_hash).write(true);

            // Return tokens to depositor (no privacy — this is an emergency exit)
            self.token_address.read().transfer(caller, self.deposit_amount.read());

            self.emit(RagequitExecuted { nullifier_hash, depositor: caller });
        }

        fn token(self: @ContractState) -> ContractAddress {
            self.token_address.read().contract_address
        }

        fn deposit_amount(self: @ContractState) -> u256 {
            self.deposit_amount.read()
        }

        fn is_known_root(self: @ContractState, root: felt252) -> bool {
            is_known_root_internal(self, root)
        }

        fn is_spent(self: @ContractState, nullifier_hash: felt252) -> bool {
            self.nullifiers.entry(nullifier_hash).read()
        }

        fn commitment_count(self: @ContractState) -> u32 {
            self.next_index.read()
        }
    }

    // Public self-registration for testnet — lets users test the full flow
    // Gated by demo_mode flag; owner can disable for production
    #[external(v0)]
    fn register_for_demo(ref self: ContractState) {
        assert(self.demo_mode.read(), 'demo mode disabled');
        let caller = get_caller_address();
        self.approved_addresses.entry(caller).write(true);
        self.emit(ApprovedSetUpdated { addr: caller, added: true });
    }

    // Owner can enable/disable demo mode
    #[external(v0)]
    fn set_demo_mode(ref self: ContractState, enabled: bool) {
        self.ownable.assert_only_owner();
        self.demo_mode.write(enabled);
    }

    // View: check if demo mode is active
    #[external(v0)]
    fn is_demo_mode(self: @ContractState) -> bool {
        self.demo_mode.read()
    }

    // Submit BN128 Poseidon Merkle root (computed off-chain from BN128 field)
    // leaf_count must match the on-chain commitment_count to prevent fabricated trees
    #[external(v0)]
    fn submit_bn128_root(ref self: ContractState, root: u256, leaf_count: u32) {
        // In demo mode anyone can submit; otherwise owner-only
        if !self.demo_mode.read() {
            self.ownable.assert_only_owner();
        }
        assert(root != 0.into(), 'root is zero');
        assert(leaf_count == self.next_index.read(), 'leaf count mismatch');
        let idx = (self.bn128_root_index.read() + 1) % BN128_ROOT_HISTORY_SIZE;
        self.bn128_root_index.write(idx);
        self.bn128_roots.entry(idx).write(root);
        self.emit(BN128RootSubmitted { root, leaf_count });
    }

    // Withdraw via Garaga-verified Groth16 proof against BN128 Merkle root
    // This is the dual-path withdrawal: BN128 Poseidon (off-chain circuit) + Garaga (on-chain verify)
    #[external(v0)]
    fn withdraw_with_proof(
        ref self: ContractState,
        nullifier_hash: u256,
        recipient: ContractAddress,
        proof: Span<felt252>,
    ) {
        self.pausable.assert_not_paused();

        // Double-spend prevention
        assert(!self.bn128_nullifiers.entry(nullifier_hash).read(), 'already spent');

        // ASP compliance: recipient must be approved (skipped in demo mode)
        if !self.demo_mode.read() {
            assert(self.approved_addresses.entry(recipient).read(), 'recipient not approved');
        }

        // On-chain Groth16 verification via Garaga BN254 pairing engine
        let verifier = self.verifier_contract.read();
        let result = verifier.verify_groth16_proof_bn254(proof);
        match result {
            Result::Ok(public_inputs) => {
                // public_inputs: [root, nullifierHash] as u256
                assert(public_inputs.len() >= 2, 'invalid public inputs');
                let proven_root: u256 = *public_inputs.at(0);
                let proven_nullifier: u256 = *public_inputs.at(1);
                assert(is_known_bn128_root(@self, proven_root), 'unknown bn128 root');
                assert(proven_nullifier == nullifier_hash, 'nullifier mismatch');
            },
            Result::Err(_) => {
                panic!("groth16 proof verification failed");
            },
        }

        // Mark nullifier as spent
        self.bn128_nullifiers.entry(nullifier_hash).write(true);

        // Transfer tokens to recipient
        self.token_address.read().transfer(recipient, self.deposit_amount.read());

        self.emit(WithdrawnWithProof { nullifier_hash, recipient });
    }

    // View: get a BN128 commitment by deposit index
    #[external(v0)]
    fn get_bn128_commitment(self: @ContractState, index: u32) -> u256 {
        self.bn128_commitments.entry(index).read()
    }

    // View: check if a BN128 nullifier has been spent
    #[external(v0)]
    fn is_bn128_spent(self: @ContractState, nullifier_hash: u256) -> bool {
        self.bn128_nullifiers.entry(nullifier_hash).read()
    }

    // View: get the current BN128 root
    #[external(v0)]
    fn get_bn128_root(self: @ContractState) -> u256 {
        self.bn128_roots.entry(self.bn128_root_index.read()).read()
    }

    // [FIX #5] Owner-only pause/unpause for emergency stops
    #[external(v0)]
    fn pause(ref self: ContractState) {
        self.ownable.assert_only_owner();
        self.pausable.pause();
    }

    #[external(v0)]
    fn unpause(ref self: ContractState) {
        self.ownable.assert_only_owner();
        self.pausable.unpause();
    }

    #[abi(embed_v0)]
    impl ComplianceImpl of IComplianceManager<ContractState> {
        fn add_to_approved_set(ref self: ContractState, addr: ContractAddress) {
            self.ownable.assert_only_owner();
            self.approved_addresses.entry(addr).write(true);
            self.emit(ApprovedSetUpdated { addr, added: true });
        }

        fn remove_from_approved_set(ref self: ContractState, addr: ContractAddress) {
            self.ownable.assert_only_owner();
            self.approved_addresses.entry(addr).write(false);
            self.emit(ApprovedSetUpdated { addr, added: false });
        }

        fn is_approved(self: @ContractState, addr: ContractAddress) -> bool {
            self.approved_addresses.entry(addr).read()
        }
    }

    // --- Poseidon-based commitment scheme ---
    // Three-stage: nullifierHash -> precommitment -> commitment
    // Three-stage scheme for stronger binding and compliance compatibility

    fn compute_nullifier_hash(nullifier: felt252) -> felt252 {
        poseidon_hash_span(array![nullifier].span())
    }

    fn compute_precommitment(nullifier: felt252, secret: felt252) -> felt252 {
        poseidon_hash_span(array![nullifier, secret].span())
    }

    fn compute_commitment(value: u256, precommitment: felt252) -> felt252 {
        let value_felt: felt252 = value.try_into().expect('value too large');
        poseidon_hash_span(array![value_felt, precommitment].span())
    }

    // --- Incremental Merkle tree ---

    fn hash_pair(left: felt252, right: felt252) -> felt252 {
        poseidon_hash_span(array![left, right].span())
    }

    fn insert_leaf(ref self: ContractState, leaf: felt252) -> felt252 {
        let mut current_index = self.next_index.read();
        let mut current_hash = leaf;
        let mut i: u32 = 0;

        while i < TREE_DEPTH {
            if current_index % 2 == 0 {
                // Left child: pair with zero
                let zero = self.filled_subtrees.entry(i).read();
                self.filled_subtrees.entry(i).write(current_hash);
                current_hash = hash_pair(current_hash, zero);
            } else {
                // Right child: pair with filled subtree
                let left = self.filled_subtrees.entry(i).read();
                current_hash = hash_pair(left, current_hash);
            };
            current_index = current_index / 2;
            i += 1;
        };

        self.next_index.write(self.next_index.read() + 1);
        current_hash
    }

    fn is_known_root_internal(self: @ContractState, root: felt252) -> bool {
        if root == 0 {
            return false;
        }

        let current = self.current_root_index.read();
        let mut i: u32 = 0;
        let mut found = false;

        while i < ROOT_HISTORY_SIZE {
            let idx = if current >= i {
                current - i
            } else {
                ROOT_HISTORY_SIZE - (i - current)
            };
            if self.roots.entry(idx).read() == root {
                found = true;
                break;
            };
            i += 1;
        };

        found
    }

    fn is_known_bn128_root(self: @ContractState, root: u256) -> bool {
        if root == 0.into() {
            return false;
        }

        let current = self.bn128_root_index.read();
        let mut i: u32 = 0;
        let mut found = false;

        while i < BN128_ROOT_HISTORY_SIZE {
            let idx = if current >= i {
                current - i
            } else {
                BN128_ROOT_HISTORY_SIZE - (i - current)
            };
            if self.bn128_roots.entry(idx).read() == root {
                found = true;
                break;
            };
            i += 1;
        };

        found
    }

    fn pow2(exp: u32) -> u32 {
        let mut result: u32 = 1;
        let mut i: u32 = 0;
        while i < exp {
            result = result * 2;
            i += 1;
        };
        result
    }
}
