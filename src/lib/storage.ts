/**
 * Local Storage Service
 * Handles persistent storage of trades and transactions when Firebase is not used.
 */

const TRADES_KEY = 'tradepulse_trades_v1';
const TRANSACTIONS_KEY = 'tradepulse_transactions_v1';
const BALANCE_KEY = 'tradepulse_balance_v1';

export const StorageService = {
  getTrades: () => {
    try {
      const saved = localStorage.getItem(TRADES_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to load trades', e);
      return [];
    }
  },

  saveTrades: (trades: any[]) => {
    localStorage.setItem(TRADES_KEY, JSON.stringify(trades));
  },

  addTrade: (trade: any) => {
    const trades = StorageService.getTrades();
    const existingIndex = trades.findIndex((t: any) => t.id === trade.id);
    if (existingIndex >= 0) {
      trades[existingIndex] = trade;
    } else {
      trades.unshift(trade);
    }
    StorageService.saveTrades(trades);
  },

  getTransactions: () => {
    try {
      const saved = localStorage.getItem(TRANSACTIONS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to load transactions', e);
      return [];
    }
  },

  saveTransactions: (transactions: any[]) => {
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
  },

  addTransaction: (tx: any) => {
    const txs = StorageService.getTransactions();
    txs.unshift({
      ...tx,
      id: tx.id || `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: tx.timestamp || Date.now()
    });
    StorageService.saveTransactions(txs.slice(0, 500)); // Keep last 500
  },

  getBalance: (defaultBalance = 10000) => {
    const saved = localStorage.getItem(BALANCE_KEY);
    return saved ? parseFloat(saved) : defaultBalance;
  },

  saveBalance: (balance: number) => {
    localStorage.setItem(BALANCE_KEY, balance.toString());
  },

  clearAll: () => {
    localStorage.removeItem(TRADES_KEY);
    localStorage.removeItem(TRANSACTIONS_KEY);
    localStorage.removeItem(BALANCE_KEY);
    localStorage.removeItem('tradepulse_user');
  }
};
