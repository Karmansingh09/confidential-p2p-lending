import type {
  ContractStateInspectionRequest,
  ContractStateInspectionResult,
  ContractStateSnapshot,
} from '../types/contract-state-inspection.ts';
import type { LoanRegistry } from './loan-registry.ts';
import { isKnownCircuit, getCircuitDefinition } from './contract-manifest.ts';

/**
 * Read-only contract state provider interface.
 *
 * ARCHITECTURAL PRINCIPLES:
 * 1. READ-ONLY SCOPE: Exclusively inspects contract state; never signs, submits, or mutates state.
 * 2. ANTI-FABRICATION: Local prototype explicitly declares LOCAL_PROTOTYPE and never generates
 *    synthetic block heights, transaction hashes, or fake on-chain confirmations.
 * 3. STRICT PRIVACY: Zero borrower underwriting credentials or secret witnesses.
 */
export interface ContractStateProvider {
  readonly id: string;
  readonly name: string;
  readonly isSupported: boolean;

  /**
   * Returns provider classification kind ('LOCAL_PROTOTYPE', 'MIDNIGHT', etc.).
   */
  getProviderKind(): string;

  /**
   * Indicates whether this provider can perform genuine on-chain state queries.
   */
  isStateQuerySupported(): boolean;

  /**
   * Performs contract-level state inspection.
   */
  inspectContractState(
    request: ContractStateInspectionRequest
  ): Promise<ContractStateInspectionResult>;

  /**
   * Queries circuit-specific state (only valid for read inspection circuits).
   */
  queryCircuitState<T = unknown>(
    circuitName: string,
    params?: Record<string, unknown>
  ): Promise<ContractStateInspectionResult<T>>;

  /**
   * Queries state at a specific ledger reference or historical block.
   */
  getStateAtReference<T = unknown>(
    reference: string,
    options?: Record<string, unknown>
  ): Promise<ContractStateInspectionResult<T>>;
}

/**
 * Local Prototype Contract State Provider.
 *
 * Safely inspects local in-memory simulation state (e.g. LoanRegistry) while strictly
 * preserving that this is NOT authentic on-chain state.
 *
 * CRITICAL INVARIANTS:
 * - Never claims local registry data is on-chain or blockchain-confirmed.
 * - Never generates block heights (always null).
 * - Never generates transaction hashes (always null).
 * - Never reports fake deployment verification.
 */
export class LocalPrototypeContractStateProvider implements ContractStateProvider {
  readonly id = 'prototype-contract-state-provider';
  readonly name = 'Local Prototype Contract State Provider';
  readonly isSupported = true;

  private loanRegistry?: LoanRegistry;

  constructor(loanRegistry?: LoanRegistry) {
    this.loanRegistry = loanRegistry;
  }

  getProviderKind(): string {
    return 'LOCAL_PROTOTYPE';
  }

  isStateQuerySupported(): boolean {
    return false; // Genuine on-chain ledger state query is unsupported in prototype mode
  }

  setLoanRegistry(registry: LoanRegistry): void {
    this.loanRegistry = registry;
  }

