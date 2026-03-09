use starknet::ContractAddress;
use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
    stop_cheat_caller_address, start_cheat_block_timestamp_global,
};

use veil::oracle::{IOracleDispatcher, IOracleDispatcherTrait};

fn addr(v: felt252) -> ContractAddress {
    v.try_into().unwrap()
}

fn deploy_oracle(owner: ContractAddress, initial_price: u256) -> ContractAddress {
    let class = declare("VeilOracle").unwrap().contract_class();
    let mut args = array![];
    owner.serialize(ref args);
    initial_price.serialize(ref args);
    let (contract_addr, _) = class.deploy(@args).unwrap();
    contract_addr
}

fn deploy_mock_pragma() -> ContractAddress {
    let class = declare("MockPragmaOracle").unwrap().contract_class();
    let (contract_addr, _) = class.deploy(@array![]).unwrap();
    contract_addr
}

fn mock_set_response(
    mock_addr: ContractAddress,
    price: u128,
    decimals: u32,
    last_updated_timestamp: u64,
    num_sources_aggregated: u32,
) {
    let mut calldata = array![];
    price.serialize(ref calldata);
    decimals.serialize(ref calldata);
    last_updated_timestamp.serialize(ref calldata);
    num_sources_aggregated.serialize(ref calldata);
    starknet::syscalls::call_contract_syscall(
        mock_addr, selector!("set_response"), calldata.span(),
    )
        .unwrap();
}

#[test]
fn test_refresh_from_pragma_updates_price() {
    let owner = addr(0x1);
    let oracle_addr = deploy_oracle(owner, 1_u256);
    let mock_addr = deploy_mock_pragma();
    let oracle = IOracleDispatcher { contract_address: oracle_addr };

    start_cheat_caller_address(oracle_addr, owner);
    oracle.set_pragma_oracle(mock_addr);
    stop_cheat_caller_address(oracle_addr);

    start_cheat_block_timestamp_global(1000);
    mock_set_response(mock_addr, 9_999_999_999_u128, 8, 999, 3);

    oracle.refresh_from_pragma();
    assert(oracle.get_price() == 9_999_999_999_u256, 'price not refreshed');
}

#[test]
#[should_panic(expected: 'oracle timestamp in future')]
fn test_refresh_from_pragma_future_timestamp_fails() {
    let owner = addr(0x1);
    let oracle_addr = deploy_oracle(owner, 1_u256);
    let mock_addr = deploy_mock_pragma();
    let oracle = IOracleDispatcher { contract_address: oracle_addr };

    start_cheat_caller_address(oracle_addr, owner);
    oracle.set_pragma_oracle(mock_addr);
    stop_cheat_caller_address(oracle_addr);

    start_cheat_block_timestamp_global(1000);
    mock_set_response(mock_addr, 9_999_999_999_u128, 8, 1001, 3);

    oracle.refresh_from_pragma();
}
