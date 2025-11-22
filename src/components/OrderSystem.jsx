// src/components/OrderSystem.jsx - UPDATED WITH DELIVERY
import { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const OrderSystem = ({ cart, shop, onOrderPlaced, onClose }) => {
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [creditAmount, setCreditAmount] = useState(0);
  const [cashAmount, setCashAmount] = useState(0);
  const [customerNote, setCustomerNote] = useState('');
  const [loading, setLoading] = useState(false);
  
  // DELIVERY-RELATED STATES
  const [deliveryType, setDeliveryType] = useState('pickup');
  const [shopSettings, setShopSettings] = useState(null);
  const [deliveryAddress, setDeliveryAddress] = useState({
    street: '',
    city: '',
    pincode: '',
    instructions: ''
  });

  const auth = getAuth();

  // FETCH SHOP DELIVERY SETTINGS
  useEffect(() => {
    if (shop?.id) {
      fetchShopSettings();
    }
  }, [shop]);

  const fetchShopSettings = async () => {
    try {
      const shopDoc = await getDoc(doc(db, 'shops', shop.id));
      if (shopDoc.exists()) {
        const shopData = shopDoc.data();
        setShopSettings(shopData);
        
        // Set default delivery type based on shop settings
        if (!shopData.pickupSettings?.allowsPickup && shopData.deliverySettings?.offersDelivery) {
          setDeliveryType('delivery');
        }
      }
    } catch (error) {
      console.error('Error fetching shop settings:', error);
    }
  };

  // CALCULATE DELIVERY FEE
  const getDeliveryFee = () => {
    if (deliveryType !== 'delivery') return 0;
    if (!shopSettings?.deliverySettings?.offersDelivery) return 0;
    
    const subtotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    const freeThreshold = shopSettings.deliverySettings?.freeDeliveryThreshold || 0;
    
    // Free delivery if order meets threshold
    if (freeThreshold > 0 && subtotal >= freeThreshold) {
      return 0;
    }
    
    return shopSettings.deliverySettings?.deliveryFee || 0;
  };

  // CALCULATE TOTALS
  const calculateTotals = () => {
    const subtotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    const deliveryFee = getDeliveryFee();
    const total = subtotal + deliveryFee;

    return { subtotal, deliveryFee, total };
  };

  const { subtotal, deliveryFee, total } = calculateTotals();

  // UPDATE PAYMENT AMOUNTS BASED ON TOTAL
  useEffect(() => {
    if (paymentMethod === 'cash') {
      setCashAmount(total);
      setCreditAmount(0);
    } else if (paymentMethod === 'credit') {
      setCreditAmount(total);
      setCashAmount(0);
    }
    // For split payment, keep existing values or set defaults
  }, [paymentMethod, total]);

  const handleSplitPaymentChange = (type, value) => {
    const numValue = parseFloat(value) || 0;
    if (type === 'credit') {
      setCreditAmount(numValue);
      setCashAmount(total - numValue);
    } else {
      setCashAmount(numValue);
      setCreditAmount(total - numValue);
    }
  };

  const validatePayment = () => {
    if (paymentMethod === 'split_payment') {
      if (creditAmount + cashAmount !== total) {
        alert(`Split payment amounts must equal total (₹${total}). Current: Credit ₹${creditAmount} + Cash ₹${cashAmount} = ₹${creditAmount + cashAmount}`);
        return false;
      }
      if (creditAmount < 0 || cashAmount < 0) {
        alert('Payment amounts cannot be negative');
        return false;
      }
    }

    // Validate delivery address if delivery is selected
    if (deliveryType === 'delivery') {
      if (!deliveryAddress.street.trim() || !deliveryAddress.city.trim() || !deliveryAddress.pincode.trim()) {
        alert('Please fill in all required delivery address fields');
        return false;
      }
    }

    return true;
  };

  const handlePlaceOrder = async () => {
    if (!validatePayment()) return;

    setLoading(true);
    try {
      const orderData = {
        orderId: `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        customerId: auth.currentUser.uid,
        customerEmail: auth.currentUser.email,
        shopId: shop.id,
        items: cart.map(item => ({
          productId: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          total: item.price * item.quantity,
          unit: item.unit
        })),
        // UPDATED: Include delivery calculations
        subtotal: subtotal,
        deliveryFee: deliveryFee,
        totalAmount: total,
        deliveryType: deliveryType,
        // Delivery-specific fields
        ...(deliveryType === 'delivery' && { 
          deliveryAddress: deliveryAddress 
        }),
        // Pickup-specific fields
        ...(deliveryType === 'pickup' && { 
          pickupDetails: {
            instructions: shopSettings?.pickupSettings?.pickupInstructions || 'Please come to the counter for pickup'
          }
        }),
        // Payment fields (existing)
        paymentMethod: paymentMethod,
        creditAmount: creditAmount,
        cashAmount: cashAmount,
        status: (paymentMethod === 'credit' || paymentMethod === 'split_payment') ? 'pending_approval' : 'confirmed',
        creditApproved: false, // ✅ FIX: Always false initially for credit-related payments
        customerNote: customerNote,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await addDoc(collection(db, 'orders'), orderData);
      onOrderPlaced(orderData.orderId);
      
    } catch (error) {
      console.error('Error placing order:', error);
      alert('Error placing order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Check if shop offers any delivery options
  const hasDeliveryOptions = () => {
    return shopSettings?.deliverySettings?.offersDelivery || shopSettings?.pickupSettings?.allowsPickup !== false;
  };

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <h2>📦 Place Your Order</h2>
          <button onClick={onClose} style={styles.closeButton}>✕</button>
        </div>

        {/* DELIVERY METHOD SELECTION - NEW SECTION */}
        {hasDeliveryOptions() && (
          <div style={styles.deliverySection}>
            <h3>🚚 Delivery Method</h3>
            
            {/* Pickup Option */}
            {shopSettings?.pickupSettings?.allowsPickup !== false && (
              <div style={styles.optionGroup}>
                <label style={styles.optionLabel}>
                  <input
                    type="radio"
                    value="pickup"
                    checked={deliveryType === 'pickup'}
                    onChange={(e) => setDeliveryType(e.target.value)}
                    style={styles.radio}
                  />
                  <div style={deliveryType === 'pickup' ? styles.optionSelected : styles.option}>
                    <span style={styles.optionIcon}>🏪</span>
                    <div style={styles.optionContent}>
                      <strong>Pickup</strong>
                      <small>Collect from {shop.shopName}</small>
                      {shopSettings?.pickupSettings?.pickupInstructions && (
                        <small style={styles.instructions}>
                          {shopSettings.pickupSettings.pickupInstructions}
                        </small>
                      )}
                    </div>
                  </div>
                </label>
              </div>
            )}

            {/* Delivery Option */}
            {shopSettings?.deliverySettings?.offersDelivery && (
              <div style={styles.optionGroup}>
                <label style={styles.optionLabel}>
                  <input
                    type="radio"
                    value="delivery"
                    checked={deliveryType === 'delivery'}
                    onChange={(e) => setDeliveryType(e.target.value)}
                    style={styles.radio}
                  />
                  <div style={deliveryType === 'delivery' ? styles.optionSelected : styles.option}>
                    <span style={styles.optionIcon}>🚚</span>
                    <div style={styles.optionContent}>
                      <strong>Delivery</strong>
                      <small>
                        {deliveryFee > 0 ? `₹${deliveryFee} fee` : 'Free delivery'}
                        {shopSettings.deliverySettings.estimatedDeliveryTime && 
                          ` • ${shopSettings.deliverySettings.estimatedDeliveryTime}`
                        }
                      </small>
                      {shopSettings.deliverySettings.freeDeliveryThreshold > 0 && (
                        <small style={styles.freeDeliveryInfo}>
                          Free delivery on orders above ₹{shopSettings.deliverySettings.freeDeliveryThreshold}
                        </small>
                      )}
                    </div>
                  </div>
                </label>
              </div>
            )}

            {/* Delivery Address Form */}
            {deliveryType === 'delivery' && (
              <div style={styles.addressForm}>
                <h4>📍 Delivery Address</h4>
                <input
                  type="text"
                  placeholder="Street Address *"
                  value={deliveryAddress.street}
                  onChange={(e) => setDeliveryAddress({...deliveryAddress, street: e.target.value})}
                  style={styles.input}
                  required
                />
                <div style={styles.addressRow}>
                  <input
                    type="text"
                    placeholder="City *"
                    value={deliveryAddress.city}
                    onChange={(e) => setDeliveryAddress({...deliveryAddress, city: e.target.value})}
                    style={styles.input}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Pincode *"
                    value={deliveryAddress.pincode}
                    onChange={(e) => setDeliveryAddress({...deliveryAddress, pincode: e.target.value})}
                    style={styles.input}
                    required
                  />
                </div>
                <textarea
                  placeholder="Delivery instructions (optional)"
                  value={deliveryAddress.instructions}
                  onChange={(e) => setDeliveryAddress({...deliveryAddress, instructions: e.target.value})}
                  style={styles.textarea}
                  rows="3"
                />
              </div>
            )}
          </div>
        )}

        {/* ORDER SUMMARY - UPDATED WITH DELIVERY FEE */}
        <div style={styles.orderSummary}>
          <h3>📋 Order Summary</h3>
          <div style={styles.summaryItems}>
            {cart.map((item, index) => (
              <div key={index} style={styles.summaryItem}>
                <span>{item.name} × {item.quantity}</span>
                <span>₹{(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div style={styles.summaryRow}>
            <span>Subtotal:</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          {deliveryFee > 0 && (
            <div style={styles.summaryRow}>
              <span>Delivery Fee:</span>
              <span>₹{deliveryFee.toFixed(2)}</span>
            </div>
          )}
          <div style={styles.summaryTotal}>
            <strong>Total Amount:</strong>
            <strong>₹{total.toFixed(2)}</strong>
          </div>
        </div>

        {/* PAYMENT METHOD SELECTION (EXISTING) */}
        <div style={styles.paymentSection}>
          <h3>💳 Payment Method</h3>
          <div style={styles.paymentOptions}>
            <label style={styles.paymentOption}>
              <input
                type="radio"
                value="cash"
                checked={paymentMethod === 'cash'}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
              <span>💵 Cash</span>
            </label>
            
            <label style={styles.paymentOption}>
              <input
                type="radio"
                value="credit"
                checked={paymentMethod === 'credit'}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
              <span>🪙 Full Credit</span>
            </label>
            
            <label style={styles.paymentOption}>
              <input
                type="radio"
                value="split_payment"
                checked={paymentMethod === 'split_payment'}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
              <span>💰 Split Payment</span>
            </label>
          </div>

          {/* Split Payment Details */}
          {paymentMethod === 'split_payment' && (
            <div style={styles.splitPayment}>
              <div style={styles.splitInputGroup}>
                <label>Credit Amount (₹)</label>
                <input
                  type="number"
                  value={creditAmount}
                  onChange={(e) => handleSplitPaymentChange('credit', e.target.value)}
                  style={styles.splitInput}
                  min="0"
                  max={total}
                />
              </div>
              <div style={styles.splitInputGroup}>
                <label>Cash Amount (₹)</label>
                <input
                  type="number"
                  value={cashAmount}
                  onChange={(e) => handleSplitPaymentChange('cash', e.target.value)}
                  style={styles.splitInput}
                  min="0"
                  max={total}
                />
              </div>
              <div style={styles.splitTotal}>
                Credit: ₹{creditAmount.toFixed(2)} + Cash: ₹{cashAmount.toFixed(2)} = ₹{(creditAmount + cashAmount).toFixed(2)}
              </div>
            </div>
          )}
        </div>

        {/* CUSTOMER NOTES (EXISTING) */}
        <div style={styles.notesSection}>
          <h3>📝 Order Notes (Optional)</h3>
          <textarea
            value={customerNote}
            onChange={(e) => setCustomerNote(e.target.value)}
            placeholder="Any special instructions or requests..."
            style={styles.notesTextarea}
            rows="3"
          />
        </div>

        {/* PLACE ORDER BUTTON */}
        <button 
          onClick={handlePlaceOrder}
          disabled={loading || cart.length === 0}
          style={loading || cart.length === 0 ? styles.placeOrderButtonDisabled : styles.placeOrderButton}
        >
          {loading ? '⏳ Placing Order...' : `📦 Place Order - ₹${total.toFixed(2)}`}
        </button>
      </div>
    </div>
  );
};

// STYLES - ADD DELIVERY STYLES TO YOUR EXISTING STYLES
const styles = {
  modalOverlay: {
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
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    width: '100%',
    maxWidth: '500px',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  modalHeader: {
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
  
  // DELIVERY STYLES
  deliverySection: {
    marginBottom: '1.5rem',
    padding: '1.5rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    border: '1px solid #e9ecef',
  },
  optionGroup: {
    marginBottom: '0.75rem',
  },
  optionLabel: {
    display: 'block',
    cursor: 'pointer',
  },
  radio: {
    display: 'none',
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem',
    border: '2px solid #dee2e6',
    borderRadius: '8px',
    backgroundColor: 'white',
    transition: 'all 0.2s ease',
  },
  optionSelected: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem',
    border: '2px solid #3498db',
    borderRadius: '8px',
    backgroundColor: '#e8f4fd',
    transition: 'all 0.2s ease',
  },
  optionIcon: {
    fontSize: '1.5rem',
  },
  optionContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  instructions: {
    color: '#6c757d',
    fontStyle: 'italic',
    fontSize: '0.8rem',
  },
  freeDeliveryInfo: {
    color: '#28a745',
    fontSize: '0.8rem',
    fontWeight: '500',
  },
  addressForm: {
    marginTop: '1rem',
    padding: '1rem',
    backgroundColor: 'white',
    borderRadius: '6px',
    border: '1px solid #dee2e6',
  },
  addressRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.75rem',
    marginBottom: '0.75rem',
  },
  input: {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    fontSize: '1rem',
    marginBottom: '0.75rem',
  },
  textarea: {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    fontSize: '1rem',
    resize: 'vertical',
    fontFamily: 'inherit',
    minHeight: '80px',
  },
  
  // ORDER SUMMARY STYLES
  orderSummary: {
    marginBottom: '1.5rem',
    padding: '1.5rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
  },
  summaryItems: {
    marginBottom: '1rem',
  },
  summaryItem: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '0.5rem',
    fontSize: '0.9rem',
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '0.5rem',
    color: '#495057',
  },
  summaryTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    paddingTop: '1rem',
    borderTop: '2px solid #e9ecef',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  
  // PAYMENT STYLES (EXISTING)
  paymentSection: {
    marginBottom: '1.5rem',
  },
  paymentOptions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    marginBottom: '1rem',
  },
  paymentOption: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
    padding: '0.75rem',
    border: '1px solid #ddd',
    borderRadius: '4px',
  },
  splitPayment: {
    padding: '1rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '4px',
  },
  splitInputGroup: {
    marginBottom: '0.75rem',
  },
  splitInput: {
    width: '100%',
    padding: '0.5rem',
    border: '1px solid #ced4da',
    borderRadius: '4px',
  },
  splitTotal: {
    textAlign: 'center',
    fontWeight: '600',
    color: '#495057',
  },
  
  // NOTES STYLES (EXISTING)
  notesSection: {
    marginBottom: '1.5rem',
  },
  notesTextarea: {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    fontSize: '1rem',
    resize: 'vertical',
    fontFamily: 'inherit',
    minHeight: '80px',
  },
  
  // BUTTON STYLES
  placeOrderButton: {
    width: '100%',
    backgroundColor: '#27ae60',
    color: 'white',
    border: 'none',
    padding: '1rem 2rem',
    borderRadius: '6px',
    fontSize: '1.1rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  placeOrderButtonDisabled: {
    width: '100%',
    backgroundColor: '#bdc3c7',
    color: 'white',
    border: 'none',
    padding: '1rem 2rem',
    borderRadius: '6px',
    fontSize: '1.1rem',
    fontWeight: '600',
    cursor: 'not-allowed',
  },
};

export default OrderSystem;