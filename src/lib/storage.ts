/**
 * Local Storage Service
 * Handles persistent storage of trades and transactions when Firebase is not used.
 */

const TRADES_KEY = 'tradepulse_trades_v1';
const TRANSACTIONS_KEY = 'tradepulse_transactions_v1';
const BALANCE_KEY = 'tradepulse_balance_v1';

const getKeys = (uid?: string) => ({
  trades: uid ? `${TRADES_KEY}_${uid}` : TRADES_KEY,
  transactions: uid ? `${TRANSACTIONS_KEY}_${uid}` : TRANSACTIONS_KEY,
  balance: uid ? `${BALANCE_KEY}_${uid}` : BALANCE_KEY,
});

export const StorageService = {
  getTrades: (uid?: string) => {
    try {
      const keys = getKeys(uid);
      const saved = localStorage.getItem(keys.trades);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to load trades', e);
      return [];
    }
  },

  saveTrades: (trades: any[], uid?: string) => {
    const keys = getKeys(uid);
    localStorage.setItem(keys.trades, JSON.stringify(trades));
  },

  addTrade: (trade: any, uid?: string) => {
    const trades = StorageService.getTrades(uid);
    const existingIndex = trades.findIndex((t: any) => t.id === trade.id);
    if (existingIndex >= 0) {
      trades[existingIndex] = trade;
    } else {
      trades.unshift(trade);
    }
    StorageService.saveTrades(trades, uid);
  },

  getTransactions: (uid?: string) => {
    try {
      const keys = getKeys(uid);
      const saved = localStorage.getItem(keys.transactions);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to load transactions', e);
      return [];
    }
  },

  saveTransactions: (transactions: any[], uid?: string) => {
    const keys = getKeys(uid);
    localStorage.setItem(keys.transactions, JSON.stringify(transactions));
  },

  addTransaction: (tx: any, uid?: string) => {
    const txs = StorageService.getTransactions(uid);
    txs.unshift({
      ...tx,
      id: tx.id || `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: tx.timestamp || Date.now()
    });
    StorageService.saveTransactions(txs.slice(0, 500), uid); // Keep last 500
  },

  getBalance: (uid?: string, defaultBalance = 10000) => {
    const keys = getKeys(uid);
    const saved = localStorage.getItem(keys.balance);
    return saved ? parseFloat(saved) : defaultBalance;
  },

  saveBalance: (balance: number, uid?: string) => {
    const keys = getKeys(uid);
    localStorage.setItem(keys.balance, balance.toString());
  },

  clearAll: () => {
    // Only clear session info, not persistent trading data
    localStorage.removeItem('tradepulse_user');
    // We don't clear the TRADES_KEY etc here anymore as per requested persistence
  }
};
