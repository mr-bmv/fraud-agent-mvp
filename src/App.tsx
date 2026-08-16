import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { TransactionsTable } from './components/TransactionsTable';
import type { FlaggedTransaction, Transaction } from './types';
import './App.css';

function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [flagged, setFlagged] = useState<FlaggedTransaction[] | null>(null);

  useEffect(() => {
    async function fetchTransactions() {
      try {
        setLoading(true);
        setError(null);

        const { data, error } = await supabase
          .from('transactions')
          .select('id, transaction_date, amount, sender, receiver, is_flagged')
          .order('transaction_date', { ascending: false });

        if (error) {
          setError(error.message);
          return;
        }

        setTransactions(data ?? []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Неизвестная ошибка загрузки',
        );
      } finally {
        setLoading(false);
      }
    }

    fetchTransactions();
  }, []);

  async function handleAnalyze() {
    try {
      setIsAnalyzing(true);
      setAnalysisError(null);
      setFlagged(null);

      const response = await fetch('/api/analyze', { method: 'POST' });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setAnalysisError(
          body?.error ?? `Ошибка анализа (HTTP ${response.status})`,
        );
        return;
      }

      const body = await response.json();
      setFlagged(Array.isArray(body.flagged) ? body.flagged : []);
    } catch (err) {
      setAnalysisError(
        err instanceof Error ? err.message : 'Неизвестная ошибка анализа',
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <main className="app">
      <h1>Транзакции</h1>

      {loading && <p className="status">Загрузка…</p>}

      {!loading && error && <p className="error">Ошибка: {error}</p>}

      {!loading && !error && (
        <>
          <button
            type="button"
            className="analyze-button"
            onClick={handleAnalyze}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? 'Анализ…' : 'Анализировать транзакции'}
          </button>

          {analysisError && (
            <p className="error">Ошибка анализа: {analysisError}</p>
          )}

          {flagged && flagged.length === 0 && (
            <p className="status">Подозрительных транзакций не найдено.</p>
          )}

          {flagged && flagged.length > 0 && (
            <div className="flagged-list">
              <h2>Подозрительные транзакции</h2>
              {flagged.map((item) => (
                <div
                  key={String(item.id)}
                  className={`flagged-card risk-${item.risk_level}`}
                >
                  <div className="flagged-card-header">
                    <span className="flagged-id">Транзакция #{item.id}</span>
                    <span className="risk-badge">{item.risk_level}</span>
                  </div>
                  <p className="flagged-reason">{item.reason}</p>
                </div>
              ))}
            </div>
          )}

          <TransactionsTable transactions={transactions} />
        </>
      )}
    </main>
  );
}

export default App;