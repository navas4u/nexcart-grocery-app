// src/components/OrderAcknowledgement.jsx
import { useState } from 'react';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

const OrderAcknowledgement = ({ order, onAcknowledged }) => {
  const [rating, setRating] = useState(0);
  const [customerNotes, setCustomerNotes] = useState('');
  const [acknowledging, setAcknowledging] = useState(false);
  const auth = getAuth();

  const acknowledgeOrder = async () => {
    setAcknowledging(true);
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status: 'acknowledged',
        deliveryProof: {
          acknowledged: true,
          acknowledgedAt: new Date(),
          acknowledgedBy: auth.currentUser.uid,
          customerNotes: customerNotes,
          rating: rating,
          photos: [] // Can add photo upload later
        },
        updatedAt: new Date()
      });
      
      if (onAcknowledged) {
        onAcknowledged();
      }
      
      alert('✅ Order acknowledged successfully! Thank you for your confirmation.');
    } catch (error) {
      console.error('Error acknowledging order:', error);
      alert('Error acknowledging order. Please try again.');
    } finally {
      setAcknowledging(false);
    }
  };

  return (
    <div style={styles.container}>
      <h3>✅ Confirm Order Receipt</h3>
      <p>Please confirm you have received all items from your order.</p>
      
      <div style={styles.section}>
        <h4>Rate Your Experience</h4>
        <div style={styles.rating}>
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              onClick={() => setRating(star)}
              style={star <= rating ? styles.starActive : styles.star}
            >
              ⭐
            </button>
          ))}
        </div>
      </div>

      <div style={styles.section}>
        <h4>Additional Notes (Optional)</h4>
        <textarea
          value={customerNotes}
          onChange={(e) => setCustomerNotes(e.target.value)}
          placeholder="Any feedback about the order, delivery, or items received..."
          style={styles.textarea}
          rows="3"
        />
      </div>

      <div style={styles.itemsChecklist}>
        <h4>Items Received Checklist</h4>
        {order.items.map((item, index) => (
          <div key={index} style={styles.checklistItem}>
            <span>✅</span>
            <span>{item.quantity} {item.unit} of {item.name}</span>
          </div>
        ))}
      </div>

      <button
        onClick={acknowledgeOrder}
        disabled={acknowledging || rating === 0}
        style={acknowledging || rating === 0 ? styles.buttonDisabled : styles.acknowledgeButton}
      >
        {acknowledging ? 'Confirming...' : '✅ Confirm Order Receipt'}
      </button>
      
      <p style={styles.note}>
        <small>By confirming, you acknowledge that you have received all items in good condition.</small>
      </p>
    </div>
  );
};

const styles = {
  container: {
    padding: '1.5rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    border: '1px solid #e9ecef',
  },
  section: {
    marginBottom: '1.5rem',
  },
  rating: {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '0.5rem',
  },
  star: {
    background: 'none',
    border: 'none',
    fontSize: '1.5rem',
    cursor: 'pointer',
    opacity: 0.6,
  },
  starActive: {
    background: 'none',
    border: 'none',
    fontSize: '1.5rem',
    cursor: 'pointer',
    opacity: 1,
  },
  textarea: {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '1rem',
    resize: 'vertical',
  },
  itemsChecklist: {
    marginBottom: '1.5rem',
  },
  checklistItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem',
    backgroundColor: 'white',
    marginBottom: '0.25rem',
    borderRadius: '4px',
  },
  acknowledgeButton: {
    backgroundColor: '#27ae60',
    color: 'white',
    border: 'none',
    padding: '1rem 2rem',
    borderRadius: '4px',
    fontSize: '1rem',
    cursor: 'pointer',
    width: '100%',
    fontWeight: '600',
  },
  buttonDisabled: {
    backgroundColor: '#bdc3c7',
    color: 'white',
    border: 'none',
    padding: '1rem 2rem',
    borderRadius: '4px',
    fontSize: '1rem',
    cursor: 'not-allowed',
    width: '100%',
    fontWeight: '600',
  },
  note: {
    textAlign: 'center',
    color: '#7f8c8d',
    marginTop: '1rem',
    fontSize: '0.9rem',
  }
};

export default OrderAcknowledgement;