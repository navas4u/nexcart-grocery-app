import { useState } from 'react';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase'; // REMOVED duplicate import

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState('customer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // REMOVED duplicate auth/db declarations - already imported above

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        // LOGIN LOGIC
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Fetch user role from Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const userRole = userData.role || 'customer';
          
          // Save to localStorage for persistence
          localStorage.setItem(`userRole_${user.uid}`, userRole);
          console.log('User logged in with role:', userRole);
        } else {
          console.log('No user document found, defaulting to customer');
          localStorage.setItem(`userRole_${user.uid}`, 'customer');
        }
        
      } else {
        // REGISTRATION LOGIC
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Create user document in Firestore with role
        const userData = {
          email: email,
          role: role,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Save to Firestore
        await setDoc(doc(db, 'users', user.uid), userData);

        // Also save to localStorage for immediate access
        localStorage.setItem(`userRole_${user.uid}`, role);
        console.log('User registered with role:', role);
      }
    } catch (error) {
      console.error('Authentication error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2>{isLogin ? 'Login' : 'Register'} 🛒</h2>
        
        {error && (
          <div style={styles.error}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label>Email:</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={styles.input}
              placeholder="Enter your email"
            />
          </div>

          <div style={styles.formGroup}>
            <label>Password:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={styles.input}
              placeholder="Enter your password"
            />
          </div>

          {!isLogin && (
            <div style={styles.formGroup}>
              <label>Register as:</label>
              <div style={styles.roleOptions}>
                <label style={styles.radioLabel}>
                  <input
                    type="radio"
                    value="customer"
                    checked={role === 'customer'}
                    onChange={(e) => setRole(e.target.value)}
                    style={styles.radio}
                  />
                  🧑 Customer
                </label>
                <label style={styles.radioLabel}>
                  <input
                    type="radio"
                    value="shop_owner"
                    checked={role === 'shop_owner'}
                    onChange={(e) => setRole(e.target.value)}
                    style={styles.radio}
                  />
                  🏪 Shop Owner
                </label>
              </div>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            style={loading ? styles.buttonDisabled : styles.button}
          >
            {loading ? 'Processing...' : (isLogin ? 'Login' : 'Register')}
          </button>
        </form>
        <p style={styles.switchText}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span 
            style={styles.switchLink}
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
          >
            {isLogin ? 'Register' : 'Login'}
          </span>
        </p>

        {/* Debug Info */}
        <div style={styles.debugInfo}>
          <p><strong>Current Mode:</strong> {isLogin ? 'Login' : 'Register'}</p>
          <p><strong>Selected Role:</strong> {role}</p>
        </div>
      </div>
    </div>
  );
};

// Styles
const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    padding: '1rem',
  },
  card: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '8px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    width: '100%',
    maxWidth: '400px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
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
    marginTop: '0.25rem',
  },
  roleOptions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    marginTop: '0.5rem',
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
  },
  radio: {
    margin: 0,
  },
  button: {
    backgroundColor: '#3498db',
    color: 'white',
    padding: '0.75rem',
    border: 'none',
    borderRadius: '4px',
    fontSize: '1rem',
    cursor: 'pointer',
    marginTop: '1rem',
  },
  buttonDisabled: {
    backgroundColor: '#bdc3c7',
    color: 'white',
    padding: '0.75rem',
    border: 'none',
    borderRadius: '4px',
    fontSize: '1rem',
    cursor: 'not-allowed',
    marginTop: '1rem',
  },
  resetButton: {
    backgroundColor: '#e74c3c',
    color: 'white',
    border: 'none',
    padding: '0.75rem',
    borderRadius: '4px',
    cursor: 'pointer',
    marginTop: '1rem',
    width: '100%',
  },
  error: {
    backgroundColor: '#ffeaa7',
    color: '#d63031',
    padding: '0.75rem',
    borderRadius: '4px',
    border: '1px solid #fab1a0',
    marginBottom: '1rem',
  },
  switchText: {
    textAlign: 'center',
    marginTop: '1rem',
  },
  switchLink: {
    color: '#3498db',
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  debugInfo: {
    marginTop: '1rem',
    padding: '1rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '4px',
    fontSize: '0.8rem',
    color: '#666',
  },
};

export default Auth;