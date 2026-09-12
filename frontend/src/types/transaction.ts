/**
 * Status of a transaction in the network pipeline.
 */
export type TransactionStatus =
  | 'PENDING'
  | 'SUBMITTED'
  | 'CONFIRMED'
  | 'FAILED'
  | 'UNSUPPORTED';

/**
 * Types of operations that can produce on-chain transactions.
 */
export type TransactionCapability =
  | 'TRANSFER_TOKENS'
  | 'CONTRACT_DEPLOY'
  | 'CIRCUIT_EXECUTION_CALL'
  | 'STATE_TRANSITION';

/**
 * Parameter payload for submitting an on-chain action request.
 * STRICT PRIVACY REQUIREMENT:
 * Payload must contain ONLY public ledger arguments and proof outputs.
 * Zero confidential inputs or private witnesses are ever accepted.
 */
export interface TransactionRequest {
  loanId: string;
  action: 'FUND' | 'REPAY' | 'SETTLE' | 'CREATE';
  callerPublicKey: Uint8Array;
  payload?: Record<string, unknown>;
}

/**
 * Result structure returned upon transaction initiation or confirmation.
 * In prototype mode, live transactions are unavailable and no fake hashes are created.
 */
export interface TransactionResult {
  success: boolean;
  status: TransactionStatus;
  transactionId?: string;
  blockHeight?: bigint;
  error?: string;
}