  async inspectContractState(
    request: ContractStateInspectionRequest
  ): Promise<ContractStateInspectionResult> {
    const now = Date.now();

    // If circuitName was requested, route to circuit query
    if (request.circuitName) {
      return this.queryCircuitState(request.circuitName, { loanId: request.loanId });
    }

    if (this.loanRegistry) {
      const loans = this.loanRegistry.getLoans();
      const count = Object.keys(loans).length;
      const snapshot: ContractStateSnapshot = {
        contractAddress: request.contractAddress ?? null,
        networkId: request.networkId ?? 'midnight-prototype-local',
        inspectedAt: now,
        blockHeight: null, // NEVER fabricated
        deploymentVerified: false,
        stateAvailable: true,
        status: 'AVAILABLE',
        reason: 'STATE_FOUND',
        stateVersion: 'prototype-v1',
        rawStateReference: null,
        source: 'LOCAL_PROTOTYPE',
        data: { activeLoansCount: count },
      };

      return {
        success: true,
        status: 'AVAILABLE',
        reason: 'STATE_FOUND',
        snapshot,
        data: { activeLoansCount: count },
        message: `Local prototype state inspected (${count} agreements). Not an on-chain ledger state.`,
        source: 'LOCAL_PROTOTYPE',
      };
    }

    const snapshot: ContractStateSnapshot = {
      contractAddress: request.contractAddress ?? null,
      networkId: request.networkId ?? 'midnight-prototype-local',
      inspectedAt: now,
      blockHeight: null, // NEVER fabricated
      deploymentVerified: false,
      stateAvailable: false,
      status: 'UNSUPPORTED',
      reason: 'LOCAL_PROTOTYPE',
      stateVersion: null,
      rawStateReference: null,
      source: 'LOCAL_PROTOTYPE',
      data: null,
    };

    return {
      success: false,
      status: 'UNSUPPORTED',
      reason: 'LOCAL_PROTOTYPE',
      snapshot,
      data: null,
      errorCode: 'LOCAL_PROTOTYPE',
      error: 'Genuine on-chain contract state inspection is unsupported in local prototype mode.',
      message: 'Genuine on-chain contract state inspection is unsupported in local prototype mode.',
      source: 'LOCAL_PROTOTYPE',
    };
  }

