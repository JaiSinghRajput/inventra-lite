import React, { useState } from 'react';
import { createFileRoute, Link, useRouter, getRouteApi } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Printer, Ban, CreditCard, RotateCcw, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getBillDetailsFn, cancelBillFn } from '../../../../features/billing/server';
import { recordSubsequentPaymentFn, reversePaymentFn } from '../../../../features/payments/server';
import { formatINR, inrToPaise, paiseToINR } from '../../../../lib/currency';
import { PAYMENT_METHODS, type PaymentMethod } from '../../../../lib/constants';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Badge } from '../../../../components/ui/badge';
import { Card } from '../../../../components/ui/card';
import { Modal } from '../../../../components/ui/modal';

const authRoute = getRouteApi('/_auth');

export const Route = createFileRoute('/_auth/billing/$id')({
  loader: async ({ params }) => {
    return await getBillDetailsFn({ data: { id: params.id } });
  },
  errorComponent: ({ error, reset }) => (
    <div className="p-8 text-center max-w-md mx-auto">
      <h3 className="text-lg font-bold text-slate-900 mb-2">Invoice Not Found</h3>
      <p className="text-sm text-slate-500 mb-4">{(error as any)?.message || 'Invoice details could not be loaded.'}</p>
      <div className="flex justify-center gap-3">
        <Button onClick={() => reset()} size="sm">Retry</Button>
        <Link to="/billing">
          <Button variant="outline" size="sm">Back to Invoices</Button>
        </Link>
      </div>
    </div>
  ),
  component: BillDetailComponent,
});

