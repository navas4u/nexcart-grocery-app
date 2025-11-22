// ==============================================
// 🔐 ADMIN AUTHENTICATION CONTEXT
// ==============================================

import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

// Create Context
const AdminContext = createContext();

/**
 * Custom hook to use admin context
 * @returns {Object} Admin context value
 */
export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};

/**
 * Admin Provider Component
 * Manages admin authentication state and permissions
 */
export const AdminProvider = ({ children }) => {
  // ==============================================
  // 🎯 STATE MANAGEMENT
  // ==============================================
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUser, setAdminUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ==============================================
  // 🔍 AUTH STATE LISTENER
  // ==============================================
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User is signed in - check admin status
        await checkAdminStatus(user);
      } else {
        // User is signed out
        handleUserSignedOut();
      }
    });

    return unsubscribe;
  }, []);

  // ==============================================
  // 🔎 CHECK ADMIN STATUS
  // ==============================================
  const checkAdminStatus = async (user = auth.currentUser) => {
    if (!user) {
      setIsAdmin(false);
      setAdminUser(null);
      setLoading(false);
      return;
    }

    try {
      console.log('🔍 Checking admin status for user:', user.email);
      
      const adminDoc = await getDoc(doc(db, 'admin_users', user.uid));
      
      if (adminDoc.exists()) {
        // User is admin
        const adminData = adminDoc.data();
        setIsAdmin(true);
        setAdminUser({ 
          id: adminDoc.id, 
          ...adminData 
        });
        console.log('✅ User is admin:', adminData.role);
      } else {
        // User is not admin
        console.log('❌ User is not admin');
        setIsAdmin(false);
        setAdminUser(null);
      }
    } catch (error) {
      console.error('❌ Error checking admin status:', error);
      setIsAdmin(false);
      setAdminUser(null);
    } finally {
      setLoading(false);
    }
  };

  // ==============================================
  // 🚪 HANDLE USER SIGN OUT
  // ==============================================
  const handleUserSignedOut = () => {
    console.log('👋 User signed out - clearing admin state');
    setIsAdmin(false);
    setAdminUser(null);
    setLoading(false);
  };

  // ==============================================
  // 📤 CONTEXT VALUE
  // ==============================================
  const value = {
    isAdmin,
    adminUser,
    loading,
    checkAdminStatus
  };

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
};