  async queryCircuitState<T = unknown>(
    circuitName: string,
    params?: Record<string, unknown>
  ): Promise<ContractStateInspectionResult<T>> {
    const now = Date.now();

    if (!isKnownCircuit(circuitName)) {
      const snapshot: ContractStateSnapshot = {
        contractAddress: null,
        networkId: 'midnight-prototype-local',
        inspectedAt: now,
        blockHeight: null,
        deploymentVerified: false,
        stateAvailable: false,
        status: 'FAILED',
        reason: 'STATE_QUERY_UNSUPPORTED',
        source: 'LOCAL_PROTOTYPE',
        data: null,
      };
      return {
        success: false,
        status: 'FAILED',
        reason: 'STATE_QUERY_UNSUPPORTED',
        snapshot,
        data: null,
        errorCode: 'STATE_QUERY_UNSUPPORTED',
        error: `Circuit "${circuitName}" is not defined in the canonical contract manifest.`,
        message: `Circuit "${circuitName}" is not defined in the canonical contract manifest.`,
        source: 'LOCAL_PROTOTYPE',
      };
    }

    const circuitDef = getCircuitDefinition(circuitName)!;

    // Enforce circuit classification: Only STATE_READ circuits are valid for state inspection
    if (circuitDef.classification === 'TRANSACTION_EXECUTION') {
      const snapshot: ContractStateSnapshot = {
        contractAddress: null,
        networkId: 'midnight-prototype-local',
        inspectedAt: now,
        blockHeight: null,
        deploymentVerified: false,
        stateAvailable: false,
        status: 'FAILED',
        reason: 'STATE_QUERY_UNSUPPORTED',
        source: 'LOCAL_PROTOTYPE',
        data: null,
      };
      return {
        success: false,
        status: 'FAILED',
        reason: 'STATE_QUERY_UNSUPPORTED',
        snapshot,
        data: null,
        errorCode: 'STATE_QUERY_UNSUPPORTED',
        error: `Circuit "${circuitName}" is a transaction-executing circuit and cannot be inspected as state.`,
        message: `Circuit "${circuitName}" is a transaction-executing circuit and cannot be inspected as state.`,
        source: 'LOCAL_PROTOTYPE',
      };
    }

    if (circuitDef.classification === 'LOCAL_PROOF') {
      const snapshot: ContractStateSnapshot = {
        contractAddress: null,
        networkId: 'midnight-prototype-local',
        inspectedAt: now,
        blockHeight: null,
        deploymentVerified: false,
        stateAvailable: false,
        status: 'FAILED',
        reason: 'STATE_QUERY_UNSUPPORTED',
        source: 'LOCAL_PROTOTYPE',
        data: null,
      };
      return {
        success: false,
        status: 'FAILED',
        reason: 'STATE_QUERY_UNSUPPORTED',
        snapshot,
        data: null,
        errorCode: 'STATE_QUERY_UNSUPPORTED',
        error: `Circuit "${circuitName}" is an off-chain local proof circuit, not a contract state query.`,
        message: `Circuit "${circuitName}" is an off-chain local proof circuit, not a contract state query.`,
        source: 'LOCAL_PROTOTYPE',
      };
    }

    // STATE_READ circuit handling via local registry
    const loanId = (params?.loanId as string) ?? undefined;
    if (this.loanRegistry && loanId) {
      const loan = this.loanRegistry.getLoan(loanId);
      if (loan) {
        let extractedData: unknown = loan;
        if (circuitName === 'getLoanStatus') {
          extractedData = {
            status: loan.status,
            isEligibilityVerified: loan.isEligibilityVerified,
          };
        }

        const snapshot: ContractStateSnapshot = {
          contractAddress: null,
          networkId: 'midnight-prototype-local',
          inspectedAt: now,
          blockHeight: null, // NEVER fabricated
          deploymentVerified: false,
          stateAvailable: true,
          status: 'AVAILABLE',
          reason: 'STATE_FOUND',
          stateVersion: 'prototype-v1',
          source: 'LOCAL_PROTOTYPE',
          data: extractedData as Record<string, unknown>,
        };

        return {
          success: true,
          status: 'AVAILABLE',
          reason: 'STATE_FOUND',
          snapshot,
          data: extractedData as T,
          message: `Local prototype simulation state inspected for "${circuitName}". Not an on-chain ledger state.`,
          source: 'LOCAL_PROTOTYPE',
        };
      } else {
        const snapshot: ContractStateSnapshot = {
          contractAddress: null,
          networkId: 'midnight-prototype-local',
          inspectedAt: now,
          blockHeight: null,
          deploymentVerified: false,
          stateAvailable: false,
          status: 'AVAILABLE',
          reason: 'STATE_NOT_FOUND',
          source: 'LOCAL_PROTOTYPE',
          data: null,
        };

        return {
          success: true,
          status: 'AVAILABLE',
          reason: 'STATE_NOT_FOUND',
          snapshot,
          data: null,
          message: `Agreement "${loanId}" was not found in the local prototype registry.`,
          source: 'LOCAL_PROTOTYPE',
        };
      }
    }

    // No registry or loanId provided
    const snapshot: ContractStateSnapshot = {
      contractAddress: null,
      networkId: 'midnight-prototype-local',
      inspectedAt: now,
      blockHeight: null,
      deploymentVerified: false,
      stateAvailable: false,
      status: 'AVAILABLE',
      reason: 'STATE_NOT_FOUND',
      source: 'LOCAL_PROTOTYPE',
      data: null,
    };

    return {
      success: true,
      status: 'AVAILABLE',
      reason: 'STATE_NOT_FOUND',
      snapshot,
      data: null,
      message: `No local registry record available to inspect for circuit "${circuitName}".`,
      source: 'LOCAL_PROTOTYPE',
    };
  }

  async getStateAtReference<T = unknown>(
    reference: string,
    options?: Record<string, unknown>
  ): Promise<ContractStateInspectionResult<T>> {
    const now = Date.now();
    const snapshot: ContractStateSnapshot = {
      contractAddress: null,
      networkId: 'midnight-prototype-local',
      inspectedAt: now,
      blockHeight: null,
      deploymentVerified: false,
      stateAvailable: false,
      status: 'UNSUPPORTED',
      reason: 'LOCAL_PROTOTYPE',
      rawStateReference: reference,
      source: 'LOCAL_PROTOTYPE',
      data: null,
    };

    return {
      success: false,
      status: 'UNSUPPORTED',
      reason: 'LOCAL_PROTOTYPE',
      snapshot,
      data: null,
      errorCode: 'LOCAL_PROTOTYPE',
      error: 'Historical ledger reference state queries are unsupported in local prototype mode.',
      message: 'Historical ledger reference state queries are unsupported in local prototype mode.',
      source: 'LOCAL_PROTOTYPE',
    };
  }
}
