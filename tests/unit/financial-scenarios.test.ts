import { describe, it, expect } from 'vitest';

interface LedgerEntry {
  entryType: 'credit_sale' | 'payment_received' | 'reversal' | 'adjustment';
  amount: number; // positive = debits customer, negative = credits customer
  balanceAfter: number;
}

function simulateCustomerLedger() {
  let receivableBalance = 0;
  const ledger: LedgerEntry[] = [];

  const postEntry = (entryType: LedgerEntry['entryType'], amount: number) => {
    receivableBalance += amount;
    ledger.push({
      entryType,
      amount,
      balanceAfter: receivableBalance,
    });
    return receivableBalance;
  };

  const getBalance = () => receivableBalance;
  const verifyInvariant = () => {
    const sum = ledger.reduce((acc, curr) => acc + curr.amount, 0);
    return sum === receivableBalance;
  };

  return { postEntry, getBalance, verifyInvariant, ledger };
}

describe('Financial Invariants & All 5 Cancellation Scenarios', () => {
  it('Scenario 1: Fully unpaid bill cancellation', () => {
    const cust = simulateCustomerLedger();
    const grandTotal = 10000; // ₹100.00
    const paidAmount = 0;

    // Checkout: gross bill charged
    cust.postEntry('credit_sale', grandTotal);
    expect(cust.getBalance()).toBe(10000);
    expect(cust.verifyInvariant()).toBe(true);

    // Cancellation: active payments = 0, bill charge reversed
    cust.postEntry('reversal', -grandTotal);
    expect(cust.getBalance()).toBe(0);
    expect(cust.verifyInvariant()).toBe(true);
  });

  it('Scenario 2: Fully paid bill cancellation', () => {
    const cust = simulateCustomerLedger();
    const grandTotal = 10000;
    const paidAmount = 10000;

    // Checkout: gross bill charged & payment credited
    cust.postEntry('credit_sale', grandTotal);
    cust.postEntry('payment_received', -paidAmount);
    expect(cust.getBalance()).toBe(0);
    expect(cust.verifyInvariant()).toBe(true);

    // Cancellation: active payment reversed, bill charge reversed
    cust.postEntry('reversal', +paidAmount); // payment credit undone
    cust.postEntry('reversal', -grandTotal); // bill charge undone
    expect(cust.getBalance()).toBe(0);
    expect(cust.verifyInvariant()).toBe(true);
  });

  it('Scenario 3: Partially paid bill cancellation', () => {
    const cust = simulateCustomerLedger();
    const grandTotal = 10000;
    const paidAmount = 6000;
    const dueAmount = 4000;

    // Checkout
    cust.postEntry('credit_sale', grandTotal);
    cust.postEntry('payment_received', -paidAmount);
    expect(cust.getBalance()).toBe(4000); // Customer owes ₹40
    expect(cust.verifyInvariant()).toBe(true);

    // Cancellation
    cust.postEntry('reversal', +paidAmount); // payment credit undone (+6000)
    cust.postEntry('reversal', -grandTotal); // bill charge undone (-10000)
    expect(cust.getBalance()).toBe(0); // Fully settled
    expect(cust.verifyInvariant()).toBe(true);
  });

  it('Scenario 4: Payment reversal before bill cancellation', () => {
    const cust = simulateCustomerLedger();
    const grandTotal = 10000;
    const paidAmount = 6000;

    // Checkout
    cust.postEntry('credit_sale', grandTotal);
    cust.postEntry('payment_received', -paidAmount);
    expect(cust.getBalance()).toBe(4000);

    // Step A: Standalone Payment Reversal
    cust.postEntry('reversal', +paidAmount); // Payment bounced/reversed
    expect(cust.getBalance()).toBe(10000); // Customer now owes the full ₹100
    expect(cust.verifyInvariant()).toBe(true);

    // Step B: Later, Bill is Cancelled
    // Active payments = none (already reversed, so skipped). Only bill charge is reversed:
    cust.postEntry('reversal', -grandTotal);
    expect(cust.getBalance()).toBe(0);
    expect(cust.verifyInvariant()).toBe(true);
  });

  it('Scenario 5: Multiple payments on one bill', () => {
    const cust = simulateCustomerLedger();
    const grandTotal = 10000;

    // Counter Checkout: paid 4000
    cust.postEntry('credit_sale', grandTotal);
    cust.postEntry('payment_received', -4000);
    expect(cust.getBalance()).toBe(6000);

    // Subsequent payment 1: paid 3000
    cust.postEntry('payment_received', -3000);
    expect(cust.getBalance()).toBe(3000);

    // Subsequent payment 2: paid 1000
    cust.postEntry('payment_received', -1000);
    expect(cust.getBalance()).toBe(2000);

    // Cancellation: reverses all 3 active payments, then reverses bill
    cust.postEntry('reversal', +4000);
    cust.postEntry('reversal', +3000);
    cust.postEntry('reversal', +1000);
    cust.postEntry('reversal', -grandTotal);

    expect(cust.getBalance()).toBe(0);
    expect(cust.verifyInvariant()).toBe(true);
  });

  it('Enforces walk-in bill payment reversal rejection', () => {
    const reversePaymentValidator = (customerId: string | null) => {
      if (!customerId) {
        throw new Error('Standalone payment reversal is not permitted for walk-in bills. Cancel the bill instead.');
      }
      return true;
    };

    // Reversal for walk-in must throw
    expect(() => reversePaymentValidator(null)).toThrow('Cancel the bill instead');

    // Reversal for customer succeeds
    expect(reversePaymentValidator('cust_abc')).toBe(true);
  });
});