function BillDetailComponent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const data = Route.useLoaderData();

  if (!data?.bill) {
    return (
      <div className="p-8 text-center text-slate-500">
        Bill not found. <Link to="/billing" className="text-brand-600 underline">Return to invoices</Link>
      </div>
    );
  }

  const { bill, items, charges, payments, customer } = data;
  const viewer = authRoute.useLoaderData();
  const storeName = viewer?.tenant?.name || 'Inventra Lite';

  const itemDiscountsTotal = items.reduce((sum: number, it: any) => sum + (it.lineDiscount || 0), 0);
  const totalDiscount = (bill.discountTotal || 0) + itemDiscountsTotal;

  // Pay Due Balance Modal
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payAmountINR, setPayAmountINR] = useState(paiseToINR(bill.dueAmount).toString());
  const [payMethod, setPayMethod] = useState<PaymentMethod>('CASH');
  const [payRefNote, setPayRefNote] = useState('');
  const [isPaying, setIsPaying] = useState(false);
  const [payError, setPayError] = useState('');

  // Cancel Bill Modal
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  // Reverse Payment Modal
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
  const [reverseReason, setReverseReason] = useState('');
  const [isReversing, setIsReversing] = useState(false);
  const [reverseError, setReverseError] = useState('');

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const paise = inrToPaise(payAmountINR);
    if (paise <= 0 || paise > bill.dueAmount) {
      setPayError(`Payment must be positive and not exceed due amount (${formatINR(bill.dueAmount)})`);
      return;
    }

    setPayError('');
    setIsPaying(true);

    try {
      await recordSubsequentPaymentFn({
        data: {
          billId: bill.id,
          amount: paise,
          method: payMethod,
          referenceNote: payRefNote.trim() || undefined,
        },
      });

      setIsPayModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['billing'] });
      await queryClient.invalidateQueries({ queryKey: ['reports'] });
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Payment recorded successfully');
      router.invalidate();
    } catch (err: any) {
      setPayError(err?.message || 'Payment recording failed');
      toast.error(err?.message || 'Payment recording failed');
    } finally {
      setIsPaying(false);
    }
  };

  const handleCancelBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCancelling) return;
    if (!cancelReason.trim()) {
      setCancelError('Reason is required');
      return;
    }

    setCancelError('');
    setIsCancelling(true);

    try {
      await cancelBillFn({
        data: {
          billId: bill.id,
          reason: cancelReason.trim(),
        },
      });

      setIsCancelModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['billing'] });
      await queryClient.invalidateQueries({ queryKey: ['reports'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      await queryClient.invalidateQueries({ queryKey: ['pos-catalog'] });
      toast.success('Bill cancelled successfully. Inventory restored & balances cleared.');
      router.invalidate();
    } catch (err: any) {
      const msg = err?.message || 'Failed to cancel bill';
      setCancelError(msg);
      toast.error(msg);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleReversePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReversing) return;
    if (!selectedPayment) return;
    if (!reverseReason.trim()) {
      setReverseError('Reason is required');
      return;
    }

    setReverseError('');
    setIsReversing(true);

    try {
      await reversePaymentFn({
        data: {
          paymentId: selectedPayment.id,
          reason: reverseReason.trim(),
        },
      });

      setSelectedPayment(null);
      setReverseReason('');
      await queryClient.invalidateQueries({ queryKey: ['billing'] });
      await queryClient.invalidateQueries({ queryKey: ['reports'] });
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      await queryClient.invalidateQueries({ queryKey: ['pos-catalog'] });
      toast.success('Payment reversed successfully');
      router.invalidate();
    } catch (err: any) {
      const msg = err?.message || 'Payment reversal failed';
      setReverseError(msg);
      toast.error(msg);
    } finally {
      setIsReversing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/billing" className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">{bill.billNumber}</h2>
              {bill.status === 'cancelled' ? (
                <Badge variant="danger">Cancelled</Badge>
              ) : (
                <Badge
                  variant={
                    bill.paymentStatus === 'paid'
                      ? 'success'
                      : bill.paymentStatus === 'partial'
                      ? 'warning'
                      : 'danger'
                  }
                >
                  {bill.paymentStatus}
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Created on {new Date(bill.createdAt).toLocaleDateString()} at{' '}
              {new Date(bill.createdAt).toLocaleTimeString()}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:flex sm:items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={() => window.print()} className="w-full sm:w-auto justify-center">
            <Printer className="w-4 h-4" /> Print Receipt
          </Button>

          {bill.status !== 'cancelled' && bill.dueAmount > 0 && (
            <Button size="sm" onClick={() => setIsPayModalOpen(true)} className="w-full sm:w-auto justify-center">
              <CreditCard className="w-4 h-4" /> Pay Due ({formatINR(bill.dueAmount)})
            </Button>
          )}

          {bill.status !== 'cancelled' && (
            <Button variant="danger" size="sm" onClick={() => setIsCancelModalOpen(true)} className="w-full sm:w-auto justify-center">
              <Ban className="w-4 h-4" /> Cancel Bill
            </Button>
          )}
        </div>
      </div>

      {bill.status === 'cancelled' && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
          <strong>This bill was cancelled</strong> on {bill.cancelledAt ? new Date(bill.cancelledAt).toLocaleString() : ''}.
          {bill.cancelReason && <div className="mt-0.5 text-rose-700">Reason: {bill.cancelReason}</div>}
          <div className="mt-1 text-slate-600">
            Inventory was automatically restored, payments reversed, and customer balance cleared.
          </div>
        </div>
      )}

      {/* Printable Receipt Scaffolding for 80mm printer */}
      <div id="printable-receipt" className="hidden print:block border border-slate-300 p-4 font-mono text-xs space-y-2">
        <div className="text-center font-bold text-sm uppercase tracking-wide border-b pb-1">
          {storeName}
        </div>
        <div className="flex justify-between text-[11px]">
          <span>Invoice: {bill.billNumber}</span>
          <span>{new Date(bill.createdAt).toLocaleDateString()}</span>
        </div>
        {customer && (
          <div className="text-[11px]">
            Customer: {customer.name} {customer.phone ? `(${customer.phone})` : ''}
          </div>
        )}
        <div className="border-t border-b py-2 space-y-1">
          {items.map((it: any) => (
            <div key={it.id} className="flex justify-between">
              <span>{it.productName} x {it.quantity}</span>
              <span>{formatINR(it.lineTotal)}</span>
            </div>
          ))}
          {charges.map((ch: any) => (
            <div key={ch.id} className="flex justify-between text-slate-600">
              <span>{ch.description}</span>
              <span>{formatINR(ch.amount)}</span>
            </div>
          ))}
        </div>
        {totalDiscount > 0 && (
          <div className="flex justify-between text-[11px] font-semibold text-slate-700">
            <span>Discount:</span>
            <span>-{formatINR(totalDiscount)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold pt-1">
          <span>GRAND TOTAL:</span>
          <span>{formatINR(bill.grandTotal)}</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span>Paid: {formatINR(bill.paidAmount)}</span>
          {bill.dueAmount > 0 && <span>Due: {formatINR(bill.dueAmount)}</span>}
        </div>
        <div className="text-center text-[10px] text-slate-500 pt-2 border-t">
          Thank you for your business!
        </div>
        <div className="text-center text-[9px] text-slate-400 font-sans tracking-wider uppercase pt-2 border-t mt-1 opacity-60">
          Powered by Inventra Lite
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Left: Bill Details & Items */}
        <div className="md:col-span-2 space-y-4">
          <Card className="p-0 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 font-semibold text-xs text-slate-700">
              Purchased Items ({items.length})
            </div>
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="text-[11px] uppercase bg-slate-50/50 text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-4">Item</th>
                  <th className="py-2.5 px-4">Rate</th>
                  <th className="py-2.5 px-4">Qty</th>
                  <th className="py-2.5 px-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item: any) => (
                  <tr key={item.id}>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{item.productName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{item.sku}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">{formatINR(item.unitPrice)}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">{item.quantity} {item.unit}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">{formatINR(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {charges.length > 0 && (
              <div className="p-3 bg-slate-50 border-t border-slate-100">
                <div className="text-xs font-semibold text-slate-700 mb-2">Additional Charges</div>
                <div className="space-y-1.5">
                  {charges.map((c: any) => (
                    <div key={c.id} className="flex justify-between text-xs text-slate-600">
                      <span>{c.description}</span>
                      <span className="font-semibold">{formatINR(c.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Payment History */}
          <Card>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              Payment Transactions
            </h3>

            {payments.length === 0 ? (
              <p className="text-xs text-slate-400">No payment records found.</p>
            ) : (
              <div className="space-y-2">
                {payments.map((p: any) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 bg-slate-50/50 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="brand">{p.method}</Badge>
                        <span className="font-bold text-slate-900">{formatINR(p.amount)}</span>
                        {p.status === 'reversed' && (
                          <Badge variant="danger" className="text-[10px]">
                            Reversed
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {new Date(p.createdAt).toLocaleString()} {p.referenceNote && `• ${p.referenceNote}`}
                      </div>
                    </div>

                    {bill.status !== 'cancelled' && p.status === 'completed' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedPayment(p)}
                        className="text-slate-500 hover:text-rose-600"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Reverse
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right: Financial Summary & Customer */}
        <div className="space-y-4">
          <Card className="space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Financial Summary
            </h3>

            <div className="space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Items Subtotal:</span>
                <span>{formatINR(bill.itemsSubtotal)}</span>
              </div>
              {bill.chargesTotal > 0 && (
                <div className="flex justify-between">
                  <span>Charges:</span>
                  <span>+{formatINR(bill.chargesTotal)}</span>
                </div>
              )}
              {bill.discountTotal > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Discount:</span>
                  <span>-{formatINR(bill.discountTotal)}</span>
                </div>
              )}
              {bill.taxTotal > 0 && (
                <div className="flex justify-between">
                  <span>Tax:</span>
                  <span>+{formatINR(bill.taxTotal)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-2 border-t">
                <span>Grand Total:</span>
                <span className="text-brand-700">{formatINR(bill.grandTotal)}</span>
              </div>
              <div className="flex justify-between pt-1 font-semibold text-emerald-600">
                <span>Total Paid:</span>
                <span>{formatINR(bill.paidAmount)}</span>
              </div>
              {bill.dueAmount > 0 && (
                <div className="flex justify-between font-bold text-rose-600">
                  <span>Outstanding Due:</span>
                  <span>{formatINR(bill.dueAmount)}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Customer Profile */}
          <Card>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Customer Details
            </h3>
            {customer ? (
              <div className="text-xs space-y-1">
                <p className="font-bold text-slate-900">{customer.name}</p>
                {customer.phone && <p className="text-slate-500">Phone: {customer.phone}</p>}
                {customer.email && <p className="text-slate-500">Email: {customer.email}</p>}
                <div className="pt-2">
                  <Link to="/customers/$id" params={{ id: customer.id }} className="text-brand-600 hover:underline font-semibold">
                    View Customer Khata & Ledger →
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">Walk-in Guest (No registered customer account)</p>
            )}
          </Card>
        </div>
      </div>

      {/* MODAL 1: PAY DUE BALANCE */}
      {isPayModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsPayModalOpen(false)}
          title={`Record Payment for ${bill.billNumber}`}
          description={`Outstanding due on this bill is ${formatINR(bill.dueAmount)}.`}
        >
          <form onSubmit={handleRecordPayment} className="space-y-4">
            {payError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {payError}
              </div>
            )}

            <Input
              label="Payment Amount (₹)"
              type="number"
              step="0.01"
              value={payAmountINR}
              onChange={(e) => setPayAmountINR(e.target.value)}
              required
              autoFocus
            />

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Payment Method</label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-brand-500"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Reference Note (Optional)"
              placeholder="e.g. UPI Ref #, Cheque #"
              value={payRefNote}
              onChange={(e) => setPayRefNote(e.target.value)}
            />

            <Button type="submit" isLoading={isPaying} className="w-full">
              Confirm Payment
            </Button>
          </form>
        </Modal>
      )}

      {/* MODAL 2: CANCEL BILL */}
      {isCancelModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsCancelModalOpen(false)}
          title={`Cancel Invoice ${bill.billNumber}`}
          description="Cancelling will restore physical inventory, reverse all active payments, and clear any customer balance created by this bill."
        >
          <form onSubmit={handleCancelBill} className="space-y-4">
            {cancelError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {cancelError}
              </div>
            )}

            <Input
              label="Cancellation Reason *"
              placeholder="e.g. Customer returned items, Cashier error"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              required
              autoFocus
            />

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setIsCancelModalOpen(false)}>
                Back
              </Button>
              <Button type="submit" variant="danger" isLoading={isCancelling} className="flex-1">
                Confirm Cancellation
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 3: REVERSE STANDALONE PAYMENT */}
      {selectedPayment && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedPayment(null)}
          title={`Reverse Payment: ${formatINR(selectedPayment.amount)}`}
          description={
            customer
              ? `Reversing this payment will add ${formatINR(selectedPayment.amount)} back to the bill due balance and customer receivable.`
              : 'Notice: Standalone payment reversal is rejected for walk-in bills. You must cancel the bill instead.'
          }
        >
          <form onSubmit={handleReversePayment} className="space-y-4">
            {reverseError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {reverseError}
              </div>
            )}

            <Input
              label="Reversal Reason *"
              placeholder="e.g. UPI bounced, Cheque returned"
              value={reverseReason}
              onChange={(e) => setReverseReason(e.target.value)}
              required
              autoFocus
            />

            <Button type="submit" variant="danger" isLoading={isReversing} className="w-full">
              Confirm Payment Reversal
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
