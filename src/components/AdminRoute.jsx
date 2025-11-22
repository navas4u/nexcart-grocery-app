// ==============================================
// 🛡️ SIMPLE ADMIN ROUTE - NO NAVIGATE
// ==============================================

import React from 'react';
import { useAdmin } from '../contexts/AdminContext';

const AdminRoute = ({ children }) => {
  const { isAdmin, loading } = useAdmin();

  if (loading) {
    return (
      <div style={styles.loading}>
        <h3>Checking Admin Access...</h3>
        <p>Please wait while we verify your permissions.</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={styles.accessDenied}>
        <h2>🚫 Admin Access Required</h2>
        <p>You don't have permission to access the admin dashboard.</p>
        <div style={styles.buttons}>
          <button 
            onClick={() => window.location.href = '/admin-login'}
            style={styles.button}
          >
            Go to Admin Login
          </button>
          <button 
            onClick={() => window.location.href = '/'}
            style={styles.secondaryButton}
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return children;
};

const styles = {
  loading: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    textAlign: 'center'
  },
  accessDenied: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    textAlign: 'center',
    padding: '20px'
  },
  buttons: {
    marginTop: '20px',
    display: 'flex',
    gap: '10px'
  },
  button: {
    background: '#3498db',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '6px',
    cursor: 'pointer'
  },
  secondaryButton: {
    background: '#95a5a6',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '6px',
    cursor: 'pointer'
  }
};

export default AdminRoute;