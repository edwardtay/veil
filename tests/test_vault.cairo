use starknet::ContractAddress;
use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait,
    start_cheat_caller_address, stop_cheat_caller_address,
    start_cheat_block_timestamp_global,
};
use openzeppelin_token::erc20::{ERC20ABIDispatcher, ERC20ABIDispatcherTrait};
use veil::vault::{IVeilVaultDispatcher, IVeilVaultDispatcherTrait};
use veil::vusd::{IVeilUSDDispatcher, IVeilUSDDispatcherTrait};
use veil::oracle::{IOracleDispatcher, IOracleDispatcherTrait};
use veil::circuit_breaker::{ICircuitBreakerDispatcher, ICircuitBreakerDispatcherTrait};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn addr(v: felt252) -> ContractAddress {
    v.try_into().unwrap()
}

/// Deploy MockERC20 with 1M tokens (8 decimals, simulating WBTC).
fn deploy_mock_erc20(recipient: ContractAddress) -> ContractAddress {
    let class = declare("MockERC20").unwrap().contract_class();
    let mut args = array![];
    let supply: u256 = 1_000_000_000_000; // 1 000 000 * 10^6  (but we treat 8 decimals -> 10_000 BTC)
    supply.serialize(ref args);
    recipient.serialize(ref args);
    let (contract_addr, _) = class.deploy(@args).unwrap();
    contract_addr
}

/// Deploy VeilOracle with an initial BTC/USD price.
/// Price uses 8 decimals (e.g. 10_000_000_000_000 = $100 000).
fn deploy_oracle(owner: ContractAddress, price: u256) -> ContractAddress {
    let class = declare("VeilOracle").unwrap().contract_class();
    let mut args = array![];
    owner.serialize(ref args);
    price.serialize(ref args);
    let (contract_addr, _) = class.deploy(@args).unwrap();
    contract_addr
}

/// Deploy VeilUSD (mintable stablecoin, 18 decimals).
fn deploy_vusd(owner: ContractAddress) -> ContractAddress {
    let class = declare("VeilUSD").unwrap().contract_class();
    let mut args = array![];
    owner.serialize(ref args);
    let (contract_addr, _) = class.deploy(@args).unwrap();
    contract_addr
}

/// Deploy VeilVault CDP contract.
///   min_collateral_ratio  = 15000  (150.00 %)
///   liquidation_ratio     = 12000  (120.00 %)
///   liquidation_penalty   = 1000   (10.00 %)
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

// ---------------------------------------------------------------------------
// Setup — returns (owner, wbtc, oracle, vusd, vault)
// ---------------------------------------------------------------------------

