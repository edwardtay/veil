use starknet::ContractAddress;

#[starknet::interface]
pub trait IVeilVault<TContractState> {
    fn deposit_collateral(ref self: TContractState, amount: u256);
    fn withdraw_collateral(ref self: TContractState, amount: u256);
    fn mint_vusd(ref self: TContractState, amount: u256);
    fn repay_vusd(ref self: TContractState, amount: u256);
    fn liquidate(ref self: TContractState, user: ContractAddress, amount: u256);
    fn get_position(self: @TContractState, user: ContractAddress) -> (u256, u256);
    fn get_collateral_ratio(self: @TContractState, user: ContractAddress) -> u256;
    fn collateral_token(self: @TContractState) -> ContractAddress;
    fn vusd_address(self: @TContractState) -> ContractAddress;
}

#[starknet::contract]
pub mod VeilVault {
    use core::num::traits::Zero;

    use starknet::{
        ContractAddress, get_caller_address, get_contract_address,
        storage::{Map, StoragePointerReadAccess, StoragePointerWriteAccess, StoragePathEntry},
    };

    use openzeppelin_token::erc20::{ERC20ABIDispatcher, ERC20ABIDispatcherTrait};
    use openzeppelin_access::ownable::OwnableComponent;
    use openzeppelin_security::pausable::PausableComponent;

    use crate::oracle::{IOracleDispatcher, IOracleDispatcherTrait};
    use crate::vusd::{IVeilUSDDispatcher, IVeilUSDDispatcherTrait};
    use crate::circuit_breaker::CircuitBreakerComponent;
    use crate::circuit_breaker::OutflowStatus;

    use super::IVeilVault;

    /// Price scale matching 8-decimal BTC price feeds (1e8).
    const PRICE_SCALE: u256 = 100000000;

    /// Scale factor to bridge 8-decimal collateral to 18-decimal debt (1e10).
    const DECIMAL_SCALE: u256 = 10000000000;

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    component!(path: PausableComponent, storage: pausable, event: PausableEvent);
    component!(path: CircuitBreakerComponent, storage: circuit_breaker, event: CircuitBreakerEvent);

    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    #[abi(embed_v0)]
    impl PausableImpl = PausableComponent::PausableImpl<ContractState>;
    impl PausableInternalImpl = PausableComponent::InternalImpl<ContractState>;

