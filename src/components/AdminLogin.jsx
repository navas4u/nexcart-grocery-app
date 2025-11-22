// ==============================================
// 🔐 ADMIN LOGIN COMPONENT
// ==============================================

import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { useAdmin } from '../contexts/AdminContext';
import { useLanguage } from '../contexts/LanguageContext';

const AdminLogin = () => {
  // ==============================================
  // 🎯 STATE MANAGEMENT
  // ==============================================
  const [credentials, setCredentials] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { checkAdminStatus } = useAdmin();
  const { t } = useLanguage();

  // ==============================================
  // 🔐 LOGIN HANDLER
  // ==============================================
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('🔐 Attempting admin login...');
      
      // Step 1: Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(
        auth, 
        credentials.email, 
        credentials.password
      );
      
      console.log('✅ Firebase auth successful:', userCredential.user.email);
      
      // Step 2: Verify Admin Privileges
      console.log('🔍 Checking admin privileges...');
      await checkAdminStatus();
      
      // Step 3: Redirect to Admin Dashboard
      console.log('🎉 Admin login successful! Redirecting...');
      window.location.href = '/admin';
      
    } catch (error) {
      console.error('❌ Admin login failed:', error);
      
      // User-friendly error messages
      switch (error.code) {
        case 'auth/user-not-found':
          setError('Admin account not found. Please check your email.');
          break;
        case 'auth/wrong-password':
          setError('Invalid password. Please try again.');
          break;
        case 'auth/invalid-email':
          setError('Please enter a valid email address.');
          break;
        case 'auth/too-many-requests':
          setError('Too many failed attempts. Please try again later.');
          break;
        default:
          setError('Login failed. Please check your credentials and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ==============================================
  // 🎨 RENDER COMPONENT
  // ==============================================
  return (
    <div style={styles.container}>
      <div style={styles.loginCard}>
        
        {/* ============================================== */}
        {/* 👑 HEADER SECTION */}
        {/* ============================================== */}
        <div style={styles.header}>
          <div style={styles.logo}>👑</div>
          <h1 style={styles.title}>Nexcart Admin</h1>
          <p style={styles.subtitle}>Platform Management System</p>
        </div>

        {/* ============================================== */}
        {/* 📝 LOGIN FORM */}
        {/* ============================================== */}
        <form onSubmit={handleAdminLogin} style={styles.form}>
          
          {/* Error Alert */}
          {error && (
            <div style={styles.errorAlert}>
              <span style={styles.errorIcon}>⚠️</span>
              <span>{error}</span>
            </div>
          )}
          
          {/* Email Input */}
          <div style={styles.inputGroup}>
            <label style={styles.label}>Admin Email</label>
            <input
              type="email"
              value={credentials.email}
              onChange={(e) => setCredentials({
                ...credentials, 
                email: e.target.value
              })}
              style={styles.input}
              placeholder="admin@nexcart.com"
              required
              disabled={loading}
            />
          </div>

          {/* Password Input */}
          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={credentials.password}
              onChange={(e) => setCredentials({
                ...credentials, 
                password: e.target.value
              })}
              style={styles.input}
              placeholder="Enter your password"
              required
              disabled={loading}
            />
          </div>

          {/* Login Button */}
          <button 
            type="submit" 
            style={loading ? styles.loginButtonDisabled : styles.loginButton}
            disabled={loading}
          >
            {loading ? (
              <>
                <div style={styles.loadingSpinner}></div>
                Authenticating...
              </>
            ) : (
              <>
                <span style={styles.buttonIcon}>🔐</span>
                Login as Admin
              </>
            )}
          </button>
        </form>

        {/* ============================================== */}
        {/* ⚠️ SECURITY NOTICE */}
        {/* ============================================== */}
        <div style={styles.securityNotice}>
          <div style={styles.securityIcon}>⚠️</div>
          <div>
            <p style={styles.noticeTitle}>Restricted Access</p>
            <p style={styles.noticeText}>
              This area is for authorized administrators only. 
              All access attempts are monitored and logged.
            </p>
          </div>
        </div>

        {/* ============================================== */}
        {/* 🔗 BACK TO MAIN APP */}
        {/* ============================================== */}
        <div style={styles.backLink}>
          <a 
            href="/shop-browser" 
            style={styles.backLinkText}
          >
            ← Back to Main App
          </a>
        </div>

      </div>
    </div>
  );
};

// ==============================================
// 🎨 STYLES
// ==============================================

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
    fontFamily: 'Arial, sans-serif'
  },
  loginCard: {
    background: 'white',
    padding: '40px',
    borderRadius: '16px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
    width: '100%',
    maxWidth: '420px',
    position: 'relative'
  },
  header: {
    textAlign: 'center',
    marginBottom: '40px'
  },
  logo: {
    fontSize: '64px',
    marginBottom: '16px',
    display: 'block'
  },
  title: {
    color: '#2c3e50',
    margin: '0 0 8px 0',
    fontSize: '28px',
    fontWeight: 'bold'
  },
  subtitle: {
    color: '#7f8c8d',
    margin: 0,
    fontSize: '14px',
    fontWeight: '500'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  errorAlert: {
    background: '#fee',
    color: '#c33',
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid #fcc',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  errorIcon: {
    fontSize: '16px'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  label: {
    color: '#2c3e50',
    fontSize: '14px',
    fontWeight: '600'
  },
  input: {
    padding: '16px',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    fontSize: '16px',
    transition: 'all 0.3s ease',
    outline: 'none'
  },
  inputFocus: {
    borderColor: '#3498db',
    boxShadow: '0 0 0 3px rgba(52, 152, 219, 0.1)'
  },
  loginButton: {
    background: '#3498db',
    color: 'white',
    border: 'none',
    padding: '16px',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '12px',
    transition: 'all 0.3s ease',
    marginTop: '10px'
  },
  loginButtonDisabled: {
    background: '#bdc3c7',
    color: 'white',
    border: 'none',
    padding: '16px',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '12px',
    marginTop: '10px',
    cursor: 'not-allowed'
  },
  buttonIcon: {
    fontSize: '18px'
  },
  loadingSpinner: {
    width: '20px',
    height: '20px',
    border: '2px solid transparent',
    borderTop: '2px solid white',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  securityNotice: {
    marginTop: '32px',
    padding: '20px',
    background: '#fff3cd',
    border: '1px solid #ffeaa7',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px'
  },
  securityIcon: {
    fontSize: '20px',
    marginTop: '2px'
  },
  noticeTitle: {
    color: '#856404',
    margin: '0 0 4px 0',
    fontSize: '14px',
    fontWeight: '600'
  },
  noticeText: {
    fontSize: '12px',
    color: '#856404',
    margin: 0,
    lineHeight: '1.4'
  },
  backLink: {
    marginTop: '24px',
    textAlign: 'center'
  },
  backLinkText: {
    color: '#3498db',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'color 0.3s ease'
  }
};

// Add CSS animation for spinner
const spinnerStyle = document.createElement('style');
spinnerStyle.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(spinnerStyle);

export default AdminLogin;