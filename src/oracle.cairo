#[starknet::interface]
pub trait IOracle<TContractState> {
    fn get_price(self: @TContractState) -> u256;
    fn set_price(ref self: TContractState, price: u256);
    fn refresh_from_pragma(ref self: TContractState);
    fn set_pragma_oracle(ref self: TContractState, pragma_address: starknet::ContractAddress);
    fn decimals(self: @TContractState) -> u8;
}

// Pragma Oracle interface — defined inline to avoid dependency version conflicts
// See: https://docs.pragma.build/starknet/introduction
#[derive(Serde, Drop, Copy)]
pub struct PragmaPricesResponse {
    pub price: u128,
    pub decimals: u32,
    pub last_updated_timestamp: u64,
    pub num_sources_aggregated: u32,
    pub expiration_timestamp: Option<u64>,
}

#[derive(Serde, Drop, Copy)]
pub enum DataType {
    SpotEntry: felt252,
    FutureEntry: (felt252, u64),
}

#[derive(Serde, Drop, Copy)]
pub enum AggregationMode {
    Median: (),
    Mean: (),
    Error: (),
}

#[starknet::interface]
pub trait IPragmaABI<TContractState> {
    fn get_data(
        self: @TContractState, data_type: DataType, aggregation_mode: AggregationMode,
    ) -> PragmaPricesResponse;
}

#[starknet::contract]
pub mod VeilOracle {
    use starknet::ContractAddress;
    use core::num::traits::Zero;
    use openzeppelin_access::ownable::OwnableComponent;
    use openzeppelin_security::pausable::PausableComponent;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use super::{
        IPragmaABIDispatcher, IPragmaABIDispatcherTrait, DataType, AggregationMode,
    };

    // BTC/USD pair ID = UTF-8 encoding of "BTC/USD" as felt252
    const BTC_USD_PAIR_ID: felt252 = 18669995996566340;

    // [FIX #3] Expected decimals from Pragma BTC/USD feed
    const EXPECTED_DECIMALS: u32 = 8;

    // [FIX #3] Maximum acceptable staleness: 24 hours (generous for testnet)
    const MAX_STALENESS_SECONDS: u64 = 86400;

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    component!(path: PausableComponent, storage: pausable, event: PausableEvent);

    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    #[abi(embed_v0)]
    impl PausableImpl = PausableComponent::PausableImpl<ContractState>;
    impl PausableInternalImpl = PausableComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        price: u256,
        pragma_oracle: ContractAddress,
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        #[substorage(v0)]
        pausable: PausableComponent::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        PriceUpdated: PriceUpdated,
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        #[flat]
        PausableEvent: PausableComponent::Event,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PriceUpdated {
        pub old_price: u256,
        pub new_price: u256,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress, initial_price: u256) {
        self.ownable.initializer(owner);
        self.price.write(initial_price);
    }

    #[abi(embed_v0)]
    impl OracleImpl of super::IOracle<ContractState> {
        fn get_price(self: @ContractState) -> u256 {
            self.price.read()
        }

        fn set_price(ref self: ContractState, price: u256) {
            self.pausable.assert_not_paused();
            self.ownable.assert_only_owner();
            let old_price = self.price.read();
            self.price.write(price);
            self.emit(PriceUpdated { old_price, new_price: price });
        }

        /// Pull latest BTC/USD price from Pragma oracle and store it.
        /// Anyone can call this to refresh the price.
        /// [FIX #3] Now validates decimals, staleness, and source count.
        fn refresh_from_pragma(ref self: ContractState) {
            self.pausable.assert_not_paused();

            let pragma_addr = self.pragma_oracle.read();
            assert(!pragma_addr.is_zero(), 'pragma oracle not set');

            let dispatcher = IPragmaABIDispatcher { contract_address: pragma_addr };
            let response = dispatcher
                .get_data(
                    DataType::SpotEntry(BTC_USD_PAIR_ID), AggregationMode::Median(()),
                );

            // [FIX #3] Validate decimals match expected format
            assert(response.decimals == EXPECTED_DECIMALS, 'unexpected oracle decimals');

            // [FIX #3] Validate at least one source contributed
            assert(response.num_sources_aggregated > 0, 'no oracle sources');

            // [FIX #3] Validate price is not stale
            let now = starknet::get_block_timestamp();
            assert(now >= response.last_updated_timestamp, 'oracle timestamp in future');
            assert(
                now - response.last_updated_timestamp < MAX_STALENESS_SECONDS,
                'oracle price is stale',
            );

            // [FIX #3] Validate price is non-zero
            assert(response.price > 0, 'oracle price is zero');

            let old_price = self.price.read();
            let new_price: u256 = response.price.into();
            self.price.write(new_price);
            self.emit(PriceUpdated { old_price, new_price });
        }

        fn set_pragma_oracle(ref self: ContractState, pragma_address: ContractAddress) {
            self.ownable.assert_only_owner();
            self.pragma_oracle.write(pragma_address);
        }

        fn decimals(self: @ContractState) -> u8 {
            8_u8
        }
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
}
