import type {
  LoanDetailsModel,
  LoanStatusText,
} from '@contracts';

/**
 * Compact contract enum matching contracts/managed/contract/index.d.ts
 */
export enum LoanStatus {
  requested = 0,
  funded = 1,
  repaid = 2,
  settled = 3,
}

export type { LoanDetailsModel, LoanStatusText };

/**
 * Protocol lifecycle stages reflecting the 5 sequential transitions.
 */
export type ProtocolPhase =
  | 'REQUESTED'
  | 'ELIGIBILITY_VERIFIED'
  | 'FUNDED'
  | 'REPAID'
  | 'SETTLED';

export interface LifecycleStepInfo {
  phase: ProtocolPhase;
  title: string;
  description: string;
  isComplete: boolean;
  isCurrent: boolean;
}

export interface NetworkConnectionState {
  isConnected: boolean;
  networkName: string;
  isMockMode: boolean;
  notice: string;
}
