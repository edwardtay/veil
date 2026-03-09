use starknet::ContractAddress;
use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
    stop_cheat_caller_address, start_cheat_block_timestamp_global,
};
use openzeppelin_token::erc20::{ERC20ABIDispatcher, ERC20ABIDispatcherTrait};
use veil::vault::{IVeilVaultDispatcher, IVeilVaultDispatcherTrait};
use veil::vusd::{IVeilUSDDispatcher, IVeilUSDDispatcherTrait};
use veil::circuit_breaker::{ICircuitBreakerDispatcher, ICircuitBreakerDispatcherTrait};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn addr(v: felt252) -> ContractAddress {
    v.try_into().unwrap()
}

fn deploy_mock_erc20(recipient: ContractAddress) -> ContractAddress {
    let class = declare("MockERC20").unwrap().contract_class();
    let mut args = array![];
    let supply: u256 = 1_000_000_000_000;
    supply.serialize(ref args);
    recipient.serialize(ref args);
    let (contract_addr, _) = class.deploy(@args).unwrap();
    contract_addr
}

fn deploy_oracle(owner: ContractAddress, price: u256) -> ContractAddress {
    let class = declare("VeilOracle").unwrap().contract_class();
    let mut args = array![];
    owner.serialize(ref args);
    price.serialize(ref args);
    let (contract_addr, _) = class.deploy(@args).unwrap();
    contract_addr
}

fn deploy_vusd(owner: ContractAddress) -> ContractAddress {
    let class = declare("VeilUSD").unwrap().contract_class();
    let mut args = array![];
    owner.serialize(ref args);
    let (contract_addr, _) = class.deploy(@args).unwrap();
    contract_addr
}

fn deploy_vault(
    collateral: ContractAddress,
    vusd: ContractAddress,
    oracle: ContractAddress,
    owner: ContractAddress,
) -> ContractAddress {
    let class = declare("VeilVault").unwrap().contract_class();
    let mut args = array![];
    collateral.serialize(ref args);
    vusd.serialize(ref args);
    oracle.serialize(ref args);
    owner.serialize(ref args);
    let min_cr: u256 = 15000;
    min_cr.serialize(ref args);
    let liq_ratio: u256 = 12000;
    liq_ratio.serialize(ref args);
    let liq_penalty: u256 = 1000;
    liq_penalty.serialize(ref args);
    let (contract_addr, _) = class.deploy(@args).unwrap();
    contract_addr
}

