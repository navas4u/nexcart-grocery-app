// src/components/CustomerProfile.jsx
import { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const CustomerProfile = () => {
  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    whatsapp: '',
    address: {
      street: '',
      area: '',
      city: '',
      state: '',
      pincode: '',
      landmark: ''
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const auth = getAuth();

  // Load profile data
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'customers', auth.currentUser.uid));
      if (userDoc.exists()) {
        setProfile(userDoc.data());
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!profile.firstName || !profile.phone) {
      alert('Please fill at least First Name and Phone Number');
      return;
    }

    setSaving(true);
    try {
      await setDoc(doc(db, 'customers', auth.currentUser.uid), {
        ...profile,
        email: auth.currentUser.email,
        updatedAt: new Date(),
        isProfileComplete: true
      });
      alert('Profile saved successfully!');
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Error saving profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setProfile(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddressChange = (field, value) => {
    setProfile(prev => ({
      ...prev,
      address: {
        ...prev.address,
        [field]: value
      }
    }));
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        <h3>Loading your profile...</h3>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2>👤 My Profile</h2>
      <p style={styles.subtitle}>Manage your personal information and delivery address</p>
      
      <div style={styles.form}>
        {/* Personal Information */}
        <div style={styles.section}>
          <h3>Personal Information</h3>
          <div style={styles.formRow}>
            <div style={styles.inputGroup}>
              <label>First Name *</label>
              <input
                type="text"
                placeholder="Enter your first name"
                value={profile.firstName}
                onChange={(e) => handleChange('firstName', e.target.value)}
                style={styles.input}
              />
            </div>
            <div style={styles.inputGroup}>
              <label>Last Name</label>
              <input
                type="text"
                placeholder="Enter your last name"
                value={profile.lastName}
                onChange={(e) => handleChange('lastName', e.target.value)}
                style={styles.input}
              />
            </div>
          </div>
          
          <div style={styles.formRow}>
            <div style={styles.inputGroup}>
              <label>Phone Number *</label>
              <input
                type="tel"
                placeholder="10-digit mobile number"
                value={profile.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                style={styles.input}
              />
            </div>
            <div style={styles.inputGroup}>
              <label>WhatsApp Number</label>
              <input
                type="tel"
                placeholder="Same as phone or different"
                value={profile.whatsapp}
                onChange={(e) => handleChange('whatsapp', e.target.value)}
                style={styles.input}
              />
            </div>
          </div>
        </div>

        {/* Address Information */}
        <div style={styles.section}>
          <h3>📍 Delivery Address</h3>
          <div style={styles.inputGroup}>
            <label>Street Address *</label>
            <input
              type="text"
              placeholder="House no, Building, Street name"
              value={profile.address.street}
              onChange={(e) => handleAddressChange('street', e.target.value)}
              style={styles.inputFull}
            />
          </div>
          
          <div style={styles.formRow}>
            <div style={styles.inputGroup}>
              <label>Area/Locality *</label>
              <input
                type="text"
                placeholder="Area or locality name"
                value={profile.address.area}
                onChange={(e) => handleAddressChange('area', e.target.value)}
                style={styles.input}
              />
            </div>
            <div style={styles.inputGroup}>
              <label>City *</label>
              <input
                type="text"
                placeholder="Your city"
                value={profile.address.city}
                onChange={(e) => handleAddressChange('city', e.target.value)}
                style={styles.input}
              />
            </div>
          </div>
          
          <div style={styles.formRow}>
            <div style={styles.inputGroup}>
              <label>State *</label>
              <input
                type="text"
                placeholder="Your state"
                value={profile.address.state}
                onChange={(e) => handleAddressChange('state', e.target.value)}
                style={styles.input}
              />
            </div>
            <div style={styles.inputGroup}>
              <label>Pincode *</label>
              <input
                type="text"
                placeholder="6-digit pincode"
                value={profile.address.pincode}
                onChange={(e) => handleAddressChange('pincode', e.target.value)}
                style={styles.input}
              />
            </div>
          </div>
          
          <div style={styles.inputGroup}>
            <label>Landmark (optional)</label>
            <input
              type="text"
              placeholder="Nearby famous landmark"
              value={profile.address.landmark}
              onChange={(e) => handleAddressChange('landmark', e.target.value)}
              style={styles.inputFull}
            />
          </div>
        </div>

        <button 
          onClick={saveProfile}
          disabled={saving}
          style={saving ? styles.buttonDisabled : styles.saveButton}
        >
          {saving ? '⏳ Saving...' : '💾 Save Profile'}
        </button>
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '2rem',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    maxWidth: '800px',
    margin: '0 auto',
  },
  subtitle: {
    color: '#7f8c8d',
    marginBottom: '2rem',
    textAlign: 'center',
  },
  loading: {
    textAlign: 'center',
    padding: '3rem',
    color: '#7f8c8d',
  },
  section: {
    marginBottom: '2rem',
    padding: '1.5rem',
    border: '1px solid #ecf0f1',
    borderRadius: '8px',
    backgroundColor: '#f8f9fa',
  },
  formRow: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '1rem',
  },
  inputGroup: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  input: {
    padding: '0.75rem',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '1rem',
    marginTop: '0.25rem',
  },
  inputFull: {
    padding: '0.75rem',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '1rem',
    marginTop: '0.25rem',
    width: '100%',
  },
  saveButton: {
    backgroundColor: '#27ae60',
    color: 'white',
    border: 'none',
    padding: '1rem 2rem',
    borderRadius: '4px',
    fontSize: '1.1rem',
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
    fontSize: '1.1rem',
    cursor: 'not-allowed',
    width: '100%',
    fontWeight: '600',
  }
};

export default CustomerProfile;