use starknet::ContractAddress;

#[derive(Drop, Copy, PartialEq, Serde)]
pub enum OutflowStatus {
    Approved,
    RateLimited,
    NotOperational,
}

#[starknet::interface]
pub trait ICircuitBreaker<TContractState> {
    fn cb_is_operational(self: @TContractState) -> bool;
    fn cb_is_rate_limited(self: @TContractState) -> bool;
    fn cb_locked_collateral(self: @TContractState, user: ContractAddress) -> u256;
    fn cb_outflow_in_period(self: @TContractState) -> u256;
    fn cb_tracked_liquidity(self: @TContractState) -> u256;
    fn cb_min_liq_retained_bps(self: @TContractState) -> u256;
    fn cb_withdrawal_period(self: @TContractState) -> u64;
    fn cb_cooldown_period(self: @TContractState) -> u64;
}

#[starknet::component]
pub mod CircuitBreakerComponent {
    use starknet::{
        ContractAddress, get_block_timestamp,
        storage::{Map, StoragePointerReadAccess, StoragePointerWriteAccess, StoragePathEntry},
    };
    use super::OutflowStatus;

    // -------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------

    #[storage]
    pub struct Storage {
        // Parameters
        cb_min_liq_retained_bps: u256,
        cb_limit_begin_threshold: u256,
        cb_withdrawal_period: u64,
        cb_cooldown_period: u64,
        // Tracking
        cb_total_liquidity: u256,
        cb_outflow_in_period: u256,
        cb_period_start: u64,
        cb_is_rate_limited: bool,
        cb_rate_limit_timestamp: u64,
        cb_is_operational: bool,
        // Per-user locked funds
        cb_locked_funds: Map<ContractAddress, u256>,
    }

