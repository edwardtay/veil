use core::poseidon::poseidon_hash_span;

use starknet::ContractAddress;
use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait, spy_events, EventSpyAssertionsTrait,
    start_cheat_caller_address, stop_cheat_caller_address,
};

use openzeppelin_token::erc20::{ERC20ABIDispatcher, ERC20ABIDispatcherTrait};

use veil::interfaces::{
    IVeilDispatcher, IVeilDispatcherTrait, IComplianceManagerDispatcher,
    IComplianceManagerDispatcherTrait,
};
use veil::pool::VeilPool;

fn addr(v: felt252) -> ContractAddress {
    v.try_into().unwrap()
}

fn deploy_mock_erc20(recipient: ContractAddress) -> ContractAddress {
    let erc20_class = declare("MockERC20").unwrap().contract_class();
    let mut args = array![];
    let supply: u256 = 1_000_000;
    supply.serialize(ref args);
    recipient.serialize(ref args);
    let (contract_addr, _) = erc20_class.deploy(@args).unwrap();
    contract_addr
}

fn deploy_mock_verifier() -> ContractAddress {
    let class = declare("MockGroth16Verifier").unwrap().contract_class();
    let (contract_addr, _) = class.deploy(@array![]).unwrap();
    contract_addr
}

fn deploy_veil(
    token: ContractAddress, amount: u256, owner: ContractAddress,
) -> ContractAddress {
    let contract = declare("VeilPool").unwrap().contract_class();
    let verifier = deploy_mock_verifier();
    let mut args = array![];
    token.serialize(ref args);
    amount.serialize(ref args);
    owner.serialize(ref args);
    verifier.serialize(ref args);
    let (contract_addr, _) = contract.deploy(@args).unwrap();
    contract_addr
}

fn make_commitment(value: u256, nullifier: felt252, secret: felt252) -> (felt252, felt252) {
    let nullifier_hash = poseidon_hash_span(array![nullifier].span());
    let precommitment = poseidon_hash_span(array![nullifier, secret].span());
    let value_felt: felt252 = value.try_into().unwrap();
    let commitment = poseidon_hash_span(array![value_felt, precommitment].span());
    (commitment, nullifier_hash)
}

#[test]
fn test_deploy_pool() {
    let owner = addr(0x1);
    let token = deploy_mock_erc20(owner);
    let amount: u256 = 1000;

    let pool_addr = deploy_veil(token, amount, owner);
    let pool = IVeilDispatcher { contract_address: pool_addr };

    assert(pool.token() == token, 'wrong token');
    assert(pool.deposit_amount() == amount, 'wrong amount');
    assert(pool.commitment_count() == 0, 'should be empty');
}

#[test]
fn test_deposit() {
    let owner = addr(0x1);
    let token = deploy_mock_erc20(owner);
    let amount: u256 = 1000;
    let pool_addr = deploy_veil(token, amount, owner);
    let pool = IVeilDispatcher { contract_address: pool_addr };

    let erc20 = ERC20ABIDispatcher { contract_address: token };
    start_cheat_caller_address(token, owner);
    erc20.approve(pool_addr, amount);
    stop_cheat_caller_address(token);

    let nullifier: felt252 = 42;
    let secret: felt252 = 99;
    let (commitment, _) = make_commitment(amount, nullifier, secret);

    let mut spy = spy_events();

    start_cheat_caller_address(pool_addr, owner);
    pool.deposit(commitment, 0xABCD_u256);
    stop_cheat_caller_address(pool_addr);

    assert(pool.commitment_count() == 1, 'count should be 1');

    spy
        .assert_emitted(
            @array![
                (
                    pool_addr,
                    VeilPool::Event::Deposited(
                        VeilPool::Deposited { commitment, bn128_commitment: 0xABCD_u256, leaf_index: 0, timestamp: 0 },
                    ),
                ),
            ],
        );
}

#[test]
#[should_panic(expected: 'duplicate commitment')]
fn test_duplicate_deposit_fails() {
    let owner = addr(0x1);
    let token = deploy_mock_erc20(owner);
    let amount: u256 = 1000;
    let pool_addr = deploy_veil(token, amount, owner);
    let pool = IVeilDispatcher { contract_address: pool_addr };

    let erc20 = ERC20ABIDispatcher { contract_address: token };
    start_cheat_caller_address(token, owner);
    erc20.approve(pool_addr, amount * 2);
    stop_cheat_caller_address(token);

    let (commitment, _) = make_commitment(amount, 42, 99);

    start_cheat_caller_address(pool_addr, owner);
    pool.deposit(commitment, 0xABCD_u256);
    pool.deposit(commitment, 0xABCD_u256);
    stop_cheat_caller_address(pool_addr);
}