fn setup() -> (ContractAddress, ContractAddress, ContractAddress, ContractAddress, ContractAddress) {
    let owner = addr(0x1);

    let wbtc = deploy_mock_erc20(owner);
    let oracle = deploy_oracle(owner, 10_000_000_000_000_u256); // $100 000 (8 decimals)
    let vusd = deploy_vusd(owner);
    let vault = deploy_vault(wbtc, vusd, oracle, owner);

    // Authorise the vault as the vUSD minter so it can mint/burn.
    let vusd_dispatcher = IVeilUSDDispatcher { contract_address: vusd };
    start_cheat_caller_address(vusd, owner);
    vusd_dispatcher.set_minter(vault);
    stop_cheat_caller_address(vusd);

    (owner, wbtc, oracle, vusd, vault)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[test]
fn test_deploy_vault() {
    let (_owner, wbtc, _oracle, vusd, vault) = setup();
    let vault_d = IVeilVaultDispatcher { contract_address: vault };

    assert(vault_d.collateral_token() == wbtc, 'wrong collateral token');
    assert(vault_d.vusd_address() == vusd, 'wrong vusd address');
}

#[test]
fn test_deposit_and_mint() {
    let (owner, wbtc, _oracle, vusd, vault) = setup();
    let vault_d = IVeilVaultDispatcher { contract_address: vault };
    let wbtc_erc20 = ERC20ABIDispatcher { contract_address: wbtc };
    let vusd_erc20 = ERC20ABIDispatcher { contract_address: vusd };

    let deposit_amount: u256 = 100_000_000; // 1 BTC (8 decimals)
    // 50 000 vUSD with 18 decimals
    let mint_amount: u256 = 50_000_000_000_000_000_000_000;

    // Approve vault to spend WBTC
    start_cheat_caller_address(wbtc, owner);
    wbtc_erc20.approve(vault, deposit_amount);
    stop_cheat_caller_address(wbtc);

    // Deposit collateral
    start_cheat_caller_address(vault, owner);
    vault_d.deposit_collateral(deposit_amount);
    stop_cheat_caller_address(vault);

    // Mint vUSD against the deposited collateral
    start_cheat_caller_address(vault, owner);
    vault_d.mint_vusd(mint_amount);
    stop_cheat_caller_address(vault);

    // Verify position
    let (collateral, debt) = vault_d.get_position(owner);
    assert(collateral == deposit_amount, 'wrong collateral in position');
    assert(debt == mint_amount, 'wrong debt in position');

    // Verify vUSD balance
    assert(vusd_erc20.balance_of(owner) == mint_amount, 'wrong vusd balance');
}

#[test]
#[should_panic]
fn test_mint_too_much_fails() {
    let (owner, wbtc, _oracle, _vusd, vault) = setup();
    let vault_d = IVeilVaultDispatcher { contract_address: vault };
    let wbtc_erc20 = ERC20ABIDispatcher { contract_address: wbtc };

    let deposit_amount: u256 = 100_000_000; // 1 BTC (8 decimals)
    // 70 000 vUSD — 70% LTV exceeds the 66.7% max allowed by 150% min CR
    let mint_amount: u256 = 70_000_000_000_000_000_000_000;

    // Approve and deposit
    start_cheat_caller_address(wbtc, owner);
    wbtc_erc20.approve(vault, deposit_amount);
    stop_cheat_caller_address(wbtc);

    start_cheat_caller_address(vault, owner);
    vault_d.deposit_collateral(deposit_amount);
    stop_cheat_caller_address(vault);

    // Attempt to mint too much — should panic
    start_cheat_caller_address(vault, owner);
    vault_d.mint_vusd(mint_amount);
    stop_cheat_caller_address(vault);
}

#[test]
fn test_repay_and_withdraw() {
    let (owner, wbtc, _oracle, vusd, vault) = setup();
    let vault_d = IVeilVaultDispatcher { contract_address: vault };
    let wbtc_erc20 = ERC20ABIDispatcher { contract_address: wbtc };
    let vusd_erc20 = ERC20ABIDispatcher { contract_address: vusd };

    let deposit_amount: u256 = 100_000_000; // 1 BTC
    let mint_amount: u256 = 50_000_000_000_000_000_000_000; // 50 000 vUSD

    // Approve, deposit, mint
    start_cheat_caller_address(wbtc, owner);
    wbtc_erc20.approve(vault, deposit_amount);
    stop_cheat_caller_address(wbtc);

    start_cheat_caller_address(vault, owner);
    vault_d.deposit_collateral(deposit_amount);
    vault_d.mint_vusd(mint_amount);
    stop_cheat_caller_address(vault);

    // Approve vault to burn vUSD from owner (for repay)
    start_cheat_caller_address(vusd, owner);
    vusd_erc20.approve(vault, mint_amount);
    stop_cheat_caller_address(vusd);

    // Repay full debt
    start_cheat_caller_address(vault, owner);
    vault_d.repay_vusd(mint_amount);
    stop_cheat_caller_address(vault);

    // Withdraw all collateral (circuit breaker will rate-limit a 100% withdrawal)
    start_cheat_caller_address(vault, owner);
    vault_d.withdraw_collateral(deposit_amount);
    stop_cheat_caller_address(vault);

    // Position should be zeroed out
    let (collateral, debt) = vault_d.get_position(owner);
    assert(collateral == 0, 'collateral should be 0');
    assert(debt == 0, 'debt should be 0');

    // Funds are locked by circuit breaker — advance past cooldown (24h + 1s)
    start_cheat_block_timestamp_global(86401);

    // Claim locked collateral
    start_cheat_caller_address(vault, owner);
    vault_claim_locked_collateral(vault);
    stop_cheat_caller_address(vault);

    // Owner should have their WBTC back
    assert(wbtc_erc20.balance_of(owner) == 1_000_000_000_000, 'wbtc not returned');
}

#[test]
fn test_liquidation() {
    let (owner, wbtc, oracle, vusd, vault) = setup();
    let vault_d = IVeilVaultDispatcher { contract_address: vault };
    let wbtc_erc20 = ERC20ABIDispatcher { contract_address: wbtc };
    let vusd_erc20 = ERC20ABIDispatcher { contract_address: vusd };
    let oracle_d = IOracleDispatcher { contract_address: oracle };

    let deposit_amount: u256 = 100_000_000; // 1 BTC
    // Mint 60 000 vUSD (60% LTV, within 150% CR at $100k BTC price)
    let mint_amount: u256 = 60_000_000_000_000_000_000_000;

    // --- Owner opens a position ---
    start_cheat_caller_address(wbtc, owner);
    wbtc_erc20.approve(vault, deposit_amount);
    stop_cheat_caller_address(wbtc);

    start_cheat_caller_address(vault, owner);
    vault_d.deposit_collateral(deposit_amount);
    vault_d.mint_vusd(mint_amount);
    stop_cheat_caller_address(vault);

    // --- BTC price crashes to $50 000 ---
    // New CR = (1 BTC * $50 000) / $60 000 = 83.3% < 120% liquidation threshold
    // At this price, seize amount > collateral so all collateral is taken.
    start_cheat_caller_address(oracle, owner);
    oracle_d.set_price(5_000_000_000_000_u256); // $50 000 with 8 decimals
    stop_cheat_caller_address(oracle);

    // --- Liquidator prepares ---
    let liquidator = addr(0x2);

    // Transfer vUSD to liquidator so they can cover the debt
    start_cheat_caller_address(vusd, owner);
    vusd_erc20.transfer(liquidator, mint_amount);
    stop_cheat_caller_address(vusd);

    // Liquidator approves vault to spend their vUSD
    start_cheat_caller_address(vusd, liquidator);
    vusd_erc20.approve(vault, mint_amount);
    stop_cheat_caller_address(vusd);

    // --- Liquidator triggers liquidation (full debt) ---
    start_cheat_caller_address(vault, liquidator);
    vault_d.liquidate(owner, mint_amount);
    stop_cheat_caller_address(vault);

    // After liquidation, the owner's position should be cleared
    let (collateral, debt) = vault_d.get_position(owner);
    assert(collateral == 0, 'collateral should be 0');
    assert(debt == 0, 'debt should be 0');

    // Liquidator should have received collateral (with bonus from penalty)
    // Note: circuit breaker may lock it; check locked + balance
    let liquidator_wbtc = wbtc_erc20.balance_of(liquidator);
    let cb = ICircuitBreakerDispatcher { contract_address: vault };
    let locked = cb.cb_locked_collateral(liquidator);
    assert(liquidator_wbtc + locked > 0, 'liquidator got no collateral');
}

// ---------------------------------------------------------------------------
// Helper for calling non-trait external functions
// ---------------------------------------------------------------------------

use starknet::syscalls::call_contract_syscall;
use starknet::SyscallResultTrait;

fn vault_claim_locked_collateral(vault: ContractAddress) {
    let calldata = array![];
    call_contract_syscall(vault, selector!("claim_locked_collateral"), calldata.span())
        .unwrap_syscall();
}
