// src/components/CustomerOrderHistory.jsx - UPDATED WITH ACKNOWLEDGEMENT
import { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import OrderAcknowledgement from './OrderAcknowledgement';

// Utility functions for consistent calculations
const calculateItemTotal = (item) => {
  return (item.price * item.quantity).toFixed(2);
};

const normalizeOrderItems = (items) => {
  return items.map(item => ({
    ...item,
    total: calculateItemTotal(item)
  }));
};

const CustomerOrderHistory = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [acknowledgingOrder, setAcknowledgingOrder] = useState(null);
  const auth = getAuth();

  // Real-time listener instead of polling
  useEffect(() => {
    if (!auth.currentUser?.uid) return;

    setLoading(true);
    console.log('🔄 Setting up real-time listener for customer:', auth.currentUser.uid);

    const ordersQuery = query(
      collection(db, 'orders'),
      where('customerId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(ordersQuery, 
      (snapshot) => {
        const ordersList = [];
        snapshot.forEach((doc) => {
          const orderData = doc.data();
          ordersList.push({ 
            id: doc.id, 
            ...orderData,
            items: normalizeOrderItems(orderData.items || [])
          });
        });
        
        console.log('✅ Real-time update - Orders found:', ordersList.length);
        setOrders(ordersList);
        setLoading(false);
        setError(null);
      },
      (error) => {
        console.error('❌ Real-time listener error:', error);
        setError('Failed to load orders. Please refresh the page.');
        setLoading(false);
      }
    );

    // Cleanup listener on unmount
    return () => {
      console.log('🧹 Cleaning up real-time listener');
      unsubscribe();
    };
  }, [auth.currentUser?.uid]);

  const getStatusBadge = (status, creditRequested, creditApproved, deliveryProof) => {
    const statusConfig = {
      'pending_approval': { color: '#f39c12', label: '⏳ Pending Credit Approval', description: 'Waiting for shop to approve your credit request' },
      'confirmed': { color: '#27ae60', label: '✅ Order Confirmed', description: 'Shop has accepted your order' },
      'preparing': { color: '#3498db', label: '👨‍🍳 Preparing Order', description: 'Shop is preparing your items' },
      'ready': { color: '#9b59b6', label: '📦 Ready for Pickup', description: 'Your order is ready for collection' },
      'completed': { color: '#2c3e50', label: '📬 Delivery Complete', description: 'Order delivered - please confirm receipt' },
      'acknowledged': { color: '#27ae60', label: '✅ Order Completed', description: 'Thank you for confirming receipt!' },
      'cancelled': { color: '#e74c3c', label: '❌ Order Cancelled', description: 'Order was cancelled' }
    };

    let statusInfo = statusConfig[status] || { color: '#95a5a6', label: status, description: 'Processing your order' };
    
    if (creditRequested && !creditApproved && status === 'pending_approval') {
      statusInfo = { 
        color: '#e67e22', 
        label: '💳 Awaiting Credit Approval', 
        description: 'Shop needs to approve your credit payment' 
      };
    }

    // Override for acknowledged orders
    if (deliveryProof?.acknowledged) {
      statusInfo = { 
        color: '#27ae60', 
        label: '✅ Order Completed', 
        description: `Thank you! You rated ${deliveryProof.rating}⭐` 
      };
    }

    return (
      <div style={styles.statusSection}>
        <span style={{
          backgroundColor: statusInfo.color,
          color: 'white',
          padding: '0.5rem 1rem',
          borderRadius: '20px',
          fontSize: '0.9rem',
          fontWeight: '600',
          display: 'inline-block',
          marginBottom: '0.5rem',
        }}>
          {statusInfo.label}
        </span>
        <p style={styles.statusDescription}>{statusInfo.description}</p>
      </div>
    );
  };

  const getPaymentBadge = (paymentMethod, creditAmount, cashAmount) => {
    if (paymentMethod === 'cash') {
      return <span style={styles.paymentBadge}>💵 Paid in Cash: ${cashAmount?.toFixed(2)}</span>;
    } else if (paymentMethod === 'credit') {
      return <span style={styles.paymentBadge}>🪙 Paid with Credit: ${creditAmount?.toFixed(2)}</span>;
    } else if (paymentMethod === 'split') {
      return (
        <span style={styles.paymentBadge}>
          💰 Split Payment: Credit ${creditAmount?.toFixed(2)} + Cash ${cashAmount?.toFixed(2)}
        </span>
      );
    }
    return <span style={styles.paymentBadge}>💳 Payment: ${((cashAmount || 0) + (creditAmount || 0))?.toFixed(2)}</span>;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Date not available';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  // Safe check for acknowledgement
  const canAcknowledgeOrder = (order) => {
    return order.status === 'completed' && 
           (!order.deliveryProof || !order.deliveryProof.acknowledged);
  };

  const isOrderAcknowledged = (order) => {
    return order.deliveryProof?.acknowledged === true;
  };

  const handleAcknowledgementComplete = () => {
    setAcknowledgingOrder(null);
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        <h3>Loading Your Orders...</h3>
        <p>Fetching your order history...</p>
        <div style={styles.loadingSpinner}>⏳</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <h3>❌ Error Loading Orders</h3>
        <p>{error}</p>
        <button 
          onClick={() => window.location.reload()}
          style={styles.refreshButton}
        >
          🔄 Reload Page
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2>📋 My Order History</h2>
        <div style={styles.headerActions}>
          <div style={styles.stats}>
            <span>Total Orders: {orders.length}</span>
            <span>Pending: {orders.filter(o => o.status === 'pending_approval').length}</span>
            <span>Active: {orders.filter(o => ['confirmed', 'preparing', 'ready'].includes(o.status)).length}</span>
            <span>Completed: {orders.filter(o => o.status === 'completed' || o.status === 'acknowledged').length}</span>
          </div>
          <div style={styles.realTimeIndicator}>
            <span style={styles.liveDot}>●</span>
            Live Updates
          </div>
        </div>
      </div>

      {orders.length === 0 ? (
        <div style={styles.emptyState}>
          <h3>No orders yet</h3>
          <p>Your orders will appear here once you place them.</p>
          <div style={styles.emptyTips}>
            <p>💡 <strong>How to get started:</strong></p>
            <ul style={styles.tipsList}>
              <li>Browse shops and add products to your cart</li>
              <li>Choose payment method (Cash, Credit, or Split)</li>
              <li>Place your order and track its status here</li>
            </ul>
          </div>
        </div>
      ) : (
        <div style={styles.ordersList}>
          {orders.map(order => (
            <div key={order.id} style={styles.orderCard}>
              <div style={styles.orderHeader}>
                <div style={styles.orderBasicInfo}>
                  <h3>Order #{order.id.slice(-8).toUpperCase()}</h3>
                  <p style={styles.shopName}>From: <strong>{order.shopName}</strong></p>
                  <p style={styles.orderDate}>Placed: {formatDate(order.createdAt)}</p>
                </div>
                <div style={styles.orderStatus}>
                  {getStatusBadge(order.status, order.creditRequested, order.creditApproved, order.deliveryProof)}
                </div>
              </div>

              <div style={styles.orderDetails}>
                <div style={styles.itemsSection}>
                  <h4>🛍️ Items Ordered:</h4>
                  <div style={styles.itemsList}>
                    {order.items && order.items.map((item, index) => (
                      <div key={index} style={styles.orderItem}>
                        <span style={styles.itemName}>{item.name}</span>
                        <span style={styles.itemQuantity}>{item.quantity} {item.unit}</span>
                        <span style={styles.itemPrice}>${calculateItemTotal(item)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={styles.paymentSection}>
                  <h4>💳 Payment Information:</h4>
                  <div style={styles.paymentDetails}>
                    {getPaymentBadge(order.paymentMethod, order.creditAmount, order.cashAmount)}
                    <div style={styles.orderTotal}>
                      <strong>Total Amount: ${order.orderTotal?.toFixed(2)}</strong>
                    </div>
                  </div>
                </div>

                {order.orderNotes && (
                  <div style={styles.notesSection}>
                    <h4>📝 Order Notes:</h4>
                    <p style={styles.orderNotes}>{order.orderNotes}</p>
                  </div>
                )}

                {/* ACKNOWLEDGEMENT SECTION */}
                {canAcknowledgeOrder(order) && (
                  <div style={styles.acknowledgementSection}>
                    <h4>✅ Confirm Receipt</h4>
                    <p>Your order has been delivered. Please confirm you received all items.</p>
                    <button 
                      onClick={() => setAcknowledgingOrder(order)}
                      style={styles.acknowledgeButton}
                    >
                      📝 Confirm Order Receipt
                    </button>
                  </div>
                )}

                {/* ACKNOWLEDGEMENT DETAILS */}
                {isOrderAcknowledged(order) && (
                  <div style={styles.acknowledgedSection}>
                    <h4>✅ Order Confirmed</h4>
                    <p>You confirmed receipt on {formatDate(order.deliveryProof?.acknowledgedAt)}</p>
                    {order.deliveryProof?.rating > 0 && (
                      <p>Your rating: {order.deliveryProof.rating} ⭐</p>
                    )}
                    {order.deliveryProof?.customerNotes && (
                      <p>Your notes: "{order.deliveryProof.customerNotes}"</p>
                    )}
                  </div>
                )}

                <div style={styles.orderTimeline}>
                  <h4>📅 Order Timeline:</h4>
                  <div style={styles.timeline}>
                    <div style={styles.timelineItem}>
                      <span style={styles.timelineDot}></span>
                      <div style={styles.timelineContent}>
                        <strong>Order Placed</strong>
                        <span>{formatDate(order.createdAt)}</span>
                      </div>
                    </div>
                    {order.updatedAt && order.status !== 'pending_approval' && (
                      <div style={styles.timelineItem}>
                        <span style={styles.timelineDot}></span>
                        <div style={styles.timelineContent}>
                          <strong>Last Updated</strong>
                          <span>{formatDate(order.updatedAt)}</span>
                        </div>
                      </div>
                    )}
                    {isOrderAcknowledged(order) && (
                      <div style={styles.timelineItem}>
                        <span style={styles.timelineDot}></span>
                        <div style={styles.timelineContent}>
                          <strong>Receipt Confirmed</strong>
                          <span>{formatDate(order.deliveryProof?.acknowledgedAt)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {order.status === 'pending_approval' && (
                <div style={styles.pendingNotice}>
                  <p>⏰ <strong>Waiting for Approval:</strong> The shop needs to approve your credit request before processing your order.</p>
                </div>
              )}

              {order.status === 'ready' && (
                <div style={styles.readyNotice}>
                  <p>🎉 <strong>Ready for Pickup!</strong> Your order is ready for collection at the shop.</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ACKNOWLEDGEMENT MODAL */}
      {acknowledgingOrder && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <OrderAcknowledgement 
              order={acknowledgingOrder}
              onAcknowledged={handleAcknowledgementComplete}
            />
            <button 
              onClick={() => setAcknowledgingOrder(null)}
              style={styles.closeModalButton}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  // ... (keep all your existing styles from previous version)

  // ADD THESE NEW STYLES:
  acknowledgementSection: {
    padding: '1rem',
    backgroundColor: '#e8f4fd',
    border: '1px solid #3498db',
    borderRadius: '4px',
    marginBottom: '1rem',
    textAlign: 'center',
  },
  acknowledgedSection: {
    padding: '1rem',
    backgroundColor: '#d4edda',
    border: '1px solid #c3e6cb',
    borderRadius: '4px',
    marginBottom: '1rem',
    color: '#155724',
  },
  acknowledgeButton: {
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '600',
    marginTop: '0.5rem',
  },
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
    borderRadius: '8px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    width: '100%',
    maxWidth: '500px',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  closeModalButton: {
    backgroundColor: '#95a5a6',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '4px',
    cursor: 'pointer',
    width: '100%',
    marginTop: '1rem',
  },
};

export default CustomerOrderHistory;