fn setup() -> (ContractAddress, ContractAddress, ContractAddress, ContractAddress, ContractAddress) {
    let owner = addr(0x1);

    let wbtc = deploy_mock_erc20(owner);
    let oracle = deploy_oracle(owner, 10_000_000_000_000_u256); // $100,000
    let vusd = deploy_vusd(owner);
    let vault = deploy_vault(wbtc, vusd, oracle, owner);

    let vusd_dispatcher = IVeilUSDDispatcher { contract_address: vusd };
    start_cheat_caller_address(vusd, owner);
    vusd_dispatcher.set_minter(vault);
    stop_cheat_caller_address(vusd);

    (owner, wbtc, oracle, vusd, vault)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

/// Small withdrawals within the 30% outflow limit pass normally.
#[test]
fn test_normal_deposit_withdraw() {
    let (owner, wbtc, _oracle, _vusd, vault) = setup();
    let vault_d = IVeilVaultDispatcher { contract_address: vault };
    let wbtc_erc20 = ERC20ABIDispatcher { contract_address: wbtc };
    let cb = ICircuitBreakerDispatcher { contract_address: vault };

    let deposit_amount: u256 = 100_000_000; // 1 BTC

    // Approve and deposit
    start_cheat_caller_address(wbtc, owner);
    wbtc_erc20.approve(vault, deposit_amount);
    stop_cheat_caller_address(wbtc);

    start_cheat_caller_address(vault, owner);
    vault_d.deposit_collateral(deposit_amount);
    stop_cheat_caller_address(vault);

    // Verify circuit breaker tracked the inflow
    assert(cb.cb_tracked_liquidity() == deposit_amount, 'liquidity not tracked');
    assert(cb.cb_is_operational(), 'should be operational');
    assert(!cb.cb_is_rate_limited(), 'should not be rate limited');

    // Withdraw a small amount (10% of TVL, well within 30% limit)
    let withdraw_amount: u256 = 10_000_000; // 0.1 BTC

    start_cheat_caller_address(vault, owner);
    vault_d.withdraw_collateral(withdraw_amount);
    stop_cheat_caller_address(vault);

    // Should have been approved (not locked)
    let (collateral, _debt) = vault_d.get_position(owner);
    assert(collateral == deposit_amount - withdraw_amount, 'wrong collateral after withdraw');

    // No locked funds
    assert(cb.cb_locked_collateral(owner) == 0, 'should have no locked funds');

    // Verify WBTC was actually transferred
    let owner_balance = wbtc_erc20.balance_of(owner);
    assert(
        owner_balance == 1_000_000_000_000 - deposit_amount + withdraw_amount,
        'wrong wbtc balance',
    );
}

/// A large withdrawal exceeding the retained liquidity threshold triggers rate limiting.
#[test]
fn test_large_withdrawal_triggers_rate_limit() {
    let (owner, wbtc, _oracle, _vusd, vault) = setup();
    let vault_d = IVeilVaultDispatcher { contract_address: vault };
    let wbtc_erc20 = ERC20ABIDispatcher { contract_address: wbtc };
    let cb = ICircuitBreakerDispatcher { contract_address: vault };

    let deposit_amount: u256 = 100_000_000; // 1 BTC

    start_cheat_caller_address(wbtc, owner);
    wbtc_erc20.approve(vault, deposit_amount);
    stop_cheat_caller_address(wbtc);

    start_cheat_caller_address(vault, owner);
    vault_d.deposit_collateral(deposit_amount);
    stop_cheat_caller_address(vault);

    // Try to withdraw 50% — exceeds the 30% outflow limit (retaining 70%)
    let big_withdraw: u256 = 50_000_000; // 0.5 BTC

    start_cheat_caller_address(vault, owner);
    vault_d.withdraw_collateral(big_withdraw);
    stop_cheat_caller_address(vault);

    // Position should be reduced (funds earmarked)
    let (collateral, _debt) = vault_d.get_position(owner);
    assert(collateral == deposit_amount - big_withdraw, 'position not reduced');

    // But funds should be locked, not transferred
    assert(cb.cb_locked_collateral(owner) == big_withdraw, 'funds not locked');
    assert(cb.cb_is_rate_limited(), 'should be rate limited');

    // Owner's WBTC balance should NOT have increased
    let owner_balance = wbtc_erc20.balance_of(owner);
    assert(owner_balance == 1_000_000_000_000 - deposit_amount, 'wbtc should not transfer');
}

/// Locked funds can be claimed after the cooldown period expires.
#[test]
fn test_claim_locked_funds_after_cooldown() {
    let (owner, wbtc, _oracle, _vusd, vault) = setup();
    let vault_d = IVeilVaultDispatcher { contract_address: vault };
    let wbtc_erc20 = ERC20ABIDispatcher { contract_address: wbtc };
    let cb = ICircuitBreakerDispatcher { contract_address: vault };

    let deposit_amount: u256 = 100_000_000;

    start_cheat_caller_address(wbtc, owner);
    wbtc_erc20.approve(vault, deposit_amount);
    stop_cheat_caller_address(wbtc);

    start_cheat_caller_address(vault, owner);
    vault_d.deposit_collateral(deposit_amount);
    stop_cheat_caller_address(vault);

    // Trigger rate limit with large withdrawal
    let big_withdraw: u256 = 50_000_000;

    start_cheat_caller_address(vault, owner);
    vault_d.withdraw_collateral(big_withdraw);
    stop_cheat_caller_address(vault);

    assert(cb.cb_locked_collateral(owner) == big_withdraw, 'funds not locked');

    // Fast forward past the 24h cooldown (86400 seconds + 1)
    start_cheat_block_timestamp_global(86401);

    // Now claim locked funds
    start_cheat_caller_address(vault, owner);
    claim_locked_collateral(vault);
    stop_cheat_caller_address(vault);

    // Locked funds should be cleared
    assert(cb.cb_locked_collateral(owner) == 0, 'locked funds not cleared');

    // Owner should have received the WBTC
    let owner_balance = wbtc_erc20.balance_of(owner);
    assert(
        owner_balance == 1_000_000_000_000 - deposit_amount + big_withdraw,
        'wbtc not received after claim',
    );
}

/// Kill switch blocks all outflows.
#[test]
#[should_panic(expected: "vault not operational")]
fn test_kill_switch_blocks_withdrawals() {
    let (owner, wbtc, _oracle, _vusd, vault) = setup();
    let vault_d = IVeilVaultDispatcher { contract_address: vault };
    let wbtc_erc20 = ERC20ABIDispatcher { contract_address: wbtc };

    let deposit_amount: u256 = 100_000_000;

    start_cheat_caller_address(wbtc, owner);
    wbtc_erc20.approve(vault, deposit_amount);
    stop_cheat_caller_address(wbtc);

    start_cheat_caller_address(vault, owner);
    vault_d.deposit_collateral(deposit_amount);
    stop_cheat_caller_address(vault);

    // Owner marks vault as not operational
    start_cheat_caller_address(vault, owner);
    cb_mark_not_operational(vault);
    stop_cheat_caller_address(vault);

    // Any withdrawal should now panic
    start_cheat_caller_address(vault, owner);
    vault_d.withdraw_collateral(1_000_000); // even tiny amount
    stop_cheat_caller_address(vault);
}

/// Owner can override (clear) the rate limit.
#[test]
fn test_owner_override_rate_limit() {
    let (owner, wbtc, _oracle, _vusd, vault) = setup();
    let vault_d = IVeilVaultDispatcher { contract_address: vault };
    let wbtc_erc20 = ERC20ABIDispatcher { contract_address: wbtc };
    let cb = ICircuitBreakerDispatcher { contract_address: vault };

    let deposit_amount: u256 = 100_000_000;

    start_cheat_caller_address(wbtc, owner);
    wbtc_erc20.approve(vault, deposit_amount);
    stop_cheat_caller_address(wbtc);

    start_cheat_caller_address(vault, owner);
    vault_d.deposit_collateral(deposit_amount);
    stop_cheat_caller_address(vault);

    // Trigger rate limit
    let big_withdraw: u256 = 50_000_000;
    start_cheat_caller_address(vault, owner);
    vault_d.withdraw_collateral(big_withdraw);
    stop_cheat_caller_address(vault);

    assert(cb.cb_is_rate_limited(), 'should be rate limited');

    // Owner overrides the rate limit
    start_cheat_caller_address(vault, owner);
    cb_override_rate_limit(vault);
    stop_cheat_caller_address(vault);

    assert(!cb.cb_is_rate_limited(), 'rate limit should be cleared');

    // Now a second withdrawal should work (re-approve first since position still has 0.5 BTC)
    let small_withdraw: u256 = 10_000_000;
    start_cheat_caller_address(vault, owner);
    vault_d.withdraw_collateral(small_withdraw);
    stop_cheat_caller_address(vault);

    // Should be approved (not locked) since rate limit was cleared and outflow counter reset
    let (collateral, _) = vault_d.get_position(owner);
    assert(collateral == deposit_amount - big_withdraw - small_withdraw, 'wrong collateral');
}

/// Owner can update circuit breaker parameters.
#[test]
fn test_owner_update_parameters() {
    let (owner, _wbtc, _oracle, _vusd, vault) = setup();
    let cb = ICircuitBreakerDispatcher { contract_address: vault };

    // Default: 7000 bps, 0 threshold, 3600 period, 86400 cooldown
    assert(cb.cb_min_liq_retained_bps() == 7000, 'wrong default bps');
    assert(cb.cb_withdrawal_period() == 3600, 'wrong default period');
    assert(cb.cb_cooldown_period() == 86400, 'wrong default cooldown');

    // Update parameters
    start_cheat_caller_address(vault, owner);
    cb_set_parameters(vault, 5000, 1000, 7200, 43200);
    stop_cheat_caller_address(vault);

    assert(cb.cb_min_liq_retained_bps() == 5000, 'bps not updated');
    assert(cb.cb_withdrawal_period() == 7200, 'period not updated');
    assert(cb.cb_cooldown_period() == 43200, 'cooldown not updated');
}

// ---------------------------------------------------------------------------
// Free-function wrappers for non-trait external calls
// ---------------------------------------------------------------------------

use starknet::syscalls::call_contract_syscall;
use starknet::SyscallResultTrait;

fn claim_locked_collateral(vault: ContractAddress) {
    let mut calldata = array![];
    call_contract_syscall(vault, selector!("claim_locked_collateral"), calldata.span())
        .unwrap_syscall();
}

fn cb_mark_not_operational(vault: ContractAddress) {
    let mut calldata = array![];
    call_contract_syscall(vault, selector!("cb_mark_not_operational"), calldata.span())
        .unwrap_syscall();
}

fn cb_override_rate_limit(vault: ContractAddress) {
    let mut calldata = array![];
    call_contract_syscall(vault, selector!("cb_override_rate_limit"), calldata.span())
        .unwrap_syscall();
}

fn cb_set_parameters(
    vault: ContractAddress, min_liq_bps: u256, threshold: u256, period: u64, cooldown: u64,
) {
    let mut calldata = array![];
    min_liq_bps.serialize(ref calldata);
    threshold.serialize(ref calldata);
    period.serialize(ref calldata);
    cooldown.serialize(ref calldata);
    call_contract_syscall(vault, selector!("cb_set_parameters"), calldata.span()).unwrap_syscall();
}
