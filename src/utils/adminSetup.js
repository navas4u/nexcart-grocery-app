// ==============================================
// 🛠️ ADMIN SETUP UTILITY
// ==============================================

import { db, auth } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';

/**
 * 🎯 CREATE INITIAL ADMIN USER
 * Run this once to create your first admin account
 * 
 * @param {Object} adminData - Admin user details
 * @param {string} adminData.email - Admin email
 * @param {string} adminData.password - Admin password  
 * @param {string} adminData.name - Admin display name
 * @returns {Object} Result object
 */
export const createInitialAdmin = async (adminData) => {
  try {
    console.log('👑 Starting initial admin setup...');
    
    // Validate input
    if (!adminData.email || !adminData.password) {
      throw new Error('Email and password are required');
    }

    // Step 1: Create Firebase Auth Account
    console.log('🔐 Creating Firebase auth account...');
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      adminData.email,
      adminData.password
    );
    
    const userId = userCredential.user.uid;
    console.log('✅ Auth account created:', userId);

    // Step 2: Create Admin Record in Firestore
    console.log('📝 Creating admin record in Firestore...');
    const adminRecord = {
      email: adminData.email,
      name: adminData.name || 'System Administrator',
      role: 'super_admin', // super_admin | support_admin
      permissions: ['all'], // Full permissions
      createdAt: new Date(),
      createdBy: 'system_initial_setup'
    };
    
    await setDoc(doc(db, 'admin_users', userId), adminRecord);
    console.log('✅ Admin record created in Firestore');

    // Step 3: Sign out for security
    console.log('🔒 Signing out for security...');
    await auth.signOut();
    
    // Step 4: Return success
    console.log('🎉 Initial admin setup completed successfully!');
    
    return { 
      success: true, 
      userId,
      message: `Admin user "${adminData.email}" created successfully! You can now login at /admin-login`
    };
    
  } catch (error) {
    console.error('❌ Admin creation failed:', error);
    
    // User-friendly error messages
    let errorMessage = 'Admin creation failed. ';
    
    switch (error.code) {
      case 'auth/email-already-in-use':
        errorMessage += 'This email is already registered.';
        break;
      case 'auth/invalid-email':
        errorMessage += 'Please enter a valid email address.';
        break;
      case 'auth/weak-password':
        errorMessage += 'Password is too weak. Please use a stronger password.';
        break;
      default:
        errorMessage += error.message;
    }
    
    return { 
      success: false, 
      error: errorMessage 
    };
  }
};

/**
 * 🎯 RUN ADMIN SETUP (One-time execution)
 * Copy and paste this function call in browser console
 */
export const runAdminSetup = async () => {
  const adminData = {
    email: 'admin@nexcart.com',    // Change this to your admin email
    password: 'AdminPass123!',     // Change this to a secure password
    name: 'Nexcart Administrator'  // Change this to your name
  };
  
  console.log('🚀 Starting admin setup...');
  console.log('📧 Email:', adminData.email);
  console.log('👤 Name:', adminData.name);
  
  const result = await createInitialAdmin(adminData);
  
  if (result.success) {
    console.log('✅ SUCCESS:', result.message);
    console.log('🔗 Login URL:', `${window.location.origin}/admin-login`);
  } else {
    console.error('❌ FAILED:', result.error);
  }
  
  return result;
};
    