/**
 * Navigation views and tab identifiers for the Confidential P2P Lending Desk application.
 */
export type NavigationTab =
  | 'landing'
  | 'overview'
  | 'marketplace'
  | 'my-loans'
  | 'loan-details'
  | 'transactions'
  | 'wallet'
  | 'network'
  | 'contract-privacy'
  | 'create-loan';

export interface NavigationItem {
  id: NavigationTab;
  label: string;
  icon?: string;
  badge?: string | number;
  description?: string;
}
