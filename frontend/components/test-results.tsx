"use client";

import { CheckCircle } from "lucide-react";

const tests = [
  { suite: "Pool", tests: [
    "test_deploy_pool",
    "test_deposit",
    "test_duplicate_deposit_fails",
    "test_ragequit",
    "test_ragequit_wrong_caller",
    "test_compliance_approved_set",
    "test_register_for_demo",
    "test_withdraw_unknown_root_fails",
  ]},
  { suite: "Vault", tests: [
    "test_deploy_vault",
    "test_deposit_and_mint",
    "test_mint_too_much_fails",
    "test_repay_and_withdraw",
    "test_liquidation",
  ]},
  { suite: "Circuit Breaker", tests: [
    "test_normal_deposit_withdraw",
    "test_large_withdrawal_triggers_rate_limit",
    "test_claim_locked_funds_after_cooldown",
    "test_kill_switch_blocks_withdrawals",
    "test_owner_override_rate_limit",
    "test_owner_update_parameters",
  ]},
  { suite: "ZK Proof", tests: [
    "test_submit_bn128_root",
    "test_submit_bn128_root_not_owner",
    "test_register_for_demo",
    "test_withdraw_with_proof_success",
    "test_withdraw_with_proof_double_spend",
    "test_withdraw_with_proof_unapproved_recipient",
    "test_withdraw_with_proof_wrong_root",
    "test_is_bn128_spent_initially_false",
    "test_get_bn128_root_initially_zero",
    "test_bn128_root_history_buffer",
    "test_approved_user_still_cannot_submit_bn128_root",
    "test_demo_mode_off_by_default",
  ]},
  { suite: "Oracle", tests: [
    "test_refresh_from_pragma_updates_price",
    "test_refresh_from_pragma_future_timestamp_fails",
  ]},
];

export function TestResults() {
  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-400" />
          <p className="text-sm text-void-200 font-medium">
            32 tests passing
          </p>
        </div>
        <span className="text-[10px] font-[family-name:var(--font-mono)] text-green-400/60 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/15">
          snforge test
        </span>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {tests.map((suite) => (
          <div key={suite.suite}>
            <p className="text-[10px] font-[family-name:var(--font-mono)] text-void-500 uppercase tracking-widest mb-2">
              {suite.suite} ({suite.tests.length})
            </p>
            <div className="space-y-1">
              {suite.tests.map((test) => (
                <div key={test} className="flex items-center gap-2">
                  <span className="text-green-400 text-[10px] font-[family-name:var(--font-mono)]">PASS</span>
                  <span className="text-[11px] font-[family-name:var(--font-mono)] text-void-400 truncate">
                    {test}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
