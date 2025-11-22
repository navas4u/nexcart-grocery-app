// ==============================================
// 🏗️ PLATFORM SETUP UTILITIES
// ==============================================

import { db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

/**
 * Initialize platform settings if they don't exist
 */
export const initializePlatformSettings = async () => {
  try {
    const settingsRef = doc(db, 'platform_settings', 'commission_config');
    const settingsSnap = await getDoc(settingsRef);
    
    if (!settingsSnap.exists()) {
      const defaultSettings = {
        defaultCommissionRate: 0.05,      // 5% default commission
        minCommissionRate: 0.02,          // 2% minimum
        maxCommissionRate: 0.10,          // 10% maximum  
        commissionDueDays: 30,            // 30 days payment terms
        platformRevenue: 0,               // Total platform earnings
        totalProcessedSales: 0,           // Total sales processed
        updatedBy: 'system',
        updatedAt: new Date()
      };
      
      await setDoc(settingsRef, defaultSettings);
      console.log('✅ Platform settings initialized');
      return defaultSettings;
    }
    
    console.log('✅ Platform settings already exist');
    return settingsSnap.data();
    
  } catch (error) {
    console.error('❌ Error initializing platform settings:', error);
    throw error;
  }
};

/**
 * Run platform setup (call this once)
 */
export const runPlatformSetup = async () => {
  try {
    console.log('🚀 Starting platform setup...');
    const settings = await initializePlatformSettings();
    console.log('✅ Platform setup completed:', settings);
    return settings;
  } catch (error) {
    console.error('❌ Platform setup failed:', error);
    throw error;
  }
};