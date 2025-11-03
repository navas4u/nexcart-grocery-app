// src/components/ShopSetup.jsx
import { useState } from 'react';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const ShopSetup = ({ onSetupComplete }) => {
  const [formData, setFormData] = useState({
    shopName: '',
    description: '',
    address: '',
    phone: '',
    category: 'grocery',
    openingHours: '9:00 AM - 9:00 PM'
  });
  const [loading, setLoading] = useState(false);
  const auth = getAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const shopData = {
        ...formData,
        ownerId: auth.currentUser.uid,
        ownerEmail: auth.currentUser.email,
        createdAt: new Date(),
        isActive: true,
        totalProducts: 0,
        totalCustomers: 0
      };

      await setDoc(doc(db, 'shops', auth.currentUser.uid), shopData);
      console.log('✅ Shop created successfully!');
      onSetupComplete();
    } catch (error) {
      console.error('❌ Error creating shop:', error);
      alert('Error setting up shop. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2>🏪 Setup Your Store</h2>
        <p>Complete your store profile to start selling</p>
        
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label>Shop Name *</label>
            <input
              type="text"
              name="shopName"
              value={formData.shopName}
              onChange={handleChange}
              required
              style={styles.input}
              placeholder="Enter your shop name"
            />
          </div>

          <div style={styles.formGroup}>
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              style={styles.textarea}
              placeholder="Describe your shop and products"
              rows="3"
            />
          </div>

          <div style={styles.formGroup}>
            <label>Address *</label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              required
              style={styles.input}
              placeholder="Full shop address"
            />
          </div>

          <div style={styles.formGroup}>
            <label>Phone Number</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              style={styles.input}
              placeholder="Contact number"
            />
          </div>

          <div style={styles.formGroup}>
            <label>Category</label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              style={styles.select}
            >
              <option value="grocery">Grocery Store</option>
              <option value="convenience">Convenience Store</option>
              <option value="specialty">Specialty Food</option>
              <option value="vegetables">Vegetables & Fruits</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div style={styles.formGroup}>
            <label>Opening Hours</label>
            <input
              type="text"
              name="openingHours"
              value={formData.openingHours}
              onChange={handleChange}
              style={styles.input}
              placeholder="e.g., 9:00 AM - 9:00 PM"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={loading ? styles.buttonDisabled : styles.button}
          >
            {loading ? 'Creating Shop...' : 'Create My Shop'}
          </button>
        </form>
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '2rem',
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
  },
  card: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '8px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    maxWidth: '600px',
    margin: '0 auto',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    marginTop: '1.5rem',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
  },
  input: {
    padding: '0.75rem',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '1rem',
    marginTop: '0.5rem',
  },
  textarea: {
    padding: '0.75rem',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '1rem',
    resize: 'vertical',
    minHeight: '80px',
    marginTop: '0.5rem',
  },
  select: {
    padding: '0.75rem',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '1rem',
    marginTop: '0.5rem',
  },
  button: {
    backgroundColor: '#27ae60',
    color: 'white',
    padding: '1rem',
    border: 'none',
    borderRadius: '4px',
    fontSize: '1rem',
    cursor: 'pointer',
    marginTop: '1rem',
  },
  buttonDisabled: {
    backgroundColor: '#bdc3c7',
    color: 'white',
    padding: '1rem',
    border: 'none',
    borderRadius: '4px',
    fontSize: '1rem',
    cursor: 'not-allowed',
    marginTop: '1rem',
  },
};

export default ShopSetup;