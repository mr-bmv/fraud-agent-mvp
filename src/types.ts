export interface Transaction {
  id: number;
  transaction_date: string;
  amount: string;
  sender: string;
  receiver: string;
  is_flagged: boolean | null;
  created_at?: string | null;
}

export interface TransactionsTableProps {
  transactions: Transaction[];
}

export interface FlaggedTransaction {
  id: number | string;
  reason: string;
  risk_level: string;
}
