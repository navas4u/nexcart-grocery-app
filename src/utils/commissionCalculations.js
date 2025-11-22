// ==============================================
// 💰 COMMISSION CALCULATION ENGINE - ALL SALES
// ==============================================

import { db } from '../firebase';
import { 
  doc, 
  getDoc, 
  collection, 
  addDoc, 
  updateDoc, 
  increment,
  serverTimestamp 
} from 'firebase/firestore';

/**
 * Calculate and record commission for ALL sales (cash + credit)
 */
export const calculateAndRecordCommission = async (order, shopDetails) => {
  try {
    console.log('💰 Calculating commission for order:', order.id, 'Payment:', order.paymentMethod);
    
    // Get commission rate (same for all payment methods)
    const commissionRate = await getCommissionRate(order.shopId);
    
    // Calculate commission amount
    const commissionAmount = order.totalAmount * commissionRate;
    
    // Create commission record
    const commissionData = {
      shopId: order.shopId,
      shopName: shopDetails.shopName || 'Unknown Shop',
      orderId: order.id,
      saleAmount: order.totalAmount,
      paymentMethod: order.paymentMethod, // Track payment method
      commissionRate: commissionRate,
      commissionAmount: commissionAmount,
      saleDate: serverTimestamp(),
      customerId: order.customerId,
      customerName: order.customerName || 'Unknown Customer',
      status: 'pending',
      dueDate: calculateDueDate(30),
      createdBy: 'system',
      createdAt: serverTimestamp()
    };
    
    // Save to Firestore
    const commissionRef = await addDoc(
      collection(db, 'platform_commissions'), 
      commissionData
    );
    
    // Update platform revenue
    await updatePlatformRevenue(commissionAmount);
    
    console.log('✅ Commission recorded for', order.paymentMethod, 'sale:', commissionAmount);
    
    return {
      commissionId: commissionRef.id,
      commissionAmount,
      commissionRate,
      paymentMethod: order.paymentMethod
    };
    
  } catch (error) {
    console.error('❌ Error recording commission:', error);
    return null;
  }
};

/**
 * Record commission for ANY completed order
 * This should be called when order status changes to 'completed'
 */
export const recordCommissionForCompletedOrder = async (order, shopDetails) => {
  try {
    console.log('🎯 Recording commission for completed order:', order.id);
    
    // Check if commission already recorded for this order
    if (order.commissionRecorded) {
      console.log('ℹ️ Commission already recorded for order:', order.id);
      return null;
    }
    
    // Record commission for ALL completed orders
    const commissionResult = await calculateAndRecordCommission(order, shopDetails);
    
    if (commissionResult) {
      // Mark order as having commission recorded
      await updateDoc(doc(db, 'orders', order.id), {
        commissionRecorded: true,
        commissionId: commissionResult.commissionId,
        commissionAmount: commissionResult.commissionAmount,
        commissionRecordedAt: new Date()
      });
      
      console.log('✅ Commission recorded for completed order');
    }
    
    return commissionResult;
    
  } catch (error) {
    console.error('❌ Error recording commission for completed order:', error);
    return null;
  }
};

/**
 * Get commission rate for shop
 */
const getCommissionRate = async (shopId) => {
  try {
    // Check for shop-specific commission rate
    const shopCommissionRef = doc(db, 'shop_commissions', `${shopId}_rates`);
    const shopCommissionSnap = await getDoc(shopCommissionRef);
    
    if (shopCommissionSnap.exists()) {
      return shopCommissionSnap.data().commissionRate;
    }
    
    // Fall back to platform default rate
    const settingsRef = doc(db, 'platform_settings', 'commission_config');
    const settingsSnap = await getDoc(settingsRef);
    
    if (settingsSnap.exists()) {
      return settingsSnap.data().defaultCommissionRate;
    }
    
    // Ultimate fallback
    return 0.05;
    
  } catch (error) {
    console.error('❌ Error getting commission rate:', error);
    return 0.05;
  }
};

/**
 * Calculate commission due date
 */
const calculateDueDate = (dueDays) => {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + dueDays);
  return dueDate;
};

/**
 * Update platform revenue metrics
 */
// In commissionCalculations.js, UPDATE the updatePlatformRevenue function:

/**
 * Update platform revenue metrics - ENHANCED VERSION
 */
const updatePlatformRevenue = async (commissionAmount, status = 'pending') => {
  try {
    const settingsRef = doc(db, 'platform_settings', 'commission_config');
    
    const updateData = {
      totalProcessedSales: increment(1),
      updatedAt: serverTimestamp()
    };

    // 🆕 ONLY add to revenue if status is 'paid' immediately
    if (status === 'paid') {
      updateData.platformRevenue = increment(commissionAmount);
    }
    
    await updateDoc(settingsRef, updateData);
    
    console.log('📈 Platform stats updated. Revenue added:', status === 'paid' ? commissionAmount : '0 (pending)');
  } catch (error) {
    console.error('❌ Error updating platform revenue:', error);
  }
};

// 🆕 ADD THIS NEW FUNCTION for status-based revenue updates
export const updateRevenueOnStatusChange = async (commissionAmount, oldStatus, newStatus) => {
  try {
    const settingsRef = doc(db, 'platform_settings', 'commission_config');
    
    if (oldStatus !== 'paid' && newStatus === 'paid') {
      // Adding to revenue
      await updateDoc(settingsRef, {
        platformRevenue: increment(commissionAmount),
        updatedAt: new Date()
      });
      console.log(`💰 Revenue updated: +₹${commissionAmount}`);
    } else if (oldStatus === 'paid' && newStatus !== 'paid') {
      // Removing from revenue
      await updateDoc(settingsRef, {
        platformRevenue: increment(-commissionAmount),
        updatedAt: new Date()
      });
      console.log(`💰 Revenue updated: -₹${commissionAmount}`);
    }
  } catch (error) {
    console.error('❌ Error updating revenue on status change:', error);
    throw error;
  }
};

/**
 * Get commission statistics for dashboard
 */
export const getCommissionStats = async () => {
  try {
    const settingsRef = doc(db, 'platform_settings', 'commission_config');
    const settingsSnap = await getDoc(settingsRef);
    
    if (settingsSnap.exists()) {
      return settingsSnap.data();
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error getting commission stats:', error);
    return null;
  }
};

/**
 * Get all commissions for admin dashboard
 */
export const getAllCommissions = async (limit = 50) => {
  try {
    const { collection, query, orderBy, getDocs } = await import('firebase/firestore');
    const commissionsRef = collection(db, 'platform_commissions');
    const commissionsQuery = query(commissionsRef, orderBy('saleDate', 'desc'));
    const snapshot = await getDocs(commissionsQuery);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('❌ Error getting commissions:', error);
    return [];
  }
};