    #[abi(embed_v0)]
    impl CircuitBreakerViewImpl =
        CircuitBreakerComponent::CircuitBreakerViewImpl<ContractState>;
    impl CircuitBreakerInternalImpl = CircuitBreakerComponent::InternalImpl<ContractState>;

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        CollateralDeposited: CollateralDeposited,
        CollateralWithdrawn: CollateralWithdrawn,
        VUSDMinted: VUSDMinted,
        VUSDRepaid: VUSDRepaid,
        PositionLiquidated: PositionLiquidated,
        WithdrawalQueued: WithdrawalQueued,
        LiquidationQueued: LiquidationQueued,
        OwnableEvent: OwnableComponent::Event,
        PausableEvent: PausableComponent::Event,
        CircuitBreakerEvent: CircuitBreakerComponent::Event,
    }

    #[derive(Drop, starknet::Event)]
    pub struct CollateralDeposited {
        #[key]
        pub user: ContractAddress,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct CollateralWithdrawn {
        #[key]
        pub user: ContractAddress,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct VUSDMinted {
        #[key]
        pub user: ContractAddress,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct VUSDRepaid {
        #[key]
        pub user: ContractAddress,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PositionLiquidated {
        #[key]
        pub user: ContractAddress,
        pub liquidator: ContractAddress,
        pub collateral_seized: u256,
        pub debt_repaid: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct WithdrawalQueued {
        #[key]
        pub user: ContractAddress,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct LiquidationQueued {
        #[key]
        pub user: ContractAddress,
        pub liquidator: ContractAddress,
        pub collateral_amount: u256,
    }

    // -----------------------------------------------------------------------
    // Storage
    // -----------------------------------------------------------------------

    #[storage]
    struct Storage {
        collateral_token: ERC20ABIDispatcher,
        vusd_token: IVeilUSDDispatcher,
        oracle: IOracleDispatcher,
        min_collateral_ratio: u256,
        liquidation_ratio: u256,
        liquidation_penalty: u256,
        positions_collateral: Map<ContractAddress, u256>,
        positions_debt: Map<ContractAddress, u256>,
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        #[substorage(v0)]
        pausable: PausableComponent::Storage,
        #[substorage(v0)]
        circuit_breaker: CircuitBreakerComponent::Storage,
    }

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------

    #[constructor]
    fn constructor(
        ref self: ContractState,
        collateral: ContractAddress,
        vusd: ContractAddress,
        price_oracle: ContractAddress,
        owner: ContractAddress,
        min_cr: u256,
        liq_ratio: u256,
        liq_penalty: u256,
    ) {
        assert(!collateral.is_zero(), 'collateral address is zero');
        assert(!vusd.is_zero(), 'vusd address is zero');
        assert(!price_oracle.is_zero(), 'oracle address is zero');
        assert(!owner.is_zero(), 'owner address is zero');
        assert(min_cr > 0, 'min collateral ratio is zero');
        assert(liq_ratio > 0, 'liquidation ratio is zero');

        self.collateral_token.write(ERC20ABIDispatcher { contract_address: collateral });
        self.vusd_token.write(IVeilUSDDispatcher { contract_address: vusd });
        self.oracle.write(IOracleDispatcher { contract_address: price_oracle });
        self.min_collateral_ratio.write(min_cr);
        self.liquidation_ratio.write(liq_ratio);
        self.liquidation_penalty.write(liq_penalty);
        self.ownable.initializer(owner);
        // Circuit breaker: retain 70% liquidity, always active (threshold=0), 1h window, 24h
        // cooldown
        self.circuit_breaker.initializer(7000, 0, 3600, 86400);
    }

    // -----------------------------------------------------------------------
    // External / Public
    // -----------------------------------------------------------------------

    #[abi(embed_v0)]
    impl VeilVaultImpl of IVeilVault<ContractState> {
        /// Deposit WBTC collateral into the caller's position.
        fn deposit_collateral(ref self: ContractState, amount: u256) {
            self.pausable.assert_not_paused();
            assert(amount > 0, 'amount is zero');

            let caller = get_caller_address();
            let vault = get_contract_address();

            // Transfer WBTC from caller to vault
            self.collateral_token.read().transfer_from(caller, vault, amount);

            // Update position
            let current = self.positions_collateral.entry(caller).read();
            self.positions_collateral.entry(caller).write(current + amount);

            // Track inflow for circuit breaker
            self.circuit_breaker.record_inflow(amount);

            self.emit(CollateralDeposited { user: caller, amount });
        }

        /// Withdraw WBTC collateral if the position remains healthy afterwards.
        /// If the circuit breaker rate-limits the withdrawal, funds are locked
        /// for delayed claiming after the cooldown period.
        fn withdraw_collateral(ref self: ContractState, amount: u256) {
            self.pausable.assert_not_paused();
            assert(amount > 0, 'amount is zero');

            let caller = get_caller_address();
            let current_collateral = self.positions_collateral.entry(caller).read();
            assert(current_collateral >= amount, 'insufficient collateral');

            let new_collateral = current_collateral - amount;
            let debt = self.positions_debt.entry(caller).read();

            // If user has outstanding debt, ensure the position stays healthy
            if debt > 0 {
                let ratio = compute_collateral_ratio(@self, new_collateral, debt);
                let min_cr = self.min_collateral_ratio.read();
                assert(ratio >= min_cr, 'below min collateral ratio');
            }

            // Circuit breaker check
            let status = self.circuit_breaker.check_outflow(amount);
            match status {
                OutflowStatus::Approved => {
                    self.positions_collateral.entry(caller).write(new_collateral);
                    self.circuit_breaker.record_outflow(amount);
                    self.collateral_token.read().transfer(caller, amount);
                    self.emit(CollateralWithdrawn { user: caller, amount });
                },
                OutflowStatus::RateLimited => {
                    // Reduce position but lock funds instead of transferring
                    self.positions_collateral.entry(caller).write(new_collateral);
                    self.circuit_breaker.lock_funds(caller, amount);
                    self.emit(WithdrawalQueued { user: caller, amount });
                },
                OutflowStatus::NotOperational => {
                    panic!("vault not operational");
                },
            }
        }

        /// Mint vUSD stablecoin against the caller's collateral.
        fn mint_vusd(ref self: ContractState, amount: u256) {
            self.pausable.assert_not_paused();
            assert(amount > 0, 'amount is zero');

            let caller = get_caller_address();
            let collateral = self.positions_collateral.entry(caller).read();
            let current_debt = self.positions_debt.entry(caller).read();
            let new_debt = current_debt + amount;

            // Check that position remains healthy after minting
            let ratio = compute_collateral_ratio(@self, collateral, new_debt);
            let min_cr = self.min_collateral_ratio.read();
            assert(ratio >= min_cr, 'below min collateral ratio');

            // Update debt
            self.positions_debt.entry(caller).write(new_debt);

            // Mint vUSD to caller
            self.vusd_token.read().mint(caller, amount);

            self.emit(VUSDMinted { user: caller, amount });
        }

        /// Repay (burn) vUSD to reduce the caller's debt.
        fn repay_vusd(ref self: ContractState, amount: u256) {
            self.pausable.assert_not_paused();
            assert(amount > 0, 'amount is zero');

            let caller = get_caller_address();
            let current_debt = self.positions_debt.entry(caller).read();
            assert(current_debt >= amount, 'repay exceeds debt');

            // Burn vUSD from caller
            self.vusd_token.read().burn_from(caller, amount);

            // Reduce debt
            self.positions_debt.entry(caller).write(current_debt - amount);

            self.emit(VUSDRepaid { user: caller, amount });
        }

        /// Liquidate an undercollateralized position. The liquidator repays
        /// some or all of the user's debt and receives proportional collateral
        /// plus a penalty bonus.
        /// [FIX #4] Supports partial liquidation: `amount` is the debt to repay.
        /// If `amount` exceeds total debt, the full debt is repaid.
        fn liquidate(ref self: ContractState, user: ContractAddress, amount: u256) {
            self.pausable.assert_not_paused();

            let liquidator = get_caller_address();
            let collateral = self.positions_collateral.entry(user).read();
            let debt = self.positions_debt.entry(user).read();

            assert(debt > 0, 'no debt to liquidate');
            assert(amount > 0, 'amount is zero');

            // Check that the position is below the liquidation threshold
            let ratio = compute_collateral_ratio(@self, collateral, debt);
            let liq_ratio = self.liquidation_ratio.read();
            assert(ratio < liq_ratio, 'position is healthy');

            // Cap repay amount at total debt
            let repay_amount = if amount > debt { debt } else { amount };

            // Calculate collateral to seize proportionally:
            //   base_seize = repay_amount * PRICE_SCALE / (price * DECIMAL_SCALE)
            //   penalty    = base_seize * liquidation_penalty / 10000
            //   total      = base_seize + penalty
            let price = self.oracle.read().get_price();
            assert(price > 0, 'oracle price is zero');

            let base_seize = (repay_amount * PRICE_SCALE) / (price * DECIMAL_SCALE);
            let penalty_amount = (base_seize * self.liquidation_penalty.read()) / 10000;
            let mut total_seize = base_seize + penalty_amount;

            // Cap seized collateral at the position's total collateral
            if total_seize > collateral {
                total_seize = collateral;
            }

            // Burn the repay amount from the liquidator
            self.vusd_token.read().burn_from(liquidator, repay_amount);

            // Update the position (partial — not necessarily clearing it)
            self.positions_collateral.entry(user).write(collateral - total_seize);
            self.positions_debt.entry(user).write(debt - repay_amount);

            // Circuit breaker check for liquidation outflow
            let status = self.circuit_breaker.check_outflow(total_seize);
            match status {
                OutflowStatus::Approved => {
                    self.circuit_breaker.record_outflow(total_seize);
                    self.collateral_token.read().transfer(liquidator, total_seize);
                    self.emit(PositionLiquidated {
                        user,
                        liquidator,
                        collateral_seized: total_seize,
                        debt_repaid: repay_amount,
                    });
                },
                OutflowStatus::RateLimited => {
                    // Lock seized collateral for liquidator to claim later
                    self.circuit_breaker.lock_funds(liquidator, total_seize);
                    self.emit(LiquidationQueued {
                        user, liquidator, collateral_amount: total_seize,
                    });
                },
                OutflowStatus::NotOperational => {
                    panic!("vault not operational");
                },
            }
        }

        /// Returns (collateral, debt) for a given user.
        fn get_position(self: @ContractState, user: ContractAddress) -> (u256, u256) {
            let collateral = self.positions_collateral.entry(user).read();
            let debt = self.positions_debt.entry(user).read();
            (collateral, debt)
        }

        /// Returns the collateral ratio for a user in basis points * 100.
        /// For example, 15000 means 150%. Returns max u256 if debt is 0.
        fn get_collateral_ratio(self: @ContractState, user: ContractAddress) -> u256 {
            let collateral = self.positions_collateral.entry(user).read();
            let debt = self.positions_debt.entry(user).read();
            compute_collateral_ratio(self, collateral, debt)
        }

        /// Returns the address of the WBTC collateral token.
        fn collateral_token(self: @ContractState) -> ContractAddress {
            self.collateral_token.read().contract_address
        }

        /// Returns the address of the vUSD token.
        fn vusd_address(self: @ContractState) -> ContractAddress {
            self.vusd_token.read().contract_address
        }
    }

    // -----------------------------------------------------------------------
    // [FIX #5] Owner-only pause/unpause for emergency stops
    // -----------------------------------------------------------------------

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

    // -----------------------------------------------------------------------
    // Circuit breaker admin (owner-only)
    // -----------------------------------------------------------------------

    #[external(v0)]
    fn cb_set_parameters(
        ref self: ContractState,
        min_liq_bps: u256,
        threshold: u256,
        period: u64,
        cooldown: u64,
    ) {
        self.ownable.assert_only_owner();
        self.circuit_breaker.set_parameters(min_liq_bps, threshold, period, cooldown);
    }

    #[external(v0)]
    fn cb_mark_not_operational(ref self: ContractState) {
        self.ownable.assert_only_owner();
        self.circuit_breaker.set_operational(false);
    }

    #[external(v0)]
    fn cb_restore_operational(ref self: ContractState) {
        self.ownable.assert_only_owner();
        self.circuit_breaker.set_operational(true);
    }

    #[external(v0)]
    fn cb_override_rate_limit(ref self: ContractState) {
        self.ownable.assert_only_owner();
        self.circuit_breaker.clear_rate_limit();
    }

    // -----------------------------------------------------------------------
    // Claim locked collateral (any user)
    // -----------------------------------------------------------------------

    #[external(v0)]
    fn claim_locked_collateral(ref self: ContractState) {
        self.pausable.assert_not_paused();
        let caller = get_caller_address();
        let amount = self.circuit_breaker.release_locked_funds(caller);
        self.collateral_token.read().transfer(caller, amount);
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    /// Compute collateral ratio given raw collateral amount and debt.
    /// Returns ratio in basis points * 100 (e.g. 15000 = 150%).
    /// If debt is 0, returns the maximum u256 value.
    fn compute_collateral_ratio(
        self: @ContractState, collateral: u256, debt: u256,
    ) -> u256 {
        if debt == 0 {
            return core::num::traits::Bounded::<u256>::MAX;
        }

        let price = self.oracle.read().get_price();
        assert(price > 0, 'oracle price is zero');

        // collateral_value = collateral * price / PRICE_SCALE  (in 8-decimal USD)
        // Scale up by DECIMAL_SCALE to match 18-decimal debt units
        // ratio = collateral_value_scaled * 10000 / debt
        let collateral_value = (collateral * price) / PRICE_SCALE;
        let ratio = (collateral_value * DECIMAL_SCALE * 10000) / debt;
        ratio
    }
}
