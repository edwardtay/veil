use starknet::ContractAddress;

#[starknet::interface]
pub trait IVeilUSD<TContractState> {
    fn mint(ref self: TContractState, to: ContractAddress, amount: u256);
    fn burn_from(ref self: TContractState, from: ContractAddress, amount: u256);
    fn set_minter(ref self: TContractState, minter: ContractAddress);
    fn minter(self: @TContractState) -> ContractAddress;
}

#[starknet::contract]
pub mod VeilUSD {
    use starknet::ContractAddress;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::get_caller_address;
    use openzeppelin_token::erc20::ERC20Component;
    use openzeppelin_token::erc20::ERC20HooksEmptyImpl;
    use openzeppelin_access::ownable::OwnableComponent;

    component!(path: ERC20Component, storage: erc20, event: ERC20Event);
    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);

    #[abi(embed_v0)]
    impl ERC20MixinImpl = ERC20Component::ERC20MixinImpl<ContractState>;
    impl ERC20InternalImpl = ERC20Component::InternalImpl<ContractState>;

    // Ownable
    #[abi(embed_v0)]
    impl OwnableMixinImpl = OwnableComponent::OwnableMixinImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        minter: ContractAddress,
        #[substorage(v0)]
        erc20: ERC20Component::Storage,
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        ERC20Event: ERC20Component::Event,
        #[flat]
        OwnableEvent: OwnableComponent::Event,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.erc20.initializer("Veil USD", "vUSD");
        self.ownable.initializer(owner);
    }

    #[abi(embed_v0)]
    impl VeilUSDImpl of super::IVeilUSD<ContractState> {
        fn mint(ref self: ContractState, to: ContractAddress, amount: u256) {
            assert(get_caller_address() == self.minter.read(), 'Caller is not the minter');
            self.erc20.mint(to, amount);
        }

        fn burn_from(ref self: ContractState, from: ContractAddress, amount: u256) {
            assert(get_caller_address() == self.minter.read(), 'Caller is not the minter');
            self.erc20.burn(from, amount);
        }

        fn set_minter(ref self: ContractState, minter: ContractAddress) {
            self.ownable.assert_only_owner();
            self.minter.write(minter);
        }

        fn minter(self: @ContractState) -> ContractAddress {
            self.minter.read()
        }
    }
}
