// src/components/OrderSystem.jsx
import { calculateOrderTotal, normalizeOrderItems } from '../utils/orderCalculations';
import { useState } from 'react';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, addDoc, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';

const OrderSystem = ({ cart, shop, onOrderPlaced, onClose }) => {
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [creditAmount, setCreditAmount] = useState(0);
  const [cashAmount, setCashAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');
  const auth = getAuth();

  const orderTotal = calculateOrderTotal(cart);
  
  // Calculate amounts based on payment method
  const calculateAmounts = (method, creditAmt = 0) => {
    if (method === 'cash') {
      setCashAmount(orderTotal);
      setCreditAmount(0);
    } else if (method === 'credit') {
      setCashAmount(0);
      setCreditAmount(orderTotal);
    } else if (method === 'split') {
      setCreditAmount(creditAmt);
      setCashAmount(orderTotal - creditAmt);
    }
  };

  const handlePaymentMethodChange = (method) => {
    setPaymentMethod(method);
    calculateAmounts(method);
  };

  const handleCreditAmountChange = (amount) => {
    const creditAmt = Math.min(Math.max(0, amount), orderTotal);
    setCreditAmount(creditAmt);
    setCashAmount(orderTotal - creditAmt);
  };

  const placeOrder = async () => {
    if (paymentMethod === 'split' && creditAmount <= 0) {
      alert('Please enter a valid credit amount for split payment');
      return;
    }

    setLoading(true);
    try {
      const orderData = {
        customerId: auth.currentUser.uid,
        customerEmail: auth.currentUser.email,
        shopId: shop.id,
        shopName: shop.shopName,
        items: normalizeOrderItems(cart.map(item => ({
  productId: item.id,
  name: item.name,
  price: item.price,
  quantity: item.quantity,
  unit: item.unit
}))),
        orderTotal: orderTotal,
        paymentMethod: paymentMethod,
        cashAmount: cashAmount,
        creditAmount: creditAmount,
        creditRequested: paymentMethod !== 'cash',
        creditApproved: paymentMethod === 'cash', // Auto-approve cash orders
        status: paymentMethod === 'cash' ? 'confirmed' : 'pending_approval',
        orderNotes: orderNotes,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Create order in Firestore
      const orderRef = await addDoc(collection(db, 'orders'), orderData);

      // Update product stock levels
      const updatePromises = cart.map(item => 
        updateDoc(doc(db, 'products', item.id), {
          stock: item.stock - item.quantity
        })
      );
      await Promise.all(updatePromises);

      console.log('✅ Order placed successfully!');
      onOrderPlaced(orderRef.id);
      
    } catch (error) {
      console.error('Error placing order:', error);
      alert('Error placing order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2>📦 Place Your Order</h2>
          <button onClick={onClose} style={styles.closeButton}>✕</button>
        </div>

        <div style={styles.orderSummary}>
          <h3>Order Summary - {shop.shopName}</h3>
          <div style={styles.itemsList}>
            {cart.map(item => (
              <div key={item.id} style={styles.orderItem}>
                <span style={styles.itemName}>{item.name}</span>
                <span style={styles.itemQuantity}>{item.quantity} {item.unit}</span>
                <span style={styles.itemPrice}>${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div style={styles.orderTotal}>
            <strong>Total: ${orderTotal.toFixed(2)}</strong>
          </div>
        </div>

        <div style={styles.paymentSection}>
          <h3>💳 Payment Method</h3>
          <div style={styles.paymentOptions}>
            <label style={styles.radioLabel}>
              <input
                type="radio"
                value="cash"
                checked={paymentMethod === 'cash'}
                onChange={() => handlePaymentMethodChange('cash')}
                style={styles.radio}
              />
              💵 Pay Full Amount in Cash
            </label>
            
            <label style={styles.radioLabel}>
              <input
                type="radio"
                value="credit"
                checked={paymentMethod === 'credit'}
                onChange={() => handlePaymentMethodChange('credit')}
                style={styles.radio}
              />
              🪙 Pay Full Amount with Credit
            </label>
            
            <label style={styles.radioLabel}>
              <input
                type="radio"
                value="split"
                checked={paymentMethod === 'split'}
                onChange={() => handlePaymentMethodChange('split')}
                style={styles.radio}
              />
              💰 Split Payment (Cash + Credit)
            </label>
          </div>

          {paymentMethod === 'split' && (
            <div style={styles.splitPayment}>
              <label>Credit Amount:</label>
              <div style={styles.amountInput}>
                <span style={styles.currency}>$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={orderTotal}
                  value={creditAmount}
                  onChange={(e) => handleCreditAmountChange(parseFloat(e.target.value) || 0)}
                  style={styles.input}
                />
              </div>
              <div style={styles.amountBreakdown}>
                <span>Credit: ${creditAmount.toFixed(2)}</span>
                <span>Cash: ${cashAmount.toFixed(2)}</span>
              </div>
            </div>
          )}

          {paymentMethod === 'credit' && (
            <div style={styles.creditNotice}>
              <p>🔒 Your order will require approval from {shop.shopName} before processing.</p>
            </div>
          )}
        </div>

        <div style={styles.notesSection}>
          <label>Order Notes (Optional):</label>
          <textarea
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
            placeholder="Any special instructions for your order..."
            style={styles.notesInput}
            rows="3"
          />
        </div>

        <div style={styles.actions}>
          <button onClick={onClose} style={styles.cancelButton}>
            Cancel
          </button>
          <button 
            onClick={placeOrder}
            disabled={loading || orderTotal === 0}
            style={loading ? styles.buttonDisabled : styles.placeOrderButton}
          >
            {loading ? 'Placing Order...' : '📦 Place Order'}
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: '1rem',
  },
  modal: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '8px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    width: '100%',
    maxWidth: '500px',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
    borderBottom: '2px solid #ecf0f1',
    paddingBottom: '1rem',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '1.5rem',
    cursor: 'pointer',
    color: '#666',
  },
  orderSummary: {
    marginBottom: '1.5rem',
    padding: '1rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '6px',
  },
  itemsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    margin: '1rem 0',
  },
  orderItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.5rem 0',
    borderBottom: '1px solid #e9ecef',
  },
  itemName: {
    flex: 2,
    fontWeight: '500',
  },
  itemQuantity: {
    flex: 1,
    textAlign: 'center',
    color: '#7f8c8d',
  },
  itemPrice: {
    flex: 1,
    textAlign: 'right',
    fontWeight: '600',
  },
  orderTotal: {
    textAlign: 'right',
    fontSize: '1.2rem',
    fontWeight: 'bold',
    color: '#2c3e50',
    borderTop: '2px solid #e9ecef',
    paddingTop: '0.5rem',
  },
  paymentSection: {
    marginBottom: '1.5rem',
  },
  paymentOptions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    marginTop: '1rem',
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
    padding: '0.75rem',
    border: '1px solid #ddd',
    borderRadius: '4px',
    transition: 'all 0.3s ease',
  },
  radio: {
    margin: 0,
  },
  splitPayment: {
    marginTop: '1rem',
    padding: '1rem',
    backgroundColor: '#e8f4fd',
    borderRadius: '4px',
    border: '1px solid #3498db',
  },
  amountInput: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    margin: '0.5rem 0',
  },
  currency: {
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  input: {
    padding: '0.5rem',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '1rem',
    width: '100px',
  },
  amountBreakdown: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.9rem',
    color: '#7f8c8d',
  },
  creditNotice: {
    padding: '1rem',
    backgroundColor: '#fff3cd',
    border: '1px solid #ffeaa7',
    borderRadius: '4px',
    marginTop: '1rem',
  },
  notesSection: {
    marginBottom: '1.5rem',
  },
  notesInput: {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '1rem',
    marginTop: '0.5rem',
    resize: 'vertical',
  },
  actions: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'flex-end',
  },
  cancelButton: {
    backgroundColor: '#95a5a6',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  placeOrderButton: {
    backgroundColor: '#27ae60',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem',
  },
  buttonDisabled: {
    backgroundColor: '#bdc3c7',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '4px',
    cursor: 'not-allowed',
    fontSize: '1rem',
  },
};

export default OrderSystem;
