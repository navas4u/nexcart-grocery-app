// src/components/ReturnPolicyManager.jsx
import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

const ReturnPolicyManager = ({ shopId }) => {
  const [returnPolicy, setReturnPolicy] = useState({
    returnWindowHours: 24,
    allowReturns: true,
    perishableWindow: 6,
    allowedReasons: ['damaged', 'wrong_item', 'quality_issues']
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchShopSettings();
  }, [shopId]);

  const fetchShopSettings = async () => {
    try {
      const shopRef = doc(db, 'shops', shopId);
      const shopDoc = await getDoc(shopRef);
      
      if (shopDoc.exists()) {
        const shopData = shopDoc.data();
        if (shopData.returnPolicy) {
          setReturnPolicy(shopData.returnPolicy);
        }
        // If no returnPolicy exists, use defaults (already set)
      }
    } catch (error) {
      console.error('Error fetching shop settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveReturnPolicy = async () => {
    setSaving(true);
    try {
      const shopRef = doc(db, 'shops', shopId);
      await updateDoc(shopRef, {
        returnPolicy: returnPolicy
      });
      alert('✅ Return policy saved successfully!');
    } catch (error) {
      console.error('Error saving return policy:', error);
      alert('❌ Error saving return policy: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleReason = (reason) => {
    const newReasons = returnPolicy.allowedReasons.includes(reason)
      ? returnPolicy.allowedReasons.filter(r => r !== reason)
      : [...returnPolicy.allowedReasons, reason];
    
    setReturnPolicy(prev => ({ ...prev, allowedReasons: newReasons }));
  };

  if (loading) return <div style={styles.loading}>Loading return policy...</div>;

  return (
    <div style={styles.container}>
      <h3>🔄 Return Policy Settings</h3>
      <p style={styles.description}>Configure your shop's return policy and time windows</p>
      
      <div style={styles.settingGroup}>
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={returnPolicy.allowReturns}
            onChange={(e) => setReturnPolicy(prev => ({
              ...prev,
              allowReturns: e.target.checked
            }))}
            style={styles.checkbox}
          />
          <strong>Allow Returns</strong>
          <div style={styles.helpText}>Enable or disable returns for your shop</div>
        </label>
      </div>

      {returnPolicy.allowReturns && (
        <>
          <div style={styles.settingGroup}>
            <label style={styles.label}>
              <strong>Return Window Hours:</strong>
              <div style={styles.inputContainer}>
                <input
                  type="number"
                  value={returnPolicy.returnWindowHours}
                  onChange={(e) => setReturnPolicy(prev => ({
                    ...prev,
                    returnWindowHours: Math.max(1, parseInt(e.target.value) || 24)
                  }))}
                  min="1"
                  max="168"
                  style={styles.numberInput}
                />
                <span style={styles.unit}>hours</span>
              </div>
              <div style={styles.helpText}>
                Hours after order completion when returns are allowed (1-168 hours)
              </div>
            </label>
          </div>

          <div style={styles.settingGroup}>
            <label style={styles.label}>
              <strong>Perishables Window Hours:</strong>
              <div style={styles.inputContainer}>
                <input
                  type="number"
                  value={returnPolicy.perishableWindow}
                  onChange={(e) => setReturnPolicy(prev => ({
                    ...prev,
                    perishableWindow: Math.max(1, parseInt(e.target.value) || 6)
                  }))}
                  min="1"
                  max="24"
                  style={styles.numberInput}
                />
                <span style={styles.unit}>hours</span>
              </div>
              <div style={styles.helpText}>
                Shorter return window for perishable items (fruits, vegetables, dairy)
              </div>
            </label>
          </div>

          <div style={styles.settingGroup}>
            <label style={styles.label}>
              <strong>Allowed Return Reasons:</strong>
              <div style={styles.helpText}>Select which return reasons customers can use</div>
            </label>
            <div style={styles.reasonsGrid}>
              {[
                { value: 'damaged', label: 'Damaged Product' },
                { value: 'wrong_item', label: 'Wrong Item Delivered' },
                { value: 'quality_issues', label: 'Quality Issues' },
                { value: 'customer_change_mind', label: 'Customer Changed Mind' }
              ].map(({ value, label }) => (
                <label key={value} style={styles.reasonLabel}>
                  <input
                    type="checkbox"
                    checked={returnPolicy.allowedReasons.includes(value)}
                    onChange={() => toggleReason(value)}
                    style={styles.checkbox}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </>
      )}

      <button 
        onClick={saveReturnPolicy} 
        disabled={saving}
        style={saving ? styles.saveButtonDisabled : styles.saveButton}
      >
        {saving ? '💾 Saving...' : '💾 Save Return Policy'}
      </button>
    </div>
  );
};

const styles = {
  container: {
    padding: '1.5rem',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    marginBottom: '2rem',
    border: '1px solid #e1e8ed'
  },
  loading: {
    textAlign: 'center',
    padding: '2rem',
    color: '#7f8c8d'
  },
  description: {
    color: '#7f8c8d',
    marginBottom: '1.5rem'
  },
  settingGroup: {
    marginBottom: '2rem',
    padding: '1.5rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '6px',
    border: '1px solid #e9ecef'
  },
  label: {
    display: 'block',
    marginBottom: '0.5rem'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.5rem',
    cursor: 'pointer'
  },
  reasonLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem',
    cursor: 'pointer',
    borderRadius: '4px',
    transition: 'background-color 0.2s'
  },
  reasonsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.5rem',
    marginTop: '1rem'
  },
  inputContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    margin: '0.5rem 0'
  },
  numberInput: {
    padding: '0.5rem',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    width: '80px',
    fontSize: '1rem'
  },
  unit: {
    color: '#7f8c8d',
    fontSize: '0.9rem'
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer'
  },
  helpText: {
    fontSize: '0.8rem',
    color: '#6c757d',
    marginTop: '0.25rem'
  },
  saveButton: {
    backgroundColor: '#27ae60',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '600'
  },
  saveButtonDisabled: {
    backgroundColor: '#bdc3c7',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '6px',
    cursor: 'not-allowed',
    fontSize: '1rem',
    fontWeight: '600'
  }
};

export default ReturnPolicyManager;