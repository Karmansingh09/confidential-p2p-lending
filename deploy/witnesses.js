/**
 * Deployment Witness Provider for ConfidentialP2PLending.
 *
 * In Midnight Compact contracts, the JavaScript `Contract` class constructor requires
 * a witness implementation at class instantiation time (`new Contract(witnesses)`).
 *
 * CONTRACT BEHAVIOR:
 * - The contract constructor (`initialState`) does NOT query witnesses; it only initializes ledger state.
 * - `getPrivateFinancialValue` is only invoked during client-side circuit execution of `verifyEligibility`.
 *
 * SAFETY INVARIANT:
 * - Uses the canonical null-witness deployment fixture `[context.privateState, 0n]`, exactly matching
 *   `initializeLoanContract` in `contracts/client/eligibility-client.ts` and the contract test suite.
 * - Returning `0n` ensures that if `verifyEligibility` were ever called with deployment fixtures,
 *   the threshold check (`0n >= eligibilityThreshold`) safely fails, preventing any false eligibility grant.
 * - Never accesses, reads, logs, or discloses any wallet secrets, seeds, or private keys.
 */

export default {
  /**
   * @param {import('@midnight-ntwrk/compact-runtime').WitnessContext<any, any>} context
   * @returns {[any, bigint]}
   */
  getPrivateFinancialValue(context) {
    return [context.privateState, 0n];
  },
};
