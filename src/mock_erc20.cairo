#[starknet::contract]
mod MockERC20 {
    use starknet::{
        ContractAddress, get_caller_address,
        storage::{Map, StoragePointerReadAccess, StoragePointerWriteAccess, StoragePathEntry}
    };

    use openzeppelin_token::erc20::interface::{IERC20, IERC20CamelOnly};

    #[storage]
    struct Storage {
        balances: Map<ContractAddress, u256>,
        allowances: Map<(ContractAddress, ContractAddress), u256>,
        total_supply: u256,
    }

    #[constructor]
    fn constructor(ref self: ContractState, initial_supply: u256, recipient: ContractAddress) {
        self.balances.entry(recipient).write(initial_supply);
        self.total_supply.write(initial_supply);
    }

    // Public faucet — anyone can mint testnet tokens for demo purposes
    #[external(v0)]
    fn faucet(ref self: ContractState, amount: u256) {
        let caller = get_caller_address();
        self.balances.entry(caller).write(self.balances.entry(caller).read() + amount);
        self.total_supply.write(self.total_supply.read() + amount);
    }

    #[abi(embed_v0)]
    impl ERC20Impl of IERC20<ContractState> {
        fn total_supply(self: @ContractState) -> u256 {
            self.total_supply.read()
        }

        fn balance_of(self: @ContractState, account: ContractAddress) -> u256 {
            self.balances.entry(account).read()
        }

        fn allowance(self: @ContractState, owner: ContractAddress, spender: ContractAddress) -> u256 {
            self.allowances.entry((owner, spender)).read()
        }

        fn transfer(ref self: ContractState, recipient: ContractAddress, amount: u256) -> bool {
            let sender = get_caller_address();
            let sender_balance = self.balances.entry(sender).read();
            assert(sender_balance >= amount, 'insufficient balance');
            self.balances.entry(sender).write(sender_balance - amount);
            self.balances.entry(recipient).write(self.balances.entry(recipient).read() + amount);
            true
        }

        fn transfer_from(
            ref self: ContractState,
            sender: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
        ) -> bool {
            let caller = get_caller_address();
            let current_allowance = self.allowances.entry((sender, caller)).read();
            assert(current_allowance >= amount, 'insufficient allowance');
            self.allowances.entry((sender, caller)).write(current_allowance - amount);

            let sender_balance = self.balances.entry(sender).read();
            assert(sender_balance >= amount, 'insufficient balance');
            self.balances.entry(sender).write(sender_balance - amount);
            self.balances.entry(recipient).write(self.balances.entry(recipient).read() + amount);
            true
        }

        fn approve(ref self: ContractState, spender: ContractAddress, amount: u256) -> bool {
            let caller = get_caller_address();
            self.allowances.entry((caller, spender)).write(amount);
            true
        }
    }

    #[abi(embed_v0)]
    impl ERC20CamelImpl of IERC20CamelOnly<ContractState> {
        fn totalSupply(self: @ContractState) -> u256 {
            self.total_supply.read()
        }

        fn balanceOf(self: @ContractState, account: ContractAddress) -> u256 {
            self.balances.entry(account).read()
        }

        fn transferFrom(
            ref self: ContractState,
            sender: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
        ) -> bool {
            IERC20::transfer_from(ref self, sender, recipient, amount)
        }
    }
}
