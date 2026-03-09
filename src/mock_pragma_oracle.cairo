#[starknet::contract]
pub mod MockPragmaOracle {
    use crate::oracle::{AggregationMode, DataType, PragmaPricesResponse};
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};

    #[storage]
    struct Storage {
        price: u128,
        decimals: u32,
        last_updated_timestamp: u64,
        num_sources_aggregated: u32,
    }

    #[constructor]
    fn constructor(ref self: ContractState) {
        self.price.write(0);
        self.decimals.write(8);
        self.last_updated_timestamp.write(0);
        self.num_sources_aggregated.write(0);
    }

    #[external(v0)]
    fn set_response(
        ref self: ContractState,
        price: u128,
        decimals: u32,
        last_updated_timestamp: u64,
        num_sources_aggregated: u32,
    ) {
        self.price.write(price);
        self.decimals.write(decimals);
        self.last_updated_timestamp.write(last_updated_timestamp);
        self.num_sources_aggregated.write(num_sources_aggregated);
    }

    #[abi(embed_v0)]
    impl PragmaImpl of crate::oracle::IPragmaABI<ContractState> {
        fn get_data(
            self: @ContractState, data_type: DataType, aggregation_mode: AggregationMode,
        ) -> PragmaPricesResponse {
            let _ = data_type;
            let _ = aggregation_mode;
            PragmaPricesResponse {
                price: self.price.read(),
                decimals: self.decimals.read(),
                last_updated_timestamp: self.last_updated_timestamp.read(),
                num_sources_aggregated: self.num_sources_aggregated.read(),
                expiration_timestamp: Option::None(()),
            }
        }
    }
}