    // -------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RateLimitTriggered: RateLimitTriggered,
        RateLimitCleared: RateLimitCleared,
        FundsLocked: FundsLocked,
        FundsClaimed: FundsClaimed,
        OperationalStatusChanged: OperationalStatusChanged,
        CircuitBreakerParametersUpdated: CircuitBreakerParametersUpdated,
    }

    #[derive(Drop, starknet::Event)]
    pub struct RateLimitTriggered {
        pub timestamp: u64,
        pub outflow_in_period: u256,
        pub total_liquidity: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct RateLimitCleared {
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct FundsLocked {
        #[key]
        pub user: ContractAddress,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct FundsClaimed {
        #[key]
        pub user: ContractAddress,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct OperationalStatusChanged {
        pub is_operational: bool,
    }

    #[derive(Drop, starknet::Event)]
    pub struct CircuitBreakerParametersUpdated {
        pub min_liq_retained_bps: u256,
        pub limit_begin_threshold: u256,
        pub withdrawal_period: u64,
        pub cooldown_period: u64,
    }

    // -------------------------------------------------------------------
    // External view impl
    // -------------------------------------------------------------------

    #[embeddable_as(CircuitBreakerViewImpl)]
    pub impl CircuitBreakerView<
        TContractState, +HasComponent<TContractState>,
    > of super::ICircuitBreaker<ComponentState<TContractState>> {
        fn cb_is_operational(self: @ComponentState<TContractState>) -> bool {
            self.cb_is_operational.read()
        }

        fn cb_is_rate_limited(self: @ComponentState<TContractState>) -> bool {
            if !self.cb_is_rate_limited.read() {
                return false;
            }
            // Auto-clear if cooldown expired
            let now = get_block_timestamp();
            let cooldown = self.cb_cooldown_period.read();
            let limit_ts = self.cb_rate_limit_timestamp.read();
            if now >= limit_ts + cooldown {
                return false;
            }
            true
        }

        fn cb_locked_collateral(
            self: @ComponentState<TContractState>, user: ContractAddress,
        ) -> u256 {
            self.cb_locked_funds.entry(user).read()
        }

        fn cb_outflow_in_period(self: @ComponentState<TContractState>) -> u256 {
            self.cb_outflow_in_period.read()
        }

        fn cb_tracked_liquidity(self: @ComponentState<TContractState>) -> u256 {
            self.cb_total_liquidity.read()
        }

        fn cb_min_liq_retained_bps(self: @ComponentState<TContractState>) -> u256 {
            self.cb_min_liq_retained_bps.read()
        }

        fn cb_withdrawal_period(self: @ComponentState<TContractState>) -> u64 {
            self.cb_withdrawal_period.read()
        }

        fn cb_cooldown_period(self: @ComponentState<TContractState>) -> u64 {
            self.cb_cooldown_period.read()
        }
    }

    // -------------------------------------------------------------------
    // Internal impl
    // -------------------------------------------------------------------

    #[generate_trait]
    pub impl InternalImpl<
        TContractState, +HasComponent<TContractState>,
    > of InternalTrait<TContractState> {
        fn initializer(
            ref self: ComponentState<TContractState>,
            min_liq_retained_bps: u256,
            limit_begin_threshold: u256,
            withdrawal_period: u64,
            cooldown_period: u64,
        ) {
            self.cb_min_liq_retained_bps.write(min_liq_retained_bps);
            self.cb_limit_begin_threshold.write(limit_begin_threshold);
            self.cb_withdrawal_period.write(withdrawal_period);
            self.cb_cooldown_period.write(cooldown_period);
            self.cb_is_operational.write(true);
            self.cb_is_rate_limited.write(false);
            self.cb_period_start.write(get_block_timestamp());
        }

        fn record_inflow(ref self: ComponentState<TContractState>, amount: u256) {
            let current = self.cb_total_liquidity.read();
            self.cb_total_liquidity.write(current + amount);
        }

        fn check_outflow(
            ref self: ComponentState<TContractState>, amount: u256,
        ) -> OutflowStatus {
            // Kill switch
            if !self.cb_is_operational.read() {
                return OutflowStatus::NotOperational;
            }

            let total_liq = self.cb_total_liquidity.read();
            let threshold = self.cb_limit_begin_threshold.read();

            // Below threshold TVL — skip enforcement
            if total_liq <= threshold {
                return OutflowStatus::Approved;
            }

            let now = get_block_timestamp();

            // Auto-clear rate limit if cooldown expired
            if self.cb_is_rate_limited.read() {
                let cooldown = self.cb_cooldown_period.read();
                let limit_ts = self.cb_rate_limit_timestamp.read();
                if now >= limit_ts + cooldown {
                    self.cb_is_rate_limited.write(false);
                    self.cb_outflow_in_period.write(0);
                    self.cb_period_start.write(now);
                    self.emit(RateLimitCleared { timestamp: now });
                } else {
                    return OutflowStatus::RateLimited;
                }
            }

            // Reset period if expired
            let period = self.cb_withdrawal_period.read();
            let period_start = self.cb_period_start.read();
            if now >= period_start + period {
                self.cb_outflow_in_period.write(0);
                self.cb_period_start.write(now);
            }

            let outflow = self.cb_outflow_in_period.read();
            let min_retained_bps = self.cb_min_liq_retained_bps.read();

            // Check: total_liq - (outflow + amount) >= total_liq * min_retained_bps / 10000
            let new_outflow = outflow + amount;
            let min_retained = (total_liq * min_retained_bps) / 10000;

            if total_liq < new_outflow + min_retained {
                // Trigger rate limit
                self.cb_is_rate_limited.write(true);
                self.cb_rate_limit_timestamp.write(now);
                self
                    .emit(
                        RateLimitTriggered {
                            timestamp: now,
                            outflow_in_period: new_outflow,
                            total_liquidity: total_liq,
                        },
                    );
                return OutflowStatus::RateLimited;
            }

            OutflowStatus::Approved
        }

        fn record_outflow(ref self: ComponentState<TContractState>, amount: u256) {
            let outflow = self.cb_outflow_in_period.read();
            self.cb_outflow_in_period.write(outflow + amount);

            let total_liq = self.cb_total_liquidity.read();
            if total_liq >= amount {
                self.cb_total_liquidity.write(total_liq - amount);
            } else {
                self.cb_total_liquidity.write(0);
            }
        }

        fn lock_funds(
            ref self: ComponentState<TContractState>, user: ContractAddress, amount: u256,
        ) {
            let current = self.cb_locked_funds.entry(user).read();
            self.cb_locked_funds.entry(user).write(current + amount);
            self.emit(FundsLocked { user, amount });
        }

        fn release_locked_funds(
            ref self: ComponentState<TContractState>, user: ContractAddress,
        ) -> u256 {
            let amount = self.cb_locked_funds.entry(user).read();
            assert(amount > 0, 'no locked funds');

            // Must not be rate limited (cooldown must have expired)
            let is_limited = self.cb_is_rate_limited.read();
            if is_limited {
                let now = get_block_timestamp();
                let cooldown = self.cb_cooldown_period.read();
                let limit_ts = self.cb_rate_limit_timestamp.read();
                assert(now >= limit_ts + cooldown, 'cooldown not expired');

                // Auto-clear
                self.cb_is_rate_limited.write(false);
                self.cb_outflow_in_period.write(0);
                self.cb_period_start.write(now);
                self.emit(RateLimitCleared { timestamp: now });
            }

            self.cb_locked_funds.entry(user).write(0);

            // Record as outflow
            let total_liq = self.cb_total_liquidity.read();
            if total_liq >= amount {
                self.cb_total_liquidity.write(total_liq - amount);
            } else {
                self.cb_total_liquidity.write(0);
            }

            self.emit(FundsClaimed { user, amount });
            amount
        }

        fn set_parameters(
            ref self: ComponentState<TContractState>,
            min_liq_retained_bps: u256,
            limit_begin_threshold: u256,
            withdrawal_period: u64,
            cooldown_period: u64,
        ) {
            self.cb_min_liq_retained_bps.write(min_liq_retained_bps);
            self.cb_limit_begin_threshold.write(limit_begin_threshold);
            self.cb_withdrawal_period.write(withdrawal_period);
            self.cb_cooldown_period.write(cooldown_period);
            self
                .emit(
                    CircuitBreakerParametersUpdated {
                        min_liq_retained_bps, limit_begin_threshold, withdrawal_period,
                        cooldown_period,
                    },
                );
        }

        fn set_operational(ref self: ComponentState<TContractState>, operational: bool) {
            self.cb_is_operational.write(operational);
            self.emit(OperationalStatusChanged { is_operational: operational });
        }

        fn clear_rate_limit(ref self: ComponentState<TContractState>) {
            let now = get_block_timestamp();
            self.cb_is_rate_limited.write(false);
            self.cb_outflow_in_period.write(0);
            self.cb_period_start.write(now);
            self.emit(RateLimitCleared { timestamp: now });
        }
    }
}
