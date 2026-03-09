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
    let verifier_class = declare("MockGroth16Verifier").unwrap().contract_class();
    let args = array![];
    let (contract_addr, _) = verifier_class.deploy(@args).unwrap();
    contract_addr
}

fn deploy_pool_with_mock_verifier(
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

/// Helper: build mock proof calldata that the MockGroth16Verifier will decode.
/// The mock verifier reads first 4 felts as (root_low, root_high, null_low, null_high).
fn mock_proof_calldata(root: u256, nullifier_hash: u256) -> Array<felt252> {
    let root_low: felt252 = root.low.into();
    let root_high: felt252 = root.high.into();
    let null_low: felt252 = nullifier_hash.low.into();
    let null_high: felt252 = nullifier_hash.high.into();
    array![root_low, root_high, null_low, null_high]
}

// ---- Tests ----

#[test]
fn test_submit_bn128_root() {
    let owner = addr(0x1);
    let token = deploy_mock_erc20(owner);
    let amount: u256 = 1000;
    let pool_addr = deploy_pool_with_mock_verifier(token, amount, owner);

    let mut spy = spy_events();

    let root: u256 = 0x123456789ABCDEF;
    let leaf_count: u32 = 0; // no deposits yet

    start_cheat_caller_address(pool_addr, owner);
    let mut calldata = array![];
    root.serialize(ref calldata);
    leaf_count.serialize(ref calldata);
    starknet::syscalls::call_contract_syscall(pool_addr, selector!("submit_bn128_root"), calldata.span()).unwrap();
    stop_cheat_caller_address(pool_addr);

    // Verify root was stored
    let mut empty = array![];
    let result = starknet::syscalls::call_contract_syscall(pool_addr, selector!("get_bn128_root"), empty.span()).unwrap();
    let mut result_span = result;
    let stored_root: u256 = Serde::deserialize(ref result_span).unwrap();
    assert(stored_root == root, 'root not stored');

    spy
        .assert_emitted(
            @array![
                (
                    pool_addr,
                    VeilPool::Event::BN128RootSubmitted(
                        VeilPool::BN128RootSubmitted { root, leaf_count: 0 },
                    ),
                ),
            ],
        );
}

#[test]
fn test_submit_bn128_root_not_owner_fails() {
    let owner = addr(0x1);
    let attacker = addr(0x999);
    let token = deploy_mock_erc20(owner);
    let amount: u256 = 1000;
    let pool_addr = deploy_pool_with_mock_verifier(token, amount, owner);
    let compliance = IComplianceManagerDispatcher { contract_address: pool_addr };

    let root: u256 = 0x123456789ABCDEF;

    // Non-owner cannot submit root, even if approved via ASP set
    start_cheat_caller_address(pool_addr, owner);
    compliance.add_to_approved_set(attacker);
    stop_cheat_caller_address(pool_addr);

    start_cheat_caller_address(pool_addr, attacker);
    let mut calldata = array![];
    root.serialize(ref calldata);
    let leaf_count: u32 = 0;
    leaf_count.serialize(ref calldata);
    let result = starknet::syscalls::call_contract_syscall(pool_addr, selector!("submit_bn128_root"), calldata.span());
    stop_cheat_caller_address(pool_addr);

    assert(result.is_err(), 'should fail for non-owner');
}

#[test]
fn test_register_for_demo() {
    let owner = addr(0x1);
    let user = addr(0x2);
    let token = deploy_mock_erc20(owner);
    let amount: u256 = 1000;
    let pool_addr = deploy_pool_with_mock_verifier(token, amount, owner);

    let compliance = IComplianceManagerDispatcher { contract_address: pool_addr };

    // User is not approved initially
    assert(!compliance.is_approved(user), 'should not be approved');

    // Demo mode is off by default — owner must enable it
    start_cheat_caller_address(pool_addr, owner);
    let mut dm_calldata = array![];
    true.serialize(ref dm_calldata);
    starknet::syscalls::call_contract_syscall(pool_addr, selector!("set_demo_mode"), dm_calldata.span()).unwrap();
    stop_cheat_caller_address(pool_addr);

    // User self-registers (now that demo mode is on)
    start_cheat_caller_address(pool_addr, user);
    let empty = array![];
    starknet::syscalls::call_contract_syscall(pool_addr, selector!("register_for_demo"), empty.span()).unwrap();
    stop_cheat_caller_address(pool_addr);

    // Now approved
    assert(compliance.is_approved(user), 'should be approved');
}

#[test]
fn test_withdraw_with_proof_success() {
    let owner = addr(0x1);
    let depositor = addr(0x2);
    let recipient = addr(0x3);
    let token = deploy_mock_erc20(depositor);
    let amount: u256 = 1000;
    let pool_addr = deploy_pool_with_mock_verifier(token, amount, owner);

    let erc20 = ERC20ABIDispatcher { contract_address: token };
    let pool = IVeilDispatcher { contract_address: pool_addr };
    let compliance = IComplianceManagerDispatcher { contract_address: pool_addr };

    // Depositor approves and deposits
    start_cheat_caller_address(token, depositor);
    erc20.approve(pool_addr, amount);
    stop_cheat_caller_address(token);

    start_cheat_caller_address(pool_addr, depositor);
    pool.deposit(0x1234, 0xB01_u256); // arbitrary commitment
    stop_cheat_caller_address(pool_addr);

    // Owner approves recipient and self via ASP
    start_cheat_caller_address(pool_addr, owner);
    compliance.add_to_approved_set(recipient);
    stop_cheat_caller_address(pool_addr);

    // Approved owner submits BN128 root (1 deposit)
    let bn128_root: u256 = 0xDEADBEEF;
    start_cheat_caller_address(pool_addr, owner);
    let mut root_calldata = array![];
    bn128_root.serialize(ref root_calldata);
    let leaf_count: u32 = 1;
    leaf_count.serialize(ref root_calldata);
    starknet::syscalls::call_contract_syscall(pool_addr, selector!("submit_bn128_root"), root_calldata.span()).unwrap();
    stop_cheat_caller_address(pool_addr);

    // Prepare mock proof: the MockGroth16Verifier returns [root, nullifier_hash] from the first 4 felts
    let nullifier_hash: u256 = 0xCAFEBABE;
    let proof = mock_proof_calldata(bn128_root, nullifier_hash);

    let mut spy = spy_events();

    // Anyone can call withdraw_with_proof
    start_cheat_caller_address(pool_addr, depositor);
    let mut withdraw_calldata = array![];
    nullifier_hash.serialize(ref withdraw_calldata);
    recipient.serialize(ref withdraw_calldata);
    proof.serialize(ref withdraw_calldata);
    starknet::syscalls::call_contract_syscall(pool_addr, selector!("withdraw_with_proof"), withdraw_calldata.span()).unwrap();
    stop_cheat_caller_address(pool_addr);

    // Verify recipient received tokens
    assert(erc20.balance_of(recipient) == amount, 'recipient should have tokens');

    // Verify nullifier is now spent
    let mut spent_calldata = array![];
    nullifier_hash.serialize(ref spent_calldata);
    let result = starknet::syscalls::call_contract_syscall(pool_addr, selector!("is_bn128_spent"), spent_calldata.span()).unwrap();
    let mut result_span = result;
    let is_spent: bool = Serde::deserialize(ref result_span).unwrap();
    assert(is_spent, 'nullifier should be spent');

    // Verify event
    spy
        .assert_emitted(
            @array![
                (
                    pool_addr,
                    VeilPool::Event::WithdrawnWithProof(
                        VeilPool::WithdrawnWithProof { nullifier_hash, recipient },
                    ),
                ),
            ],
        );
}

#[test]
fn test_withdraw_with_proof_double_spend() {
    let owner = addr(0x1);
    let depositor = addr(0x2);
    let recipient = addr(0x3);
    let token = deploy_mock_erc20(depositor);
    let amount: u256 = 1000;
    let pool_addr = deploy_pool_with_mock_verifier(token, amount, owner);

    let erc20 = ERC20ABIDispatcher { contract_address: token };
    let pool = IVeilDispatcher { contract_address: pool_addr };
    let compliance = IComplianceManagerDispatcher { contract_address: pool_addr };

    // Depositor approves and makes TWO deposits to fund the pool
    start_cheat_caller_address(token, depositor);
    erc20.approve(pool_addr, amount * 2);
    stop_cheat_caller_address(token);

    start_cheat_caller_address(pool_addr, depositor);
    pool.deposit(0x1111, 0xB02_u256);
    pool.deposit(0x2222, 0xB03_u256);
    stop_cheat_caller_address(pool_addr);

    // Owner approves recipient, self, and submits root (2 deposits)
    start_cheat_caller_address(pool_addr, owner);
    compliance.add_to_approved_set(recipient);
    let mut root_calldata = array![];
    let bn128_root: u256 = 0xDEADBEEF;
    bn128_root.serialize(ref root_calldata);
    let leaf_count: u32 = 2;
    leaf_count.serialize(ref root_calldata);
    starknet::syscalls::call_contract_syscall(pool_addr, selector!("submit_bn128_root"), root_calldata.span()).unwrap();
    stop_cheat_caller_address(pool_addr);

    let nullifier_hash: u256 = 0xCAFEBABE;
    let proof = mock_proof_calldata(bn128_root, nullifier_hash);

    // First withdrawal succeeds
    start_cheat_caller_address(pool_addr, depositor);
    let mut calldata1 = array![];
    nullifier_hash.serialize(ref calldata1);
    recipient.serialize(ref calldata1);
    proof.serialize(ref calldata1);
    starknet::syscalls::call_contract_syscall(pool_addr, selector!("withdraw_with_proof"), calldata1.span()).unwrap();
    stop_cheat_caller_address(pool_addr);

    // Second withdrawal with same nullifier should fail
    let proof2 = mock_proof_calldata(bn128_root, nullifier_hash);
    start_cheat_caller_address(pool_addr, depositor);
    let mut calldata2 = array![];
    nullifier_hash.serialize(ref calldata2);
    recipient.serialize(ref calldata2);
    proof2.serialize(ref calldata2);
    let result = starknet::syscalls::call_contract_syscall(pool_addr, selector!("withdraw_with_proof"), calldata2.span());
    stop_cheat_caller_address(pool_addr);

    assert(result.is_err(), 'double spend should fail');
}

#[test]
fn test_withdraw_with_proof_unapproved_recipient() {
    let owner = addr(0x1);
    let depositor = addr(0x2);
    let recipient = addr(0x3); // NOT approved
    let token = deploy_mock_erc20(depositor);
    let amount: u256 = 1000;
    let pool_addr = deploy_pool_with_mock_verifier(token, amount, owner);

    let erc20 = ERC20ABIDispatcher { contract_address: token };
    let pool = IVeilDispatcher { contract_address: pool_addr };

    // Deposit
    start_cheat_caller_address(token, depositor);
    erc20.approve(pool_addr, amount);
    stop_cheat_caller_address(token);

    start_cheat_caller_address(pool_addr, depositor);
    pool.deposit(0x1234, 0xB01_u256);
    stop_cheat_caller_address(pool_addr);

    // Owner approves self and submits root, but does NOT approve recipient
    let bn128_root: u256 = 0xDEADBEEF;
    let leaf_count: u32 = 1; // 1 deposit above
    start_cheat_caller_address(pool_addr, owner);
    let mut root_calldata = array![];
    bn128_root.serialize(ref root_calldata);
    leaf_count.serialize(ref root_calldata);
    starknet::syscalls::call_contract_syscall(pool_addr, selector!("submit_bn128_root"), root_calldata.span()).unwrap();
    stop_cheat_caller_address(pool_addr);

    let nullifier_hash: u256 = 0xCAFEBABE;
    let proof = mock_proof_calldata(bn128_root, nullifier_hash);

    // Should fail: recipient not approved
    start_cheat_caller_address(pool_addr, depositor);
    let mut calldata = array![];
    nullifier_hash.serialize(ref calldata);
    recipient.serialize(ref calldata);
    proof.serialize(ref calldata);
    let result = starknet::syscalls::call_contract_syscall(pool_addr, selector!("withdraw_with_proof"), calldata.span());
    stop_cheat_caller_address(pool_addr);

    assert(result.is_err(), 'unapproved should fail');
}

#[test]
fn test_withdraw_with_proof_wrong_root() {
    let owner = addr(0x1);
    let depositor = addr(0x2);
    let recipient = addr(0x3);
    let token = deploy_mock_erc20(depositor);
    let amount: u256 = 1000;
    let pool_addr = deploy_pool_with_mock_verifier(token, amount, owner);

    let erc20 = ERC20ABIDispatcher { contract_address: token };
    let pool = IVeilDispatcher { contract_address: pool_addr };
    let compliance = IComplianceManagerDispatcher { contract_address: pool_addr };

    // Deposit + approve recipient
    start_cheat_caller_address(token, depositor);
    erc20.approve(pool_addr, amount);
    stop_cheat_caller_address(token);

    start_cheat_caller_address(pool_addr, depositor);
    pool.deposit(0x1234, 0xB01_u256);
    stop_cheat_caller_address(pool_addr);

    start_cheat_caller_address(pool_addr, owner);
    compliance.add_to_approved_set(recipient);
    let mut root_calldata = array![];
    let bn128_root: u256 = 0xDEADBEEF;
    bn128_root.serialize(ref root_calldata);
    let leaf_count: u32 = 1; // 1 deposit above
    leaf_count.serialize(ref root_calldata);
    starknet::syscalls::call_contract_syscall(pool_addr, selector!("submit_bn128_root"), root_calldata.span()).unwrap();
    stop_cheat_caller_address(pool_addr);

    // Mock proof has a DIFFERENT root than what's stored on-chain
    let wrong_root: u256 = 0xBADBAD;
    let nullifier_hash: u256 = 0xCAFEBABE;
    let proof = mock_proof_calldata(wrong_root, nullifier_hash);

    start_cheat_caller_address(pool_addr, depositor);
    let mut calldata = array![];
    nullifier_hash.serialize(ref calldata);
    recipient.serialize(ref calldata);
    proof.serialize(ref calldata);
    let result = starknet::syscalls::call_contract_syscall(pool_addr, selector!("withdraw_with_proof"), calldata.span());
    stop_cheat_caller_address(pool_addr);

    assert(result.is_err(), 'wrong root should fail');
}

#[test]
fn test_is_bn128_spent_initially_false() {
    let owner = addr(0x1);
    let token = deploy_mock_erc20(owner);
    let amount: u256 = 1000;
    let pool_addr = deploy_pool_with_mock_verifier(token, amount, owner);

    let nullifier: u256 = 0x12345;
    let mut calldata = array![];
    nullifier.serialize(ref calldata);
    let result = starknet::syscalls::call_contract_syscall(pool_addr, selector!("is_bn128_spent"), calldata.span()).unwrap();
    let mut result_span = result;
    let is_spent: bool = Serde::deserialize(ref result_span).unwrap();
    assert(!is_spent, 'should not be spent initially');
}

#[test]
fn test_get_bn128_root_initially_zero() {
    let owner = addr(0x1);
    let token = deploy_mock_erc20(owner);
    let amount: u256 = 1000;
    let pool_addr = deploy_pool_with_mock_verifier(token, amount, owner);

    let empty = array![];
    let result = starknet::syscalls::call_contract_syscall(pool_addr, selector!("get_bn128_root"), empty.span()).unwrap();
    let mut result_span = result;
    let root: u256 = Serde::deserialize(ref result_span).unwrap();
    assert(root == 0, 'root should be zero initially');
}

#[test]
fn test_bn128_root_history_buffer() {
    let owner = addr(0x1);
    let depositor = addr(0x2);
    let recipient = addr(0x3);
    let token = deploy_mock_erc20(depositor);
    let amount: u256 = 1000;
    let pool_addr = deploy_pool_with_mock_verifier(token, amount, owner);

    let erc20 = ERC20ABIDispatcher { contract_address: token };
    let pool = IVeilDispatcher { contract_address: pool_addr };
    let compliance = IComplianceManagerDispatcher { contract_address: pool_addr };

    // Fund pool with 2 deposits
    start_cheat_caller_address(token, depositor);
    erc20.approve(pool_addr, amount * 2);
    stop_cheat_caller_address(token);

    start_cheat_caller_address(pool_addr, depositor);
    pool.deposit(0x1111, 0xB02_u256);
    pool.deposit(0x2222, 0xB03_u256);
    stop_cheat_caller_address(pool_addr);

    // Approve owner + recipient
    start_cheat_caller_address(pool_addr, owner);
    compliance.add_to_approved_set(recipient);
    stop_cheat_caller_address(pool_addr);

    // Submit root1, then root2
    let root1: u256 = 0xAABBCCDD;
    let root2: u256 = 0xDEADBEEF;

    let leaf_count: u32 = 2; // 2 deposits above
    start_cheat_caller_address(pool_addr, owner);
    let mut calldata1 = array![];
    root1.serialize(ref calldata1);
    leaf_count.serialize(ref calldata1);
    starknet::syscalls::call_contract_syscall(pool_addr, selector!("submit_bn128_root"), calldata1.span()).unwrap();
    let mut calldata2 = array![];
    root2.serialize(ref calldata2);
    leaf_count.serialize(ref calldata2);
    starknet::syscalls::call_contract_syscall(pool_addr, selector!("submit_bn128_root"), calldata2.span()).unwrap();
    stop_cheat_caller_address(pool_addr);

    // get_bn128_root should return the latest (root2)
    let empty = array![];
    let result = starknet::syscalls::call_contract_syscall(pool_addr, selector!("get_bn128_root"), empty.span()).unwrap();
    let mut result_span = result;
    let current: u256 = Serde::deserialize(ref result_span).unwrap();
    assert(current == root2, 'should be latest root');

    // Withdraw against root1 (old root still in history) — should succeed
    let nullifier1: u256 = 0x1111AAAA;
    let proof1 = mock_proof_calldata(root1, nullifier1);

    start_cheat_caller_address(pool_addr, depositor);
    let mut w_calldata = array![];
    nullifier1.serialize(ref w_calldata);
    recipient.serialize(ref w_calldata);
    proof1.serialize(ref w_calldata);
    starknet::syscalls::call_contract_syscall(pool_addr, selector!("withdraw_with_proof"), w_calldata.span()).unwrap();
    stop_cheat_caller_address(pool_addr);

    assert(erc20.balance_of(recipient) == amount, 'old root should work');
}

#[test]
fn test_approved_user_still_cannot_submit_bn128_root() {
    let owner = addr(0x1);
    let operator = addr(0x42);
    let token = deploy_mock_erc20(owner);
    let amount: u256 = 1000;
    let pool_addr = deploy_pool_with_mock_verifier(token, amount, owner);

    let compliance = IComplianceManagerDispatcher { contract_address: pool_addr };

    // Owner approves non-owner user
    start_cheat_caller_address(pool_addr, owner);
    compliance.add_to_approved_set(operator);
    stop_cheat_caller_address(pool_addr);

    // Approved non-owner still cannot submit BN128 root
    let root: u256 = 0xFEEDFACE;
    let leaf_count: u32 = 0; // no deposits
    start_cheat_caller_address(pool_addr, operator);
    let mut calldata = array![];
    root.serialize(ref calldata);
    leaf_count.serialize(ref calldata);
    let result = starknet::syscalls::call_contract_syscall(pool_addr, selector!("submit_bn128_root"), calldata.span());
    stop_cheat_caller_address(pool_addr);

    assert(result.is_err(), 'approved non-owner should fail');

    // Verify root was not stored
    let empty = array![];
    let result = starknet::syscalls::call_contract_syscall(pool_addr, selector!("get_bn128_root"), empty.span()).unwrap();
    let mut result_span = result;
    let stored: u256 = Serde::deserialize(ref result_span).unwrap();
    assert(stored == 0, 'root should remain unset');
}

#[test]
fn test_submit_bn128_root_wrong_leaf_count_fails() {
    let owner = addr(0x1);
    let depositor = addr(0x2);
    let token = deploy_mock_erc20(depositor);
    let amount: u256 = 1000;
    let pool_addr = deploy_pool_with_mock_verifier(token, amount, owner);

    let pool = IVeilDispatcher { contract_address: pool_addr };
    let erc20 = ERC20ABIDispatcher { contract_address: token };

    // Make 1 deposit
    start_cheat_caller_address(token, depositor);
    erc20.approve(pool_addr, amount);
    stop_cheat_caller_address(token);

    start_cheat_caller_address(pool_addr, depositor);
    pool.deposit(0x1234, 0xB01_u256);
    stop_cheat_caller_address(pool_addr);

    // Try to submit root with wrong leaf_count (0 instead of 1)
    let root: u256 = 0xDEADBEEF;
    let wrong_leaf_count: u32 = 0;
    start_cheat_caller_address(pool_addr, owner);
    let mut calldata = array![];
    root.serialize(ref calldata);
    wrong_leaf_count.serialize(ref calldata);
    let result = starknet::syscalls::call_contract_syscall(pool_addr, selector!("submit_bn128_root"), calldata.span());
    stop_cheat_caller_address(pool_addr);

    assert(result.is_err(), 'wrong leaf count should fail');
}

#[test]
fn test_demo_mode_off_by_default() {
    let owner = addr(0x1);
    let user = addr(0x2);
    let token = deploy_mock_erc20(owner);
    let amount: u256 = 1000;
    let pool_addr = deploy_pool_with_mock_verifier(token, amount, owner);

    // Demo mode should be off by default
    let empty = array![];
    let result = starknet::syscalls::call_contract_syscall(pool_addr, selector!("is_demo_mode"), empty.span()).unwrap();
    let mut result_span = result;
    let demo_on: bool = Serde::deserialize(ref result_span).unwrap();
    assert(!demo_on, 'demo should be off');

    // Self-registration should fail
    start_cheat_caller_address(pool_addr, user);
    let empty2 = array![];
    let reg_result = starknet::syscalls::call_contract_syscall(pool_addr, selector!("register_for_demo"), empty2.span());
    stop_cheat_caller_address(pool_addr);

    assert(reg_result.is_err(), 'should fail w/ demo off');
}
