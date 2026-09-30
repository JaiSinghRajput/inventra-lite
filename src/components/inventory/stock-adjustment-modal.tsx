import React, { useState, useEffect } from 'react';
import { SlidersHorizontal, Plus, Minus, AlertCircle, ArrowRight, Check, Keyboard, Hash, Calculator, Delete, Phone } from 'lucide-react';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { formatQuantity, parseCleanQuantity } from '../../lib/quantity';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: string;
    name: string;
    sku: string;
    unit: string;
    stockQuantity: string | number;
    imageUrl?: string | null;
  } | null;
  onConfirm: (productId: string, delta: number, reason: string) => Promise<void>;
  isLoading?: boolean;
}

type AdjustmentMode = 'direct' | 'delta';
type KeyboardMode = 'tel' | 'standard' | 'numeric' | 'onscreen';

export function StockAdjustmentModal({
  isOpen,
  onClose,
  product,
  onConfirm,
  isLoading = false,
}: StockAdjustmentModalProps) {
  if (!product) return null;

  const currentStock = parseCleanQuantity(product.stockQuantity);
  const unit = product.unit || 'pcs';

  // Mode: 'direct' (replace existing count) or 'delta' (+ / - addition/deduction)
  const [mode, setMode] = useState<AdjustmentMode>('direct');
  
  // Direct new stock count
  const [directCount, setDirectCount] = useState<string>(formatQuantity(currentStock));

  // Delta mode state
  const [deltaSign, setDeltaSign] = useState<'+' | '-'>('+');
  const [deltaAmount, setDeltaAmount] = useState<string>('');

  // Keyboard mode: 'tel' (dialer with + and - keys), 'standard' (full text keyboard), 'numeric' (0-9 pad), or 'onscreen' (built-in touch pad)
  const [keyboardMode, setKeyboardMode] = useState<KeyboardMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('inventra_stock_adj_keyboard_mode');
      if (saved === 'tel' || saved === 'standard' || saved === 'numeric' || saved === 'onscreen') {
        return saved;
      }
    }
    return 'tel';
  });

  const handleSetKeyboardMode = (m: KeyboardMode) => {
    setKeyboardMode(m);
    try {
      localStorage.setItem('inventra_stock_adj_keyboard_mode', m);
    } catch {
      // ignore
    }
  };

  // Audit reason
  const [reason, setReason] = useState<string>('Physical count audit');
  const [customReason, setCustomReason] = useState<string>('');
  const [error, setError] = useState<string>('');

  // When modal opens or product changes, reset to current stock
  useEffect(() => {
    if (isOpen && product) {
      setDirectCount(formatQuantity(currentStock));
      setDeltaAmount('');
      setDeltaSign('+');
      setReason('Physical count audit');
      setCustomReason('');
      setError('');
    }
  }, [isOpen, product]);

  // Keypad button press handler
  const handleKeypadPress = (key: string) => {
    if (mode === 'direct') {
      if (key === 'BACKSPACE') {
        setDirectCount((prev) => (prev.length > 1 ? prev.slice(0, -1) : ''));
      } else if (key === 'CLEAR') {
        setDirectCount('');
      } else if (key === '.') {
        if (!directCount.includes('.')) {
          setDirectCount((prev) => (prev === '' ? '0.' : prev + '.'));
        }
      } else {
        setDirectCount((prev) => (prev === '0' ? key : prev + key));
      }
    } else {
      if (key === 'BACKSPACE') {
        setDeltaAmount((prev) => (prev.length > 1 ? prev.slice(0, -1) : ''));
      } else if (key === 'CLEAR') {
        setDeltaAmount('');
      } else if (key === '.') {
        if (!deltaAmount.includes('.')) {
          setDeltaAmount((prev) => (prev === '' ? '0.' : prev + '.'));
        }
      } else {
        setDeltaAmount((prev) => (prev === '0' ? key : prev + key));
      }
    }
  };

  // Direct count input handler (sanitizes non-numeric chars)
  const handleDirectChange = (val: string) => {
    let clean = val.replace(/[^0-9.]/g, '');
    const parts = clean.split('.');
    if (parts.length > 2) {
      clean = `${parts[0]}.${parts.slice(1).join('')}`;
    }
    setDirectCount(clean);
  };

  // Delta amount input handler (auto-detects +/- signs if typed on keyboard)
  const handleDeltaChange = (val: string) => {
    let text = val;
    if (text.includes('-')) {
      setDeltaSign('-');
      text = text.replace(/-/g, '');
    } else if (text.includes('+')) {
      setDeltaSign('+');
      text = text.replace(/\+/g, '');
    }
    let clean = text.replace(/[^0-9.]/g, '');
    const parts = clean.split('.');
    if (parts.length > 2) {
      clean = `${parts[0]}.${parts.slice(1).join('')}`;
    }
    setDeltaAmount(clean);
  };

  // Calculate resulting new balance and delta
  let computedNewBalance = currentStock;
  let computedDelta = 0;

  if (mode === 'direct') {
    const parsedDirect = parseCleanQuantity(directCount);
    computedNewBalance = parsedDirect;
    computedDelta = parsedDirect - currentStock;
  } else {
    const parsedAmount = parseCleanQuantity(deltaAmount);
    computedDelta = deltaSign === '+' ? parsedAmount : -parsedAmount;
    computedNewBalance = currentStock + computedDelta;
  }

  const handleQuickDeltaChip = (val: number) => {
    if (mode === 'direct') {
      const currentVal = parseCleanQuantity(directCount);
      const nextVal = Math.max(0, currentVal + val);
      setDirectCount(formatQuantity(nextVal));
    } else {
      if (val < 0) {
        setDeltaSign('-');
        setDeltaAmount(Math.abs(val).toString());
      } else {
        setDeltaSign('+');
        setDeltaAmount(val.toString());
      }
    }
  };

  const commonReasons = [
    'Physical count audit',
    'Damaged / broken item',
    'Expired stock write-off',
    'Found extra inventory',
    'Supplier correction',
    'Other / Custom',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (computedNewBalance < 0) {
      setError(`Cannot reduce stock below 0. Resulting balance would be ${computedNewBalance} ${unit}.`);
      return;
    }

    if (Math.abs(computedDelta) < 0.0001) {
      setError('Stock quantity has not changed. Please specify a new quantity or delta.');
      return;
    }

    const finalReason = reason === 'Other / Custom' ? customReason.trim() : reason.trim();
    if (!finalReason || finalReason.length < 3) {
      setError('A valid audit reason (at least 3 characters) is mandatory.');
      return;
    }

    try {
      await onConfirm(product.id, computedDelta, finalReason);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to adjust stock');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Stock Adjustment: ${product.name}`}
      description={`SKU: ${product.sku} • Current Stock: ${formatQuantity(currentStock)} ${unit}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMode('direct')}
            className={`py-2 px-3 rounded-lg transition-all ${
              mode === 'direct'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Direct Quantity (Replace)
          </button>
          <button
            type="button"
            onClick={() => setMode('delta')}
            className={`py-2 px-3 rounded-lg transition-all ${
              mode === 'delta'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Add / Deduct (+ / -)
          </button>
        </div>

        {/* MODE 1: DIRECT QUANTITY (REPLACE EXISTING) */}
        {mode === 'direct' ? (
          <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800">
                New Physical Stock Count ({unit}) *
              </label>
              <span className="text-[11px] text-brand-600 font-medium">Replaces existing quantity</span>
            </div>

            {/* Keyboard Mode Selector */}
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-medium text-slate-500">Keypad Style:</span>
              <div className="inline-flex rounded-lg bg-slate-200/80 p-0.5 text-[10px] sm:text-[11px] font-medium">
                <button
                  type="button"
                  onClick={() => handleSetKeyboardMode('tel')}
                  className={`px-2 py-0.5 rounded-md transition-all flex items-center gap-1 ${
                    keyboardMode === 'tel'
                      ? 'bg-white text-brand-700 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Phone dialer keypad with + and - keys"
                >
                  <Phone className="w-3 h-3" />
                  Tel (+ / -)
                </button>
                <button
                  type="button"
                  onClick={() => handleSetKeyboardMode('standard')}
                  className={`px-2 py-0.5 rounded-md transition-all flex items-center gap-1 ${
                    keyboardMode === 'standard'
                      ? 'bg-white text-brand-700 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Full standard keyboard"
                >
                  <Keyboard className="w-3 h-3" />
                  Standard
                </button>
                <button
                  type="button"
                  onClick={() => handleSetKeyboardMode('onscreen')}
                  className={`px-2 py-0.5 rounded-md transition-all flex items-center gap-1 ${
                    keyboardMode === 'onscreen'
                      ? 'bg-white text-brand-700 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="On-screen touch pad without virtual keyboard"
                >
                  <Calculator className="w-3 h-3" />
                  Touch Pad
                </button>
              </div>
            </div>

            <div className="relative">
              <input
                type={keyboardMode === 'tel' ? 'tel' : 'text'}
                inputMode={
                  keyboardMode === 'onscreen'
                    ? 'none'
                    : keyboardMode === 'numeric'
                    ? 'numeric'
                    : keyboardMode === 'standard'
                    ? 'text'
                    : 'tel'
                }
                readOnly={keyboardMode === 'onscreen'}
                value={directCount}
                onChange={(e) => handleDirectChange(e.target.value)}
                onFocus={(e) => {
                  if (keyboardMode !== 'onscreen') {
                    e.target.select();
                  }
                }}
                placeholder="0"
                autoFocus={keyboardMode !== 'onscreen'}
                className="w-full text-2xl font-black py-2.5 px-14 rounded-xl border-2 border-brand-500 bg-white text-slate-900 text-center tracking-wide focus:outline-none focus:ring-4 focus:ring-brand-500/20 shadow-inner"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 font-bold text-xs uppercase select-none pointer-events-none">
                {unit}
              </span>
            </div>

            {/* On-Screen Touch Numpad */}
            {keyboardMode === 'onscreen' && (
              <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <div className="grid grid-cols-3 gap-1.5">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => handleKeypadPress(digit)}
                      className="h-10 text-base font-bold bg-slate-50 text-slate-800 rounded-lg border border-slate-200 hover:bg-slate-100 active:bg-brand-50 active:border-brand-300 transition-colors flex items-center justify-center cursor-pointer"
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleKeypadPress('BACKSPACE')}
                    className="h-10 text-xs font-bold bg-slate-100 text-slate-700 rounded-lg border border-slate-200 hover:bg-slate-200 active:bg-slate-300 transition-colors flex items-center justify-center cursor-pointer"
                    title="Backspace"
                  >
                    <Delete className="w-4 h-4 text-slate-700" />
                  </button>
                </div>
                <div className="flex items-center justify-between pt-2 px-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => handleKeypadPress('CLEAR')}
                    className="font-semibold text-rose-600 hover:text-rose-700 hover:underline"
                  >
                    Clear Input
                  </button>
                  <span className="text-[10px] text-slate-400">Touch Numpad Active</span>
                </div>
              </div>
            )}

            {/* Quick Nudge Buttons for Direct Mode */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">Quick:</span>
              <button
                type="button"
                onClick={() => setDirectCount('0')}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 transition-colors"
              >
                0 (Out of stock)
              </button>
              <button
                type="button"
                onClick={() => handleQuickDeltaChip(-1)}
                className="px-2 py-1 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
              >
                -1
              </button>
              <button
                type="button"
                onClick={() => handleQuickDeltaChip(+1)}
                className="px-2 py-1 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
              >
                +1
              </button>
              <button
                type="button"
                onClick={() => handleQuickDeltaChip(+5)}
                className="px-2 py-1 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
              >
                +5
              </button>
              <button
                type="button"
                onClick={() => handleQuickDeltaChip(+10)}
                className="px-2 py-1 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
              >
                +10
              </button>
            </div>
          </div>
        ) : (
          /* MODE 2: DELTA ADD / DEDUCT (+ / -) */
          <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800">
                Adjustment Operation & Quantity *
              </label>
              <span className="text-[11px] text-slate-500">Add or deduct units</span>
            </div>

            {/* Dedicated + Add / - Deduct Toggle */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDeltaSign('+')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                  deltaSign === '+'
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                Add to Stock
              </button>
              <button
                type="button"
                onClick={() => setDeltaSign('-')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                  deltaSign === '-'
                    ? 'bg-rose-600 border-rose-600 text-white shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Minus className="w-3.5 h-3.5" />
                Deduct from Stock
              </button>
            </div>

            {/* Keyboard Mode Selector */}
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-medium text-slate-500">Keypad Style:</span>
              <div className="inline-flex rounded-lg bg-slate-200/80 p-0.5 text-[10px] sm:text-[11px] font-medium">
                <button
                  type="button"
                  onClick={() => handleSetKeyboardMode('tel')}
                  className={`px-2 py-0.5 rounded-md transition-all flex items-center gap-1 ${
                    keyboardMode === 'tel'
                      ? 'bg-white text-brand-700 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Phone dialer keypad with + and - keys"
                >
                  <Phone className="w-3 h-3" />
                  Tel (+ / -)
                </button>
                <button
                  type="button"
                  onClick={() => handleSetKeyboardMode('standard')}
                  className={`px-2 py-0.5 rounded-md transition-all flex items-center gap-1 ${
                    keyboardMode === 'standard'
                      ? 'bg-white text-brand-700 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Full standard keyboard"
                >
                  <Keyboard className="w-3 h-3" />
                  Standard
                </button>
                <button
                  type="button"
                  onClick={() => handleSetKeyboardMode('onscreen')}
                  className={`px-2 py-0.5 rounded-md transition-all flex items-center gap-1 ${
                    keyboardMode === 'onscreen'
                      ? 'bg-white text-brand-700 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="On-screen touch pad without virtual keyboard"
                >
                  <Calculator className="w-3 h-3" />
                  Touch Pad
                </button>
              </div>
            </div>

            <div className="relative">
              <input
                type={keyboardMode === 'tel' ? 'tel' : 'text'}
                inputMode={
                  keyboardMode === 'onscreen'
                    ? 'none'
                    : keyboardMode === 'numeric'
                    ? 'numeric'
                    : keyboardMode === 'standard'
                    ? 'text'
                    : 'tel'
                }
                readOnly={keyboardMode === 'onscreen'}
                value={deltaAmount}
                onChange={(e) => handleDeltaChange(e.target.value)}
                onFocus={(e) => {
                  if (keyboardMode !== 'onscreen') {
                    e.target.select();
                  }
                }}
                placeholder="0"
                autoFocus={keyboardMode !== 'onscreen'}
                className="w-full text-2xl font-black py-2.5 px-14 rounded-xl border-2 border-slate-300 bg-white text-slate-900 text-center tracking-wide focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20 shadow-inner"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 font-bold text-xs uppercase select-none pointer-events-none">
                {unit}
              </span>
            </div>

            {/* On-Screen Touch Numpad */}
            {keyboardMode === 'onscreen' && (
              <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <div className="grid grid-cols-3 gap-1.5">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => handleKeypadPress(digit)}
                      className="h-10 text-base font-bold bg-slate-50 text-slate-800 rounded-lg border border-slate-200 hover:bg-slate-100 active:bg-brand-50 active:border-brand-300 transition-colors flex items-center justify-center cursor-pointer"
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleKeypadPress('BACKSPACE')}
                    className="h-10 text-xs font-bold bg-slate-100 text-slate-700 rounded-lg border border-slate-200 hover:bg-slate-200 active:bg-slate-300 transition-colors flex items-center justify-center cursor-pointer"
                    title="Backspace"
                  >
                    <Delete className="w-4 h-4 text-slate-700" />
                  </button>
                </div>
                <div className="flex items-center justify-between pt-2 px-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => handleKeypadPress('CLEAR')}
                    className="font-semibold text-rose-600 hover:text-rose-700 hover:underline"
                  >
                    Clear Input
                  </button>
                  <span className="text-[10px] text-slate-400">Touch Numpad Active</span>
                </div>
              </div>
            )}

            {/* Quick Delta Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">Presets:</span>
              {[1, 5, 10, 25, 50].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setDeltaAmount(num.toString())}
                  className="px-2 py-1 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                >
                  {deltaSign}{num}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Live Calculation Preview Card */}
        <div className="p-3 rounded-xl bg-slate-900 text-white flex items-center justify-between text-xs">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Current</span>
            <span className="font-bold text-sm text-slate-300">
              {formatQuantity(currentStock)} {unit}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-2 text-slate-400">
            <ArrowRight className="w-4 h-4 text-brand-400" />
            <span
              className={`font-mono text-xs px-2 py-0.5 rounded font-bold ${
                computedDelta > 0
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : computedDelta < 0
                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {computedDelta > 0 ? `+${formatQuantity(computedDelta)}` : formatQuantity(computedDelta)} {unit}
            </span>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">New Balance</span>
            <span
              className={`font-black text-base ${
                computedNewBalance < 0
                  ? 'text-rose-400'
                  : computedNewBalance === 0
                  ? 'text-amber-300'
                  : 'text-emerald-400'
              }`}
            >
              {formatQuantity(computedNewBalance)} {unit}
            </span>
          </div>
        </div>

        {/* Audit Reason */}
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1.5">
            Audit Reason (Mandatory for Inventory Log) *
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {commonReasons.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                  reason === r
                    ? 'bg-brand-50 border-brand-300 text-brand-700 font-semibold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {reason === 'Other / Custom' ? (
            <input
              type="text"
              placeholder="Explain the reason for stock adjustment..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
              required
              autoFocus
            />
          ) : null}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={isLoading}
            disabled={computedNewBalance < 0 || Math.abs(computedDelta) < 0.0001}
            className="shadow-sm"
          >
            <Check className="w-4 h-4" />
            Apply Adjustment
          </Button>
        </div>
      </form>
    </Modal>
  );
}
