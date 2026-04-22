import React, { useState } from 'react';
import { Wallet, ArrowUpRight, ArrowDownLeft, CreditCard, Landmark, Coins, History, ShieldCheck, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface AssetsProps {
  user: any;
  balance: number;
  setBalance: (balance: number) => void;
  transactions: any[];
  onTransaction?: (tx: any) => void;
}

export function Assets({ user, balance, setBalance, transactions, onTransaction }: AssetsProps) {
  const [activeAction, setActiveAction] = useState<'deposit' | 'withdraw' | 'overview'>('overview');
  const [selectedMethod, setSelectedMethod] = useState<'Card' | 'Bank' | 'Crypto'>('Card');
  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleConfirm = async () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return;

    if (activeAction === 'withdraw' && val > balance) {
      alert('Insufficient balance');
      return;
    }

    setIsProcessing(true);

    try {
      const newBalance = activeAction === 'deposit' ? balance + val : balance - val;
      
      const txData = {
        userId: user.uid,
        type: activeAction,
        label: `${activeAction.charAt(0).toUpperCase() + activeAction.slice(1)} via ${selectedMethod}`,
        amount: val,
        displayAmount: `${activeAction === 'deposit' ? '+' : '-'}$${val.toFixed(2)}`,
        status: 'COMPLETED',
        timestamp: Date.now()
      };

      // Notify parent for persistence
      onTransaction?.({ ...txData, balance: newBalance });
      
      setBalance(newBalance);
      setAmount('');
      setActiveAction('overview');

      // Firebase update (optional)
      try {
        await addDoc(collection(db, 'transactions'), {
          ...txData,
          createdAt: serverTimestamp()
        });
      } catch (e) {
        console.warn('Firebase transaction failed (expected if offline/mock):', e);
      }
    } catch (error) {
      console.error('Transaction processing error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Balance Card */}
        <div className="lg:col-span-2 bg-gradient-to-br from-brand to-rose-600 rounded-3xl md:rounded-[2rem] p-6 md:p-8 text-white shadow-2xl relative overflow-hidden min-h-[240px] md:min-h-0">
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2 opacity-80">
                <Wallet className="w-4 h-4" />
                <span className="text-[10px] md:text-sm font-medium uppercase tracking-widest">Total Balance</span>
              </div>
              <h3 className="text-3xl md:text-5xl font-bold tracking-tight mb-2 md:mb-4 font-mono">
                ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs md:text-base">
                <ArrowUpRight className="w-4 h-4" />
                <span>+4.2% ($520.50) today</span>
              </div>
            </div>
            
            <div className="flex gap-3 md:gap-4 mt-8 md:mt-12">
              <button 
                onClick={() => setActiveAction('deposit')}
                className="flex-1 py-3 md:py-4 bg-white text-brand rounded-xl md:rounded-2xl font-bold text-sm md:text-base flex items-center justify-center gap-2 hover:bg-white/90 transition-all active:scale-95"
              >
                <ArrowDownLeft className="w-4 h-4 md:w-5 md:h-5" />
                Deposit
              </button>
              <button 
                onClick={() => setActiveAction('withdraw')}
                className="flex-1 py-3 md:py-4 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-xl md:rounded-2xl font-bold text-sm md:text-base flex items-center justify-center gap-2 hover:bg-white/20 transition-all active:scale-95"
              >
                <ArrowUpRight className="w-4 h-4 md:w-5 md:h-5" />
                Withdraw
              </button>
            </div>
          </div>
          
          {/* Decorative elements */}
          <div className="absolute -top-20 -right-20 w-48 md:w-64 h-48 md:h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-48 md:w-64 h-48 md:h-64 bg-black/10 rounded-full blur-3xl" />
        </div>

        {/* Security Status */}
        <div className="bg-card border border-border rounded-3xl md:rounded-[2rem] p-6 md:p-8 flex flex-col justify-center items-center text-center space-y-3 md:space-y-4 shadow-xl">
          <div className="w-12 h-12 md:w-16 md:h-16 bg-bullish/10 rounded-full flex items-center justify-center mb-1 md:mb-2">
            <ShieldCheck className="w-6 h-6 md:w-8 md:h-8 text-bullish" />
          </div>
          <h4 className="text-lg md:text-xl font-bold text-text-primary">Account Verified</h4>
          <p className="text-xs md:text-sm text-text-secondary">Your account is fully secured and verified. You have full access to all withdrawal methods.</p>
          <button className="text-brand text-xs md:text-sm font-bold hover:underline">View Security Settings</button>
        </div>
      </div>

      {activeAction === 'overview' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {/* Asset Breakdown */}
          <div className="bg-card border border-border rounded-3xl md:rounded-[2rem] p-6 md:p-8 shadow-xl">
            <h4 className="text-base md:text-lg font-bold text-text-primary mb-6 flex items-center gap-2">
              <Coins className="w-5 h-5 text-brand" />
              Asset Breakdown
            </h4>
            <div className="space-y-6">
              <AssetItem label="US Dollar" amount={`$${(balance * 0.65).toLocaleString()}`} percent={65} color="bg-brand" />
              <AssetItem label="Bitcoin" amount={`$${(balance * 0.25).toLocaleString()}`} percent={25} color="bg-amber-500" />
              <AssetItem label="Ethereum" amount={`$${(balance * 0.10).toLocaleString()}`} percent={10} color="bg-indigo-500" />
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-card border border-border rounded-3xl md:rounded-[2rem] p-6 md:p-8 shadow-xl">
            <h4 className="text-base md:text-lg font-bold text-text-primary mb-6 flex items-center gap-2">
              <History className="w-5 h-5 text-brand" />
              Recent Transactions
            </h4>
            <div className="space-y-4">
              {transactions.length === 0 ? (
                <div className="text-center py-8 text-text-muted italic text-xs">No transactions yet.</div>
              ) : (
                transactions.slice(0, 5).map((tx, i) => (
                  <TransactionItem 
                    key={tx.id || i} 
                    type={tx.type}
                    label={tx.label}
                    amount={tx.displayAmount}
                    date={tx.timestamp ? new Date(tx.timestamp).toLocaleString() : 'Just now'} 
                  />
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-3xl md:rounded-[2rem] p-6 md:p-8 shadow-xl max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h4 className="text-xl md:text-2xl font-bold text-text-primary capitalize">{activeAction} Funds</h4>
            <button 
              onClick={() => setActiveAction('overview')}
              className="text-xs md:text-sm text-text-muted hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
          </div>

          <div className="space-y-6 md:space-y-8">
            <div>
              <label className="text-[10px] md:text-xs font-bold text-text-muted uppercase tracking-widest mb-3 block">Select Method</label>
              <div className="grid grid-cols-3 gap-2 md:gap-4">
                <MethodButton 
                  icon={CreditCard} 
                  label="Card" 
                  active={selectedMethod === 'Card'} 
                  onClick={() => setSelectedMethod('Card')}
                />
                <MethodButton 
                  icon={Landmark} 
                  label="Bank" 
                  active={selectedMethod === 'Bank'} 
                  onClick={() => setSelectedMethod('Bank')}
                />
                <MethodButton 
                  icon={Coins} 
                  label="Crypto" 
                  active={selectedMethod === 'Crypto'} 
                  onClick={() => setSelectedMethod('Crypto')}
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] md:text-xs font-bold text-text-muted uppercase tracking-widest mb-3 block">Amount</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl md:text-2xl font-bold text-text-muted">$</span>
                <input 
                  type="number" 
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl md:rounded-2xl py-4 md:py-5 pl-10 pr-4 text-2xl md:text-3xl font-bold text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/50 transition-all"
                />
              </div>
            </div>

            <button 
              onClick={handleConfirm}
              disabled={isProcessing || !amount}
              className="w-full py-4 md:py-5 bg-brand text-white rounded-xl md:rounded-2xl font-bold text-base md:text-lg shadow-xl shadow-brand/20 hover:bg-brand-hover transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {isProcessing && <RefreshCw className="w-5 h-5 animate-spin" />}
              {isProcessing ? 'Processing...' : `Confirm ${activeAction}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AssetItem({ label, amount, percent, color }: any) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className="text-sm font-bold text-foreground">{amount}</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function TransactionItem({ type, label, amount, date }: any) {
  return (
    <div className="flex items-center justify-between p-4 rounded-2xl bg-secondary/30 border border-border/50">
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center",
          type === 'deposit' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
        )}>
          {type === 'deposit' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
        </div>
        <div>
          <div className="text-sm font-bold text-foreground">{label}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest">{date}</div>
        </div>
      </div>
      <div className={cn("font-bold", type === 'deposit' ? "text-emerald-500" : "text-rose-500")}>
        {amount}
      </div>
    </div>
  );
}

function MethodButton({ icon: Icon, label, active, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-2 md:gap-3 p-3 md:p-6 rounded-2xl border transition-all",
        active 
          ? "bg-brand/10 border-brand text-brand" 
          : "bg-secondary/30 border-border text-muted-foreground hover:bg-secondary/50"
      )}
    >
      <Icon className="w-5 h-5 md:w-6 md:h-6" />
      <span className="text-[9px] md:text-xs font-bold uppercase tracking-widest whitespace-nowrap">{label}</span>
    </button>
  );
}