#[test]
fn test_ragequit() {
    let owner = addr(0x1);
    let token = deploy_mock_erc20(owner);
    let amount: u256 = 1000;
    let pool_addr = deploy_veil(token, amount, owner);
    let pool = IVeilDispatcher { contract_address: pool_addr };

    let erc20 = ERC20ABIDispatcher { contract_address: token };
    start_cheat_caller_address(token, owner);
    erc20.approve(pool_addr, amount);
    stop_cheat_caller_address(token);

    let nullifier: felt252 = 42;
    let secret: felt252 = 99;
    let (commitment, _) = make_commitment(amount, nullifier, secret);

    start_cheat_caller_address(pool_addr, owner);
    pool.deposit(commitment, 0xABCD_u256);
    pool.ragequit(nullifier, secret, amount);
    stop_cheat_caller_address(pool_addr);

    let nullifier_hash = poseidon_hash_span(array![nullifier].span());
    assert(pool.is_spent(nullifier_hash), 'should be spent');
}

#[test]
#[should_panic(expected: 'not the depositor')]
fn test_ragequit_wrong_caller() {
    let owner = addr(0x1);
    let attacker = addr(0x999);
    let token = deploy_mock_erc20(owner);
    let amount: u256 = 1000;
    let pool_addr = deploy_veil(token, amount, owner);
    let pool = IVeilDispatcher { contract_address: pool_addr };

    let erc20 = ERC20ABIDispatcher { contract_address: token };
    start_cheat_caller_address(token, owner);
    erc20.approve(pool_addr, amount);
    stop_cheat_caller_address(token);

    let nullifier: felt252 = 42;
    let secret: felt252 = 99;
    let (commitment, _) = make_commitment(amount, nullifier, secret);

    start_cheat_caller_address(pool_addr, owner);
    pool.deposit(commitment, 0xABCD_u256);
    stop_cheat_caller_address(pool_addr);

    start_cheat_caller_address(pool_addr, attacker);
    pool.ragequit(nullifier, secret, amount);
    stop_cheat_caller_address(pool_addr);
}

#[test]
fn test_compliance_approved_set() {
    let owner = addr(0x1);
    let user = addr(0x2);
    let token = deploy_mock_erc20(owner);
    let amount: u256 = 1000;
    let pool_addr = deploy_veil(token, amount, owner);
    let compliance = IComplianceManagerDispatcher { contract_address: pool_addr };

    start_cheat_caller_address(pool_addr, owner);
    compliance.add_to_approved_set(user);
    stop_cheat_caller_address(pool_addr);

    assert(compliance.is_approved(user), 'should be approved');

    start_cheat_caller_address(pool_addr, owner);
    compliance.remove_from_approved_set(user);
    stop_cheat_caller_address(pool_addr);

    assert(!compliance.is_approved(user), 'should not be approved');
}

// --- Regression test for Fix #1: unknown root rejection ---

#[test]
#[should_panic(expected: 'unknown root')]
fn test_withdraw_unknown_root_fails() {
    let owner = addr(0x1);
    let recipient = addr(0x2);
    let token = deploy_mock_erc20(owner);
    let amount: u256 = 1000;
    let pool_addr = deploy_veil(token, amount, owner);
    let pool = IVeilDispatcher { contract_address: pool_addr };
    let compliance = IComplianceManagerDispatcher { contract_address: pool_addr };

    let erc20 = ERC20ABIDispatcher { contract_address: token };
    start_cheat_caller_address(token, owner);
    erc20.approve(pool_addr, amount);
    stop_cheat_caller_address(token);

    // Deposit a commitment
    let (commitment, _) = make_commitment(amount, 42, 99);
    start_cheat_caller_address(pool_addr, owner);
    pool.deposit(commitment, 0xABCD_u256);
    stop_cheat_caller_address(pool_addr);

    // Approve recipient for compliance
    start_cheat_caller_address(pool_addr, owner);
    compliance.add_to_approved_set(recipient);
    stop_cheat_caller_address(pool_addr);

    // Attempt withdraw with a fake root NOT in history.
    // The mock verifier will return public_inputs matching our fake root/nullifier,
    // but the pool should reject because the root is unknown.
    let fake_root: felt252 = 0xDEAD;
    let fake_nullifier: felt252 = 0xBEEF;

    // Build mock proof: [root_low, root_high, null_low, null_high]
    let mut proof: Array<felt252> = array![fake_root, 0, fake_nullifier, 0];

    start_cheat_caller_address(pool_addr, owner);
    pool.withdraw(fake_nullifier, recipient, fake_root, proof.span());
    stop_cheat_caller_address(pool_addr);
}
