import type { TransactionsTableProps } from '../types';

function formatDate(value: string): string {
  return new Date(value).toLocaleString('ru-RU');
}

function formatAmount(value: string): string {
  const amount = Number(value);
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
  }).format(amount);
}

export function TransactionsTable({ transactions }: TransactionsTableProps) {
  if (transactions.length === 0) {
    return <p className="empty">Транзакции не найдены</p>;
  }

  return (
    <table className="transactions-table">
      <thead>
        <tr>
          <th>Дата</th>
          <th>Сумма</th>
          <th>Отправитель</th>
          <th>Получатель</th>
        </tr>
      </thead>
      <tbody>
        {transactions.map((transaction) => (
          <tr key={transaction.id}>
            <td>{formatDate(transaction.transaction_date)}</td>
            <td>
              {formatAmount(transaction.amount)}
              {transaction.is_flagged && (
                <span className="flagged-badge">Flagged</span>
              )}
            </td>
            <td>{transaction.sender}</td>
            <td>{transaction.receiver}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}