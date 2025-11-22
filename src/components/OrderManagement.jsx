// src/components/OrderManagement.jsx - WITH COMMISSION INTEGRATION
import { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, query, where, orderBy, onSnapshot, doc, updateDoc, arrayUnion, getDocs, getDoc, setDoc, increment} from 'firebase/firestore';
import { db } from '../firebase';


const OrderManagement = ({ shopId }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [shopPolicy, setShopPolicy] = useState({
  returnWindowHours: 24,
  allowReturns: true,
  perishableWindow: 6,
  allowedReasons: ['damaged', 'wrong_item', 'quality_issues']
});
  
  // ENHANCED STATES FOR COMPREHENSIVE MANAGEMENT
  const [preparingOrder, setPreparingOrder] = useState(null);
  const [preparedItems, setPreparedItems] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [showItemReplacement, setShowItemReplacement] = useState(null);
  const [showCancellationModal, setShowCancellationModal] = useState(null);
  const [showReturnModal, setShowReturnModal] = useState(null);
  
  // AUTO-SYNC: Fix preparedItems when order changes
useEffect(() => {
  if (preparingOrder && preparedItems.length > 0) {
    const currentProductIds = preparingOrder.items.map(item => item.productId);
    const validPreparedItems = preparedItems.filter(id => currentProductIds.includes(id));
    
    if (validPreparedItems.length !== preparedItems.length) {
      console.log('🔄 Auto-syncing prepared items');
      setPreparedItems(validPreparedItems);
    }
  }
}, [preparingOrder]); // Runs when preparingOrder changes

  // Real-time orders listener
  useEffect(() => {
  if (shopId) {
    fetchShopPolicy();
  }
}, [shopId]);
const fetchShopPolicy = async () => {
  try {
    const shopRef = doc(db, 'shops', shopId);
    const shopDoc = await getDoc(shopRef);
    
    if (shopDoc.exists() && shopDoc.data().returnPolicy) {
      setShopPolicy(shopDoc.data().returnPolicy);
    }
  } catch (error) {
    console.error('Error fetching shop policy:', error);
  }
};
// Enhanced return eligibility check
const checkReturnEligibility = (order) => {
  if (!shopPolicy.allowReturns) {
    return { eligible: false, reason: 'Returns are disabled for this shop' };
  }

  // Find completion time
  const completionTime = order.completedAt?.toDate() || order.updatedAt?.toDate();
  if (!completionTime) {
    return { eligible: false, reason: 'Order completion time not found' };
  }

  const currentTime = new Date();
  const hoursSinceCompletion = (currentTime - completionTime) / (1000 * 60 * 60);
  
  // Check if within return window
  if (hoursSinceCompletion > shopPolicy.returnWindowHours) {
    const hoursOver = Math.ceil(hoursSinceCompletion - shopPolicy.returnWindowHours);
    return { 
      eligible: false, 
      reason: `Return window expired ${hoursOver} hours ago` 
    };
  }

  const hoursRemaining = Math.ceil(shopPolicy.returnWindowHours - hoursSinceCompletion);
  
  return { 
    eligible: true, 
    hoursRemaining: hoursRemaining,
    message: `Returns allowed for ${hoursRemaining} more hours`
  };
};

  useEffect(() => {
    if (!shopId) return;

    setLoading(true);
    const ordersQuery = query(
      collection(db, 'orders'),
      where('shopId', '==', shopId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(ordersQuery, 
      (snapshot) => {
        const ordersList = [];
        snapshot.forEach((doc) => {
          ordersList.push({ id: doc.id, ...doc.data() });
        });
        setOrders(ordersList);
        setLoading(false);
        setError(null);
      },
      (error) => {
        console.error('Real-time listener error:', error);
        setError('Failed to load orders. Please refresh.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [shopId]);

  // Fetch shop products for substitutions
  const fetchShopProducts = async () => {
    try {
      const productsQuery = query(
        collection(db, 'products'),
        where('shopId', '==', shopId)
      );
      const querySnapshot = await getDocs(productsQuery);
      
      const productsList = [];
      querySnapshot.forEach((doc) => {
        productsList.push({ id: doc.id, ...doc.data() });
      });
      
      setAvailableProducts(productsList);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

// CREDIT APPROVAL FUNCTION - WITH COMMISSION INTEGRATION
const approveCreditOrder = async (order) => {
  try {
    console.log('=== APPROVING CREDIT ORDER ===');
    console.log('Order:', order.id);
    console.log('Payment Method:', order.paymentMethod);
    console.log('Customer ID:', order.customerId);

    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      alert('❌ You must be logged in to approve credit');
      return;
    }

    // CALCULATE CREDIT AMOUNT BASED ON PAYMENT METHOD
    let creditAmountToApprove = 0;
    let paymentDescription = '';
    
    if (order.paymentMethod === 'credit') {
      creditAmountToApprove = order.totalAmount || order.orderTotal || 0;
      paymentDescription = 'Full Credit Purchase';
    } else if (order.paymentMethod === 'split_payment') {
      creditAmountToApprove = order.creditAmount || 0;
      const cashAmount = order.cashAmount || 0;
      paymentDescription = `Split Payment (Credit: ₹${creditAmountToApprove}, Cash: ₹${cashAmount})`;
    }

    console.log('Credit amount to approve:', creditAmountToApprove);

    if (order.paymentMethod === 'split_payment' && (!order.creditAmount || order.creditAmount <= 0)) {
      alert('❌ Split payment order has no credit amount to approve');
      return;
    }

    if (creditAmountToApprove <= 0) {
      alert('❌ Invalid credit amount');
      return;
    }

    // ============================================================================
    // 🆕 ENHANCED DEBUGGING: GET CUSTOMER PHONE FROM CUSTOMERS COLLECTION
    // ============================================================================
    let customerPhone = '';
    try {
      console.log('🔍 DEBUG: Fetching customer document for ID:', order.customerId);
      const customerDoc = await getDoc(doc(db, 'customers', order.customerId));
      
      if (customerDoc.exists()) {
        const customerData = customerDoc.data();
        console.log('🔍 DEBUG: Full customer data:', customerData);
        
        // 🆕 MULTIPLE PHONE FIELD ATTEMPTS - TRY DIFFERENT FIELD NAMES
        customerPhone = customerData.phone || 
                       customerData.phoneNumber || 
                       customerData.mobile || 
                       customerData.contactNumber || 
                       '';
        
        console.log('🔍 DEBUG: Phone field attempts:');
        console.log('  - phone:', customerData.phone);
        console.log('  - phoneNumber:', customerData.phoneNumber);
        console.log('  - mobile:', customerData.mobile);
        console.log('  - contactNumber:', customerData.contactNumber);
        console.log('📞 FINAL Selected phone:', customerPhone);
        
        // Also update customer name if not set in order
        if (!order.customerName) {
          if (customerData.firstName) {
            order.customerName = customerData.firstName + ' ' + (customerData.lastName || '');
            console.log('👤 DEBUG: Updated customer name:', order.customerName);
          } else if (customerData.name) {
            order.customerName = customerData.name;
            console.log('👤 DEBUG: Updated customer name from name field:', order.customerName);
          }
        }
      } else {
        console.log('❌ DEBUG: No customer profile found with ID:', order.customerId);
        console.log('❌ DEBUG: Customer document does not exist in customers collection');
      }
    } catch (phoneError) {
      console.log('❌ DEBUG: Error fetching customer phone:', phoneError);
      console.log('❌ DEBUG: Error details:', phoneError.message);
      // Continue without phone - don't block credit approval
    }

    // ============================================================================
    // 1. CHECK/CREATE CUSTOMER CREDIT ACCOUNT (ENHANCED WITH PHONE)
    // ============================================================================
    const creditDocId = `${order.customerId}_${order.shopId}`;
    const creditRef = doc(db, 'customer_credits', creditDocId);
    
    console.log('🔍 DEBUG: Credit document ID:', creditDocId);
    
    // Try to get existing credit account
    let creditDoc;
    try {
      creditDoc = await getDoc(creditRef);
      console.log('🔍 DEBUG: Existing credit account found:', creditDoc.exists());
    } catch (error) {
      console.log('🔍 DEBUG: No existing credit account found');
    }

    if (!creditDoc || !creditDoc.exists()) {
      // CREATE NEW CREDIT ACCOUNT WITH ₹5000 DEFAULT LIMIT + PHONE
      console.log('🆕 DEBUG: Creating new credit account with phone:', customerPhone);
      
      const newCreditData = {
        id: creditDocId,
        shopId: order.shopId,
        customerId: order.customerId,
        customerEmail: order.customerEmail,
        customerName: order.customerName || order.customerEmail.split('@')[0],
        // 🆕 ADD PHONE NUMBER TO CREDIT RECORD
        phoneNumber: customerPhone, // This enables future search!
        creditLimit: 5000, // ₹5000 DEFAULT LIMIT
        currentBalance: creditAmountToApprove,
        availableCredit: 5000 - creditAmountToApprove,
        createdAt: new Date(),
        updatedAt: new Date(),
        paymentHistory: [{
          date: new Date(),
          amount: creditAmountToApprove,
          orderId: order.id,
          type: 'credit_purchase',
          description: `Credit purchase - Order ${order.id.slice(-8)}`
        }],
        isPlatformCustomer: true // Flag for platform-registered customers
      };

      await setDoc(creditRef, newCreditData);
      console.log('✅ DEBUG: New credit account created with phone storage');
      
    } else {
      // UPDATE EXISTING CREDIT ACCOUNT
      const currentCredit = creditDoc.data();
      console.log('🔍 DEBUG: Current credit data:', currentCredit);
      
      const newBalance = (currentCredit.currentBalance || 0) + creditAmountToApprove;
      
      // CHECK CREDIT LIMIT
      if (newBalance > currentCredit.creditLimit) {
        const available = currentCredit.creditLimit - currentCredit.currentBalance;
        alert(`❌ Credit limit exceeded! Available: ₹${available}, Requested: ₹${creditAmountToApprove}`);
        return;
      }

      // 🆕 UPDATE DATA - ADD PHONE IF IT'S MISSING
      const updateData = {
        currentBalance: increment(creditAmountToApprove),
        availableCredit: increment(-creditAmountToApprove),
        updatedAt: new Date(),
        paymentHistory: arrayUnion({
          date: new Date(),
          amount: creditAmountToApprove,
          orderId: order.id,
          type: 'credit_purchase',
          description: `Credit purchase - Order ${order.id.slice(-8)}`
        })
      };
      
      // 🆕 ADD PHONE NUMBER IF IT'S MISSING IN EXISTING RECORD
      if (!currentCredit.phoneNumber && customerPhone) {
        updateData.phoneNumber = customerPhone;
        console.log('📞 DEBUG: Adding missing phone number to existing credit account:', customerPhone);
      } else if (currentCredit.phoneNumber) {
        console.log('📞 DEBUG: Phone already exists in credit account:', currentCredit.phoneNumber);
      } else {
        console.log('❌ DEBUG: No phone available to add to credit account');
      }
      
      await updateDoc(creditRef, updateData);
      console.log('✅ DEBUG: Existing credit account updated');
    }

    // ============================================================================
    // 💰 COMMISSION TRACKING FOR CREDIT SALES - ADDED HERE
    // ============================================================================
    console.log('💰 Processing commission for credit sale...');
    
    try {
      // Import commission function
      const { calculateAndRecordCommission } = await import('../utils/commissionCalculations');
      
      // Get shop details for commission tracking
      const shopDoc = await getDoc(doc(db, 'shops', order.shopId));
      const shopDetails = shopDoc.exists() ? shopDoc.data() : {};
      
      // Record commission for credit sales
      const commissionResult = await calculateAndRecordCommission(order, shopDetails);
      
      if (commissionResult) {
        console.log('✅ Commission recorded successfully:', commissionResult);
        
        // Mark order with commission info
        await updateDoc(doc(db, 'orders', order.id), {
          commissionRecorded: true,
          commissionId: commissionResult.commissionId,
          commissionAmount: commissionResult.commissionAmount,
          updatedAt: new Date()
        });
      } else {
        console.log('⚠️ Commission recording failed or returned null');
      }
    } catch (commissionError) {
      console.error('❌ Commission recording error (non-blocking):', commissionError);
      // Don't throw error - commission failure shouldn't block credit approval
    }

    // ============================================================================
    // 2. UPDATE ORDER STATUS (existing logic - UNCHANGED)
    // ============================================================================
    const orderRef = doc(db, 'orders', order.id);
    
    await updateDoc(orderRef, {
      creditApproved: true,
      status: 'confirmed',
      confirmedAt: new Date(),
      updatedAt: new Date(),
      modificationHistory: arrayUnion({
        type: 'credit_approved',
        date: new Date(),
        approvedBy: currentUser.uid,
        creditAmount: creditAmountToApprove,
        note: `Credit approved for ${order.paymentMethod === 'split_payment' ? 'split payment' : 'full credit'} order`
      })
    });

    console.log('✅ Order status updated to confirmed');

    // ============================================================================
    // 3. REFRESH ORDERS AND SHOW SUCCESS (ENHANCED MESSAGE)
    // ============================================================================
    fetchOrders();
    
    const paymentType = order.paymentMethod === 'split_payment' ? 
      `Split Payment (Credit: ₹${creditAmountToApprove})` : 
      'Full Credit';
      
    alert(`✅ Credit approved successfully!\n\n` +
          `Order: ${order.id.slice(-8)}\n` +
          `Payment: ${paymentType}\n` +
          `Customer: ${order.customerEmail}\n` +
          `Phone: ${customerPhone || 'Not stored'}\n` +
          `Status: Order confirmed and ready for preparation`);

  } catch (error) {
    console.error('=== CREDIT APPROVAL ERROR ===');
    console.error('Error:', error);
    console.error('Error message:', error.message);
    alert(`❌ Error approving credit: ${error.message}`);
  }
};

  // ORDER COMPLETION ACKNOWLEDGMENT FUNCTION

const acknowledgeOrderCompletion = async (orderId) => {
  try {
    const orderRef = doc(db, 'orders', orderId);
    
    await updateDoc(orderRef, {
      acknowledgedAt: new Date(),
      updatedAt: new Date(),
      modificationHistory: arrayUnion({
        type: 'customer_acknowledgment',
        date: new Date(),
        note: 'Customer acknowledged order completion'
      })
    });

    alert('✅ Order acknowledged successfully!');
    fetchOrders(); // Refresh orders
    
  } catch (error) {
    console.error('Error acknowledging order:', error);
    alert(`❌ Error acknowledging order: ${error.message}`);
  }
};

// START ORDER PREPARATION - WITH DEBUGGING
const startOrderPreparation = (order) => {
  console.log('Original order data:', order);
  
  const cleanOrder = { ...order };
  const removedFields = [];
  
  Object.keys(cleanOrder).forEach(key => {
    if (cleanOrder[key] === undefined) {
      removedFields.push(key);
      delete cleanOrder[key];
    }
  });

  if (removedFields.length > 0) {
    console.warn('Removed undefined fields:', removedFields);
  }

  console.log('Cleaned order data:', cleanOrder);
  
  setPreparingOrder(cleanOrder);
  setPreparedItems([]);
  fetchShopProducts();
};

  // ITEM PREPARATION TRACKING
  const markItemPrepared = (item) => {
    setPreparedItems(prev => [...prev, item.productId]);
  };

  const unmarkItemPrepared = (item) => {
    setPreparedItems(prev => prev.filter(id => id !== item.productId));
  };

  // ITEM REPLACEMENT (SUBSTITUTION)
  const replaceOrderItem = async (oldItem, newItem, newQuantity) => {
  try {
    const orderRef = doc(db, 'orders', preparingOrder.id);
    
    // CHECK IF WE'RE REPLACING WITH SAME PRODUCT THAT ALREADY EXISTS
    const existingSameProductIndex = preparingOrder.items.findIndex(
      item => item.productId === newItem.id && !item.substituted
    );

    let updatedItems;
    
    if (existingSameProductIndex !== -1) {
      // 🔥 AGGREGATE QUANTITIES - Merge with existing same product
      updatedItems = preparingOrder.items.map((item, index) => {
        if (index === existingSameProductIndex) {
          // Merge quantities with existing item
          const mergedQuantity = item.quantity + newQuantity;
          return {
            ...item,
            quantity: mergedQuantity,
            total: item.price * mergedQuantity
          };
        } else if (item.productId === oldItem.productId) {
          // Remove the old item being replaced
          return null;
        }
        return item;
      }).filter(Boolean); // Remove null items
      
      console.log('✅ Quantities aggregated for:', newItem.name);
      
    } else {
      // STANDARD REPLACEMENT - Replace with different product
      updatedItems = preparingOrder.items.map(item => 
        item.productId === oldItem.productId 
          ? {
              productId: newItem.id,
              name: newItem.name,
              price: newItem.price,
              quantity: newQuantity,
              total: newItem.price * newQuantity,
              unit: newItem.unit,
              originalItem: oldItem,
              substituted: true,
              substitutionDate: new Date()
            }
          : item
      );
    }

    // RECALCULATE TOTALS
    const subtotal = updatedItems.reduce((sum, item) => sum + item.total, 0);
    const totalAmount = subtotal + (preparingOrder.deliveryFee || 0);
    
    await updateDoc(orderRef, {
      items: updatedItems,
      subtotal: subtotal,
      totalAmount: totalAmount,
      updatedAt: new Date(),
      modificationHistory: arrayUnion({
        type: existingSameProductIndex !== -1 ? 'quantity_merge' : 'substitution',
        date: new Date(),
        originalItem: oldItem,
        newItem: { 
          productId: newItem.id,
          name: newItem.name,
          price: newItem.price,
          quantity: newQuantity 
        },
        merged: existingSameProductIndex !== -1,
        staffNote: existingSameProductIndex !== -1 ? 
          `Merged ${oldItem.name} with existing ${newItem.name}` :
          `Replaced ${oldItem.name} with ${newItem.name}`
      })
    });

    // REFRESH ORDER DATA
    const orderDoc = await getDoc(orderRef);
    if (orderDoc.exists()) {
      const updatedOrder = { id: orderDoc.id, ...orderDoc.data() };
      
      // AUTO-SYNC PREPARED ITEMS: Remove the old item ID, keep others
      const syncedPreparedItems = preparedItems.filter(id => id !== oldItem.productId);
      
      setPreparingOrder(updatedOrder);
      setPreparedItems(syncedPreparedItems);
      
      // Update main orders list
      setOrders(prev => prev.map(order => 
        order.id === updatedOrder.id ? updatedOrder : order
      ));
    }
    
    setShowItemReplacement(null);
    alert(`✅ ${existingSameProductIndex !== -1 ? 'Items merged' : 'Item replaced'} successfully!`);
    
  } catch (error) {
    console.error('Error in replacement:', error);
    alert(`❌ Error: ${error.message}`);
  }
};

  // REFRESH ORDERS FUNCTION
const fetchOrders = async () => {
  try {
    if (!shopId) return;

    console.log('=== fetchOrders ===');
    console.log('Shop ID:', shopId);

    const ordersQuery = query(
      collection(db, 'orders'),
      where('shopId', '==', shopId),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(ordersQuery);
    const ordersList = [];
    querySnapshot.forEach((doc) => {
      ordersList.push({ id: doc.id, ...doc.data() });
    });
    
    setOrders(ordersList);
    console.log('Orders refreshed:', ordersList.length);
    
  } catch (error) {
    console.error('Error fetching orders:', error);
    setError('Failed to refresh orders');
  }
};

//COMPLETE ORDER STATUS UPDATE FUNCTION - WITH COMMISSION INTEGRATION
const updateOrderStatus = async (orderId, newStatus) => {
  try {
    console.log('=== updateOrderStatus ===');
    console.log('Order ID:', orderId);
    console.log('New status:', newStatus);
    
    if (!orderId) {
      throw new Error('No order ID provided');
    }

    const orderRef = doc(db, 'orders', orderId);
    
    // Build update data based on your Firestore structure
    const updateData = {
      status: newStatus,
      updatedAt: new Date()
    };

    // Add timestamps based on status transitions
    if (newStatus === 'completed') {
      updateData.completedAt = new Date();
      updateData.acknowledgedAt = new Date(); // Delivery proof timestamp
      
      // ============================================================================
      // 💰 COMMISSION TRACKING FOR ALL COMPLETED ORDERS - ADDED HERE
      // ============================================================================
      console.log('💰 Recording commission for completed order...');
      
      try {
        // Import commission function
        const { recordCommissionForCompletedOrder } = await import('../utils/commissionCalculations');
        
        // Get the full order data first
        const orderDoc = await getDoc(orderRef);
        if (orderDoc.exists()) {
          const orderData = { id: orderDoc.id, ...orderDoc.data() };
          
          // Get shop details
          const shopDoc = await getDoc(doc(db, 'shops', orderData.shopId));
          const shopDetails = shopDoc.exists() ? shopDoc.data() : {};
          
          // Record commission for ALL completed orders (cash + credit)
          const commissionResult = await recordCommissionForCompletedOrder(orderData, shopDetails);
          
          if (commissionResult) {
            console.log('✅ Commission recorded for completed order:', commissionResult);
          } else {
            console.log('ℹ️ Commission already recorded or not applicable');
          }
        }
      } catch (commissionError) {
        console.error('❌ Commission recording error (non-blocking):', commissionError);
        // Don't throw error - commission failure shouldn't block order completion
      }
      
    } else if (newStatus === 'ready') {
      updateData.readyAt = new Date();
    } else if (newStatus === 'preparing') {
      updateData.preparingAt = new Date();
    } else if (newStatus === 'confirmed') {
      updateData.confirmedAt = new Date();
    }

    console.log('Update data:', updateData);
    
    await updateDoc(orderRef, updateData);
    console.log(`✅ Order status updated to: ${newStatus}`);
    
    // Refresh orders to show the update
    fetchOrders();
    
    // Show success message
    if (newStatus === 'completed') {
      alert('✅ Order marked as completed and acknowledged!');
    } else {
      alert(`✅ Order status updated to: ${newStatus}`);
    }
    
  } catch (error) {
    console.error('Error updating order status:', error);
    alert(`❌ Error: ${error.message}`);
  }
};

  // ITEM CANCELLATION DURING PREPARATION
  const cancelOrderItem = async (itemToCancel, cancellationReason, staffNote = '') => {
  try {
    console.log('=== CANCELLATION DEBUG ===');
    console.log('Item to cancel:', itemToCancel);
    
    const orderRef = doc(db, 'orders', preparingOrder.id);
    const updatedItems = preparingOrder.items.filter(item => 
      item.productId !== itemToCancel.productId
    );

    console.log('Items after cancellation:', updatedItems);

    // Check if order becomes empty
    if (updatedItems.length === 0) {
      await updateDoc(orderRef, {
        status: 'cancelled',
        cancellationReason: 'all_items_unavailable',
        cancelledAt: new Date(),
        updatedAt: new Date(),
        modificationHistory: arrayUnion({
          type: 'full_cancellation',
          date: new Date(),
          reason: cancellationReason,
          staffNote: staffNote || 'All items cancelled - order voided',
          originalTotal: preparingOrder.totalAmount
        })
      });
    } else {
      // Recalculate totals for partial cancellation
      const subtotal = updatedItems.reduce((sum, item) => sum + item.total, 0);
      const totalAmount = subtotal + (preparingOrder.deliveryFee || 0);
      
      await updateDoc(orderRef, {
        items: updatedItems,
        subtotal: subtotal,
        totalAmount: totalAmount,
        updatedAt: new Date(),
        modificationHistory: arrayUnion({
          type: 'item_cancellation',
          date: new Date(),
          cancelledItem: itemToCancel,
          reason: cancellationReason,
          staffNote: staffNote,
          refundAmount: itemToCancel.total,
          newSubtotal: subtotal,
          newTotal: totalAmount
        })
      });
    }

    // PROPERLY REFRESH WITH getDoc
    const orderDoc = await getDoc(orderRef);
    if (orderDoc.exists()) {
      const updatedOrder = { id: orderDoc.id, ...orderDoc.data() };
      console.log('Order after cancellation:', updatedOrder);
      setPreparingOrder(updatedOrder);
      
      // Update main orders list
      setOrders(prev => prev.map(order => 
        order.id === updatedOrder.id ? updatedOrder : order
      ));
    }
    
    setShowCancellationModal(null);
    alert('✅ Item cancelled successfully!');
    
  } catch (error) {
    console.error('=== CANCELLATION ERROR ===');
    console.error('Error:', error);
    console.error('Error message:', error.message);
    alert(`❌ Error cancelling item: ${error.message}`);
  }
};
  // COMPLETE ORDER PREPARATION
const completeOrderPreparation = async () => {
  try {
    // Validate critical data first
    if (!preparingOrder || !preparingOrder.id) {
      throw new Error('No order selected for completion');
    }

    console.log('=== BULLETPROOF VERSION - MINIMAL UPDATE ===');
    
    const orderRef = doc(db, 'orders', preparingOrder.id);
    
    // ONLY update the status - nothing else!
    // This eliminates any potential data issues
    const minimalUpdate = {
      status: 'ready',
      updatedAt: new Date()
    };
    
    console.log('Minimal update data:', minimalUpdate);
    
    await updateDoc(orderRef, minimalUpdate);
    
    setPreparingOrder(null);
    setPreparedItems([]);
    alert('✅ Order marked as ready!');
    
  } catch (error) {
    console.error('Error completing order:', error);
    alert(`❌ Error: ${error.message}`);
  }
};
  // RETURN MANAGEMENT
  // ENHANCED RETURN PROCESSING WITH INVENTORY & PAYMENT HANDLING
const processOrderReturn = async (returnItems, returnReason, customerRefund) => {
  try {
    const orderRef = doc(db, 'orders', preparingOrder.id);
    const auth = getAuth();
    const currentUser = auth.currentUser;

    // 1. CREATE UPDATED ITEMS ARRAY (REMOVE RETURNED ITEMS)
    const remainingItems = preparingOrder.items.filter(orderItem => 
      !returnItems.some(returnItem => returnItem.productId === orderItem.productId)
    );

    // 2. RECALCULATE TOTALS
    const subtotal = remainingItems.reduce((sum, item) => sum + item.total, 0);
    const totalAmount = subtotal + (preparingOrder.deliveryFee || 0);

    // 3. DETERMINE RETURN STATUS
    let newStatus = 'completed';
    if (remainingItems.length === 0) {
      newStatus = 'returned';
    } else if (returnItems.length > 0) {
      newStatus = 'partially_returned';
    }

    // 4. UPDATE ORDER WITH RETURN DETAILS
    const returnUpdate = {
      status: newStatus,
      items: remainingItems,
      subtotal: subtotal,
      totalAmount: totalAmount,
      returnDetails: {
        returnDate: new Date(),
        returnedItems: returnItems,
        reason: returnReason,
        refundAmount: customerRefund,
        refundMethod: preparingOrder.paymentMethod,
        processedBy: currentUser.uid,
        processedAt: new Date(),
        // Track original payment for audit
        originalPayment: {
          method: preparingOrder.paymentMethod,
          totalAmount: preparingOrder.totalAmount,
          creditAmount: preparingOrder.creditAmount || 0,
          cashAmount: preparingOrder.cashAmount || 0
        }
      },
      updatedAt: new Date(),
      modificationHistory: arrayUnion({
        type: 'return_processed',
        date: new Date(),
        returnedItems: returnItems,
        reason: returnReason,
        refundAmount: customerRefund,
        remainingItemsCount: remainingItems.length,
        newStatus: newStatus,
        processedBy: currentUser.uid
      })
    };

    // 5. HANDLE CREDIT REFUNDS
    if ((preparingOrder.paymentMethod === 'credit' || preparingOrder.paymentMethod === 'split_payment') && customerRefund > 0) {
      const creditRef = doc(db, 'customer_credits', `${preparingOrder.customerId}_${shopId}`);
      
      // Add credit refund to customer's balance (reduce their debt)
      await updateDoc(creditRef, {
        currentBalance: increment(-customerRefund),
        paymentHistory: arrayUnion({
          date: new Date(),
          amount: -customerRefund, // Negative for refund
          orderId: preparingOrder.id,
          type: 'return_refund',
          description: `Return refund for order ${preparingOrder.id.slice(-8)}`
        })
      });
    }

    // 6. UPDATE ORDER
    await updateDoc(orderRef, returnUpdate);

    // 7. REFRESH ORDER DATA
    const orderDoc = await getDoc(orderRef);
    if (orderDoc.exists()) {
      const updatedOrder = { id: orderDoc.id, ...orderDoc.data() };
      setPreparingOrder(updatedOrder);
      
      // Update main orders list
      setOrders(prev => prev.map(order => 
        order.id === updatedOrder.id ? updatedOrder : order
      ));
    }
    
    setShowReturnModal(null);
    
    // 8. SHOW SUCCESS MESSAGE WITH DETAILS
    const refundMethod = preparingOrder.paymentMethod === 'credit' ? 'credit balance' : 
                        preparingOrder.paymentMethod === 'cash' ? 'cash' : 'payment method';
    
    alert(`✅ Return processed successfully!\n\n` +
          `Refund Amount: ₹${customerRefund.toFixed(2)}\n` +
          `Refund Method: ${refundMethod}\n` +
          `Items Returned: ${returnItems.length}\n` +
          `Remaining Items: ${remainingItems.length}\n` +
          `Order Status: ${newStatus.replace('_', ' ').toUpperCase()}`);
    
  } catch (error) {
    console.error('Error processing return:', error);
    alert(`❌ Error processing return: ${error.message}`);
  }
};

  // CALCULATION UTILITIES
  const calculateOrderTotals = (items, deliveryFee = 0) => {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const totalAmount = subtotal + deliveryFee;
    return { subtotal, totalAmount };
  };

  const calculateRefundAmount = (returnItems) => {
    return returnItems.reduce((sum, item) => sum + item.refundAmount, 0);
  };

  // SUB-COMPONENTS
  const OrderItemCard = ({ item, order, preparedItems, onMarkPrepared, onUnmarkPrepared, onReplace, onCancel }) => {
    const isPrepared = preparedItems.includes(item.productId);
    const canModify = ['pending_approval', 'confirmed', 'preparing'].includes(order.status);
    const showCheckbox = order.status === 'preparing';

    return (
      <div style={styles.preparationItem}>
        {/* CHECKBOX - FIXED VISIBILITY */}
        {showCheckbox && (
          <div style={styles.itemCheckbox}>
            <input
              type="checkbox"
              checked={isPrepared}
              onChange={(e) => {
                if (e.target.checked) {
                  onMarkPrepared(item);
                } else {
                  onUnmarkPrepared(item);
                }
              }}
              style={styles.checkboxInput}
            />
          </div>
        )}

        <div style={styles.itemDetails}>
          <strong>{item.name}</strong>
          {item.substituted && <span style={styles.substitutedBadge}>🔄 Substituted</span>}
          <div style={styles.itemMeta}>
            <span>Qty: {item.quantity} {item.unit}</span>
            <span>Price: ₹{item.price}</span>
            <span>Total: ₹{item.total}</span>
          </div>
        </div>

        {canModify && (
          <div style={styles.itemActions}>
            <button onClick={onReplace} style={styles.replaceButton}>
              🔄 Replace
            </button>
            <button onClick={onCancel} style={styles.removeButton}>
              🚫 Cancel
            </button>
          </div>
        )}

        {isPrepared && <div style={styles.preparedBadge}>✅ Prepared</div>}
      </div>
    );
  };

  const ItemReplacementModal = ({ originalItem, availableProducts, onReplace, onClose }) => {
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [quantity, setQuantity] = useState(originalItem.quantity);

    const similarProducts = availableProducts.filter(product => {
      // Include products from same category OR similar price range
      const sameCategory = product.category === originalItem.category;
      const similarPrice = Math.abs(product.price - originalItem.price) <= originalItem.price * 0.5; // Within 50% price difference
      const inStock = product.stock > 0;
      const notSameProduct = product.id !== originalItem.productId;
      
      return (sameCategory || similarPrice) && inStock && notSameProduct;
    });

    console.log('Available products:', availableProducts.length);
    console.log('Similar products:', similarProducts.length);
    console.log('Original item category:', originalItem.category);

    const handleReplace = () => {
      if (!selectedProduct) {
        alert('Please select a replacement product');
        return;
      }
      if (quantity > selectedProduct.stock) {
        alert(`Only ${selectedProduct.stock} available in stock`);
        return;
      }
      if (quantity <= 0) {
        alert('Quantity must be at least 1');
        return;
      }
      onReplace(originalItem, selectedProduct, quantity);
    };

    return (
      <div style={styles.modalOverlay}>
        <div style={styles.modalContent}>
          <h3>🔄 Replace Item</h3>
          <p>Replacing: <strong>{originalItem.name}</strong> (₹{originalItem.price} each)</p>

          <div style={styles.inputGroup}>
            <label>Select Replacement Product:</label>
            <select 
              value={selectedProduct?.id || ''}
              onChange={(e) => {
                const product = availableProducts.find(p => p.id === e.target.value);
                setSelectedProduct(product || null);
                // Reset quantity to 1 when product changes
                if (product) setQuantity(1);
              }}
              style={styles.select}
            >
              <option value="">Choose a replacement product...</option>
              {similarProducts.length > 0 ? (
                similarProducts.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name} - ₹{product.price} per {product.unit} ({product.stock} in stock)
                  </option>
                ))
              ) : (
                <option value="" disabled>No similar products available</option>
              )}
            </select>
            {similarProducts.length === 0 && (
              <small style={styles.warningText}>
                No similar products found. Please cancel and remove the item instead.
              </small>
            )}
          </div>

          {selectedProduct && (
            <>
              <div style={styles.inputGroup}>
                <label>Quantity:</label>
                <div style={styles.quantityContainer}>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    min="1"
                    max={selectedProduct.stock}
                    style={styles.quantityInput}
                  />
                  <span style={styles.unitText}>Unit: {selectedProduct.unit}</span>
                </div>
                <small>Max available: {selectedProduct.stock}</small>
              </div>

              <div style={styles.priceComparison}>
                <div><strong>Original:</strong> {originalItem.quantity} × ₹{originalItem.price} = ₹{originalItem.total}</div>
                <div><strong>Replacement:</strong> {quantity} × ₹{selectedProduct.price} = ₹{(quantity * selectedProduct.price).toFixed(2)}</div>
                <div style={{
                  ...styles.difference,
                  color: (quantity * selectedProduct.price) > originalItem.total ? '#dc3545' : '#28a745'
                }}>
                  Price Difference: ₹{Math.abs((quantity * selectedProduct.price) - originalItem.total).toFixed(2)} 
                  {(quantity * selectedProduct.price) > originalItem.total ? ' more' : ' less'}
                </div>
              </div>
            </>
          )}

          <div style={styles.modalActions}>
            <button onClick={onClose} style={styles.cancelButton}>
              Cancel
            </button>
            <button 
              onClick={handleReplace}
              disabled={!selectedProduct}
              style={selectedProduct ? styles.confirmButton : styles.confirmButtonDisabled}
            >
              Confirm Replacement
            </button>
          </div>
        </div>
      </div>
    );
  };

  const ItemCancellationModal = ({ item, onCancel, onClose }) => {
    const [reason, setReason] = useState('out_of_stock');
    const [staffNote, setStaffNote] = useState('');

    const cancellationReasons = [
      { value: 'out_of_stock', label: 'Out of Stock' },
      { value: 'quality_issues', label: 'Quality Issues' },
      { value: 'customer_request', label: 'Customer Request' },
      { value: 'other', label: 'Other' }
    ];

    const handleCancel = () => {
      onCancel(item, reason, staffNote);
    };

    return (
      <div style={styles.modalOverlay}>
        <div style={styles.modalContent}>
          <h3>🚫 Cancel Item</h3>
          <p>Cancelling: <strong>{item.name}</strong> (₹{item.total})</p>

          <div style={styles.inputGroup}>
            <label>Cancellation Reason:</label>
            <select 
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={styles.select}
            >
              {cancellationReasons.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.inputGroup}>
            <label>Staff Note (Optional):</label>
            <textarea
              value={staffNote}
              onChange={(e) => setStaffNote(e.target.value)}
              style={styles.textarea}
              placeholder="Additional details about this cancellation..."
              rows="3"
            />
          </div>

          <div style={styles.modalActions}>
            <button onClick={onClose} style={styles.cancelButton}>Keep Item</button>
            <button onClick={handleCancel} style={styles.removeButton}>
              Confirm Cancellation
            </button>
          </div>
        </div>
      </div>
    );
  };

  const ReturnProcessingModal = ({ order, onProcessReturn, onClose }) => {
  const [returnItems, setReturnItems] = useState([]);
  const [returnReason, setReturnReason] = useState(shopPolicy.allowedReasons[0] || 'damaged');
  const [staffNote, setStaffNote] = useState('');

  // Check eligibility
  const eligibility = checkReturnEligibility(order);

  const toggleItemReturn = (item) => {
    const isReturning = returnItems.some(ri => ri.productId === item.productId);
    if (isReturning) {
      setReturnItems(prev => prev.filter(ri => ri.productId !== item.productId));
    } else {
      setReturnItems(prev => [...prev, {
        ...item,
        refundAmount: item.total,
        returnQuantity: item.quantity
      }]);
    }
  };

  const handleProcessReturn = () => {
    if (returnItems.length === 0) {
      alert('Please select at least one item to return');
      return;
    }
    
    // Validate reason
    if (!shopPolicy.allowedReasons.includes(returnReason)) {
      alert('Selected return reason is not allowed by shop policy');
      return;
    }

    const totalRefund = returnItems.reduce((sum, item) => sum + (item.total || 0), 0);
    
    const confirmMessage = `Process return for ${returnItems.length} item(s)?\n\n` +
                          `Refund Amount: ₹${totalRefund.toFixed(2)}\n` +
                          `Reason: ${returnReason.replace('_', ' ').toUpperCase()}\n` +
                          `Time Remaining: ${eligibility.hoursRemaining} hours`;
    
    if (window.confirm(confirmMessage)) {
      onProcessReturn(returnItems, returnReason, totalRefund);
    }
  };

  const totalRefund = returnItems.reduce((sum, item) => sum + (item.total || 0), 0);

  // If not eligible, show disabled modal
  if (!eligibility.eligible) {
    return (
      <div style={styles.modalOverlay}>
        <div style={styles.modalContent}>
          <h3>⏰ Return Not Available</h3>
          <div style={styles.errorMessage}>
            {eligibility.reason}
          </div>
          <div style={styles.modalActions}>
            <button onClick={onClose} style={styles.cancelButton}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalContent}>
        <h3>🔄 Process Return</h3>
        
        {/* Time window info */}
        <div style={styles.timeWindowInfo}>
          ⏰ <strong>{eligibility.message}</strong>
        </div>

        <div style={styles.returnSection}>
          <h4>Select Items to Return:</h4>
          <div style={styles.returnItemsList}>
            {order.items.map((item, index) => (
              <label key={item.productId || index} style={styles.returnItem}>
                <input
                  type="checkbox"
                  checked={returnItems.some(ri => ri.productId === item.productId)}
                  onChange={() => toggleItemReturn(item)}
                  style={styles.checkboxInput}
                />
                <div style={styles.returnItemDetails}>
                  <span style={styles.itemName}>{item.name}</span>
                  <span style={styles.itemMeta}>
                    {item.quantity} {item.unit} × ₹{item.price} = ₹{item.total}
                  </span>
                  {/* Show perishable warning if applicable */}
                  {item.category && ['vegetables', 'fruits', 'dairy'].includes(item.category) && (
                    <span style={styles.perishableWarning}>
                      🕒 {shopPolicy.perishableWindow}h return window
                    </span>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>

        <div style={styles.inputGroup}>
          <label>Return Reason:</label>
          <select 
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
            style={styles.select}
          >
            {shopPolicy.allowedReasons.map(reason => (
              <option key={reason} value={reason}>
                {reason.replace('_', ' ').toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.inputGroup}>
          <label>Staff Notes (Optional):</label>
          <textarea
            value={staffNote}
            onChange={(e) => setStaffNote(e.target.value)}
            style={styles.textarea}
            placeholder="Details about item condition, customer comments, etc..."
            rows="3"
          />
        </div>

        {returnItems.length > 0 && (
          <div style={styles.refundSummary}>
            <h4>Refund Summary</h4>
            <div style={styles.summaryRow}>
              <span>Items Returning:</span>
              <span>{returnItems.length} of {order.items.length}</span>
            </div>
            <div style={styles.summaryRow}>
              <span>Total Refund:</span>
              <span><strong>₹{totalRefund.toFixed(2)}</strong></span>
            </div>
            <div style={styles.summaryRow}>
              <span>Time Remaining:</span>
              <span>{eligibility.hoursRemaining} hours</span>
            </div>
          </div>
        )}

        <div style={styles.modalActions}>
          <button onClick={onClose} style={styles.cancelButton}>
            Cancel
          </button>
          <button 
            onClick={handleProcessReturn}
            disabled={returnItems.length === 0}
            style={returnItems.length > 0 ? styles.returnButton : styles.returnButtonDisabled}
          >
            Process Return (₹{totalRefund.toFixed(2)})
          </button>
        </div>
      </div>
    </div>
  );
};
  // UI COMPONENTS
  const OrderPreparationModal = () => {
    if (!preparingOrder) return null;
    // SAFETY CHECK: Ensure preparedItems is always defined
      const safePreparedItems = preparedItems || [];
      const canCompletePreparation = safePreparedItems.length === preparingOrder.items.length;
      const isReturnEligible = ['completed', 'delivered'].includes(preparingOrder.status);

    return (
      <div style={styles.preparationModal}>
        <div style={styles.preparationContent}>
          <div style={styles.preparationHeader}>
            <h2>👨‍🍳 Order #{preparingOrder.id.slice(-8)}</h2>
            <button onClick={() => setPreparingOrder(null)} style={styles.closeButton}>✕</button>
          </div>

          {/* Order Info */}
          <div style={styles.orderInfo}>
            <div><strong>Customer:</strong> {preparingOrder.customerEmail}</div>
            <div><strong>Status:</strong> {getStatusBadge(preparingOrder.status)}</div>
            <div><strong>Type:</strong> {preparingOrder.deliveryType === 'delivery' ? '🚚 Delivery' : '🏪 Pickup'}</div>
            {preparingOrder.deliveryType === 'delivery' && (
              <div><strong>Address:</strong> {preparingOrder.deliveryAddress?.street}</div>
            )}
          </div>

          {/* Preparation Progress */}
          {preparingOrder.status === 'preparing' && (
          <div style={styles.preparationProgress}>
            <h4>Preparation Progress ({safePreparedItems.length}/{preparingOrder.items.length})</h4>
            <div style={styles.progressBar}>
              <div style={{
                ...styles.progressFill,
                width: `${(safePreparedItems.length / preparingOrder.items.length) * 100}%`
              }} />
            </div>
          </div>
        )}

          {/* Items List */}
<div style={styles.itemsList}>
  <h4>🛍️ Order Items</h4>
  {preparingOrder.items.map((item, index) => (
    <OrderItemCard 
      key={`${item.productId}-${index}`} // FIXED: Simple unique key
      item={item} 
      order={preparingOrder}
      preparedItems={safePreparedItems} // PASS THE SAFE ARRAY
      onMarkPrepared={markItemPrepared}
      onUnmarkPrepared={unmarkItemPrepared}
      onReplace={() => setShowItemReplacement({ item, index })}
      onCancel={() => setShowCancellationModal({ item, index })}
    />
  ))}
</div>

          {/* Action Buttons */}
          <div style={styles.preparationActions}>
            <div style={styles.orderTotals}>
              <strong>Total: ₹{preparingOrder.totalAmount?.toFixed(2)}</strong>
              {preparingOrder.deliveryFee > 0 && (
                <small>(₹{preparingOrder.subtotal?.toFixed(2)} items + ₹{preparingOrder.deliveryFee} delivery)</small>
              )}
            </div>
            
            <div style={styles.actionButtons}>
              {/* PREPARATION STATUS FLOW */}
              {preparingOrder.status === 'confirmed' && (
                <button
                  onClick={() => updateOrderStatus(preparingOrder.id, 'preparing')}
                  style={styles.startPrepButton}
                >
                  👨‍🍳 Start Preparation
                </button>
              )}

              {/* PREPARATION COMPLETE */}
              {preparingOrder.status === 'preparing' && (
                <button
                  onClick={completeOrderPreparation}
                  disabled={safePreparedItems.length !== preparingOrder.items.length}
                  style={
                    safePreparedItems.length === preparingOrder.items.length 
                      ? styles.completeButton 
                      : styles.completeButtonDisabled
                  }
                >
                  {safePreparedItems.length === preparingOrder.items.length 
                    ? '✅ Mark Order Ready' 
                    : `Complete ${preparingOrder.items.length - safePreparedItems.length} more items`
                  }
                </button>
              )}

              {/* READY FOR PICKUP/DELIVERY */}
              {preparingOrder.status === 'ready' && (
                <button
                  onClick={() => updateOrderStatus(preparingOrder.id, 'completed')}
                  style={styles.completeButton}
                >
                  ✅ Mark as {preparingOrder.deliveryType === 'delivery' ? 'Delivered' : 'Picked Up'}
                </button>
              )}

              {/* RETURN BUTTON */}
              {['completed', 'delivered'].includes(preparingOrder.status) && (
                <button
                  onClick={() => setShowReturnModal(true)}
                  style={styles.returnButton}
                >
                  🔄 Process Return
                </button>
              )}
            </div>
          </div>
        </div>

        {/* MODALS */}
        {showItemReplacement && (
          <ItemReplacementModal 
            originalItem={showItemReplacement.item}
            availableProducts={availableProducts}
            onReplace={replaceOrderItem}
            onClose={() => setShowItemReplacement(null)}
          />
        )}

        {showCancellationModal && (
          <ItemCancellationModal 
            item={showCancellationModal.item}
            onCancel={cancelOrderItem}
            onClose={() => setShowCancellationModal(null)}
          />
        )}

        {showReturnModal && (
          <ReturnProcessingModal 
            order={preparingOrder}
            onProcessReturn={processOrderReturn}
            onClose={() => setShowReturnModal(null)}
          />
        )}
      </div>
    );
  };

  // HELPER FUNCTIONS
  // REPLACE THE getStatusBadge FUNCTION:
const getStatusBadge = (status) => {
  const statusConfig = {
    'pending_approval': { backgroundColor: '#f39c12', label: '⏳ Credit Approval Needed' },
    'confirmed': { backgroundColor: '#3498db', label: '✅ Confirmed' },
    'preparing': { backgroundColor: '#9b59b6', label: '👨‍🍳 Preparing' },
    'ready': { backgroundColor: '#e67e22', label: '📦 Ready' },
    'completed': { backgroundColor: '#27ae60', label: '🎉 Completed' },
    'cancelled': { backgroundColor: '#e74c3c', label: '❌ Cancelled' },
    'returned': { backgroundColor: '#95a5a6', label: '🔄 Fully Returned' },
    'partially_returned': { backgroundColor: '#ff6b6b', label: '🔄 Partially Returned' }
  };

  const statusInfo = statusConfig[status] || { backgroundColor: '#95a5a6', label: status };
  
  return (
    <span style={{
      backgroundColor: statusInfo.backgroundColor,
      color: 'white',
      padding: '0.25rem 0.75rem',
      borderRadius: '12px',
      fontSize: '0.8rem',
      fontWeight: '600',
    }}>
      {statusInfo.label}
    </span>
  );
};
  // MAIN RENDER
  if (loading) return <div style={styles.loading}>Loading Orders...</div>;
  if (error) return <div style={styles.error}>{error}</div>;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2>📦 Order Management</h2>
        <div style={styles.stats}>
          <span>Total: {orders.length}</span>
          <span>Pending: {orders.filter(o => ['pending_approval', 'confirmed', 'preparing'].includes(o.status)).length}</span>
          <span>Ready: {orders.filter(o => o.status === 'ready').length}</span>
        </div>
      </div>

      {orders.length === 0 ? (
        <div style={styles.emptyState}>
          <h3>No orders yet</h3>
          <p>Orders from customers will appear here.</p>
        </div>
      ) : (
        <div style={styles.ordersGrid}>
          {orders.map((order,index) => (
            <div key={`order-${order.id}-${index}`} style={styles.orderCard}>
              <div style={styles.orderHeader}>
                <div style={styles.orderInfo}>
                  <h3>Order #{order.id.slice(-8)}</h3>
                  <div style={styles.customerInfo}>
                    <span>👤 {order.customerEmail}</span>
                    <span>📅 {new Date(order.createdAt?.toDate()).toLocaleDateString()}</span>
                  </div>
                </div>
                <div style={styles.orderStatus}>
                  {getStatusBadge(order.status)}
                  <span style={styles.deliveryType}>
                    {order.deliveryType === 'delivery' ? '🚚 Delivery' : '🏪 Pickup'}
                  </span>
                </div>
              </div>

              <div style={styles.orderItems}>
                {order.items.map((item, index) => (
                  <div key={index} style={styles.orderItem}>
                    <span style={styles.itemName}>{item.name}</span>
                    <span style={styles.itemQuantity}>{item.quantity} {item.unit}</span>
                    <span style={styles.itemPrice}>₹{item.total}</span>
                    {item.substituted && <span style={styles.substitutedIndicator}>🔄</span>}
                  </div>
                ))}
              </div>

              <div style={styles.orderTotal}>
                <strong>Total: ₹{order.totalAmount?.toFixed(2)}</strong>
                {order.deliveryFee > 0 && (
                  <small>(₹{order.subtotal?.toFixed(2)} + ₹{order.deliveryFee} delivery)</small>
                )}
              </div>

              <div style={styles.orderActions}>
                {/* Preparation Button */}
                {['confirmed', 'preparing'].includes(order.status) && (
                  <button 
                    onClick={() => startOrderPreparation(order)}
                    style={styles.prepareButton}
                  >
                    👨‍🍳 Prepare Order
                  </button>
                )}

                {/* ✅ IMPROVED CREDIT APPROVAL BUTTON - More specific conditions */}
                  {order.status === 'pending_approval' && 
                  (
                    (order.paymentMethod === 'credit' && !order.creditApproved) ||
                    (order.paymentMethod === 'split_payment' && order.creditAmount > 0 && !order.creditApproved)
                  ) && (
                    <button 
                      onClick={() => approveCreditOrder(order)}
                      style={styles.approveCreditButton}
                    >
                      ✅ Approve Credit {order.paymentMethod === 'split_payment' ? `(₹${order.creditAmount})` : ''}
                    </button>
                  )}

                {/* View Details Button */}
                <button 
                  onClick={() => startOrderPreparation(order)}
                  style={styles.viewButton}
                >
                  📋 View Details
                </button>

                {/* Status Update Buttons */}
                {order.status === 'ready' && (
                  <button 
                    onClick={() => updateOrderStatus(order.id, 'completed')}
                    style={styles.completeButton}
                  >
                    ✅ Complete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PREPARATION MODAL */}
      <OrderPreparationModal />
    </div>
  );
};

// COMPREHENSIVE STYLES
const styles = {
  container: {
    padding: '1rem',
  },
  approveCreditButton: {
  backgroundColor: '#27ae60',
  color: 'white',
  border: 'none',
  padding: '0.5rem 1rem',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '0.9rem',
  fontWeight: '600',
},

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  stats: {
    display: 'flex',
    gap: '1rem',
    fontSize: '0.9rem',
    color: '#7f8c8d',
  },
  ordersGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  orderCard: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    border: '1px solid #ecf0f1',
  },
  orderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1rem',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  orderInfo: {
    flex: 1,
  },
  customerInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    fontSize: '0.9rem',
    color: '#7f8c8d',
  },
  orderStatus: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    alignItems: 'flex-end',
  },
  deliveryType: {
    fontSize: '0.8rem',
    color: '#3498db',
    fontWeight: '600',
  },
  orderItems: {
    marginBottom: '1rem',
  },
  orderItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.5rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '4px',
    marginBottom: '0.5rem',
  },
  itemName: {
    flex: 2,
  },
  itemQuantity: {
    flex: 1,
    textAlign: 'center',
  },
  itemPrice: {
    flex: 1,
    textAlign: 'right',
    fontWeight: '600',
  },
  substitutedIndicator: {
    fontSize: '0.8rem',
    marginLeft: '0.5rem',
  },
  orderTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 0',
    borderTop: '1px solid #ecf0f1',
    fontWeight: 'bold',
  },
  orderActions: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  prepareButton: {
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  viewButton: {
    backgroundColor: '#95a5a6',
    color: 'white',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  completeButton: {
    backgroundColor: '#27ae60',
    color: 'white',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  loading: {
    textAlign: 'center',
    padding: '2rem',
    fontSize: '1.2rem',
  },
  error: {
    textAlign: 'center',
    padding: '2rem',
    color: '#e74c3c',
    backgroundColor: '#f8d7da',
    borderRadius: '8px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '3rem',
    color: '#7f8c8d',
  },

  // PREPARATION MODAL STYLES
  preparationModal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: '1rem',
  },
  preparationContent: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '800px',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  preparationHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
    borderBottom: '2px solid #ecf0f1',
    paddingBottom: '1rem',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '1.5rem',
    cursor: 'pointer',
    color: '#666',
  },
  orderInfo: {
    backgroundColor: '#e8f4fd',
    padding: '1rem',
    borderRadius: '6px',
    marginBottom: '1.5rem',
    fontSize: '0.9rem',
  },
  preparationProgress: {
    marginBottom: '1.5rem',
  },
  progressBar: {
    width: '100%',
    height: '10px',
    backgroundColor: '#ecf0f1',
    borderRadius: '5px',
    overflow: 'hidden',
    marginTop: '0.5rem',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#27ae60',
    transition: 'width 0.3s ease',
  },
  itemsList: {
    marginBottom: '2rem',
  },
  preparationItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem',
    border: '2px solid #ecf0f1',
    borderRadius: '8px',
    backgroundColor: '#f8f9fa',
    marginBottom: '0.75rem',
    position: 'relative',
  },
  itemCheckbox: {
    flexShrink: 0,
  },
  itemDetails: {
    flex: 1,
  },
  itemMeta: {
    display: 'flex',
    gap: '1rem',
    fontSize: '0.9rem',
    color: '#6c757d',
    marginTop: '0.25rem',
  },
  substitutedBadge: {
    backgroundColor: '#fff3cd',
    color: '#856404',
    padding: '0.2rem 0.5rem',
    borderRadius: '8px',
    fontSize: '0.7rem',
    marginLeft: '0.5rem',
  },
  itemActions: {
    display: 'flex',
    gap: '0.5rem',
  },
  replaceButton: {
    backgroundColor: '#ffc107',
    color: '#212529',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.8rem',
  },
  removeButton: {
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.8rem',
  },
  returnButton: {
    backgroundColor: '#6f42c1',
    color: 'white',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.8rem',
  },
  preparedBadge: {
    position: 'absolute',
    top: '0.5rem',
    right: '0.5rem',
    backgroundColor: '#28a745',
    color: 'white',
    padding: '0.25rem 0.5rem',
    borderRadius: '12px',
    fontSize: '0.7rem',
    fontWeight: '600',
  },
  preparationActions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '1.5rem',
    borderTop: '2px solid #ecf0f1',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  orderTotals: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  actionButtons: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  completeButtonDisabled: {
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    padding: '1rem 2rem',
    borderRadius: '6px',
    cursor: 'not-allowed',
  },
  startPrepButton: {
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    padding: '1rem 2rem',
    borderRadius: '6px',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
  },

  // MODAL STYLES
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1001,
    padding: '1rem',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '8px',
    width: '100%',
    maxWidth: '500px',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  inputGroup: {
    marginBottom: '1rem',
  },
  select: {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    fontSize: '1rem',
    marginTop: '0.5rem',
  },
  quantityInput: {
    width: '80px',
    padding: '0.5rem',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    margin: '0 0.5rem',
  },
  textarea: {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    fontSize: '1rem',
    resize: 'vertical',
    fontFamily: 'inherit',
    minHeight: '80px',
  },
  priceComparison: {
    backgroundColor: '#f8f9fa',
    padding: '1rem',
    borderRadius: '4px',
    margin: '1rem 0',
    fontSize: '0.9rem',
  },
  difference: {
    fontWeight: 'bold',
    marginTop: '0.5rem',
    color: '#dc3545',
  },
  returnItemsList: {
    maxHeight: '200px',
    overflowY: 'auto',
    marginBottom: '1rem',
    border: '1px solid #dee2e6',
    borderRadius: '4px',
    padding: '1rem',
  },
  returnItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem',
    cursor: 'pointer',
  },
  refundSummary: {
    backgroundColor: '#d4edda',
    padding: '1rem',
    borderRadius: '4px',
    margin: '1rem 0',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '1rem',
    marginTop: '1.5rem',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  confirmButton: {
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  confirmButtonDisabled: {
    backgroundColor: '#bdc3c7',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '4px',
    cursor: 'not-allowed',
  },
  returnButtonDisabled: {
    backgroundColor: '#bdc3c7',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '4px',
    cursor: 'not-allowed',
  },
  checkboxInput: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
  },
  quantityContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginTop: '0.25rem',
  },
  unitText: {
    fontSize: '0.9rem',
    color: '#6c757d',
  },
  warningText: {
    color: '#dc3545',
    fontSize: '0.8rem',
    marginTop: '0.25rem',
    display: 'block',
  },
  paymentInfoCard: {
  backgroundColor: '#e8f4fd',
  padding: '1rem',
  borderRadius: '6px',
  marginBottom: '1rem',
  borderLeft: '4px solid #3498db',
},
returnItemDetails: {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flex: 1,
  marginLeft: '0.5rem',
},
itemName: {
  flex: 2,
  fontWeight: '500',
},
itemQty: {
  flex: 1,
  textAlign: 'center',
  color: '#7f8c8d',
},
itemTotal: {
  flex: 1,
  textAlign: 'right',
  fontWeight: '600',
},
summaryRow: {
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: '0.5rem',
  padding: '0.25rem 0',
},
timeWindowInfo: {
  backgroundColor: '#e8f4fd',
  padding: '0.75rem',
  borderRadius: '6px',
  marginBottom: '1rem',
  borderLeft: '4px solid #3498db',
  fontSize: '0.9rem'
},
errorMessage: {
  backgroundColor: '#f8d7da',
  color: '#721c24',
  padding: '1rem',
  borderRadius: '6px',
  marginBottom: '1rem',
  border: '1px solid #f5c6cb'
},
returnSection: {
  marginBottom: '1.5rem'
},
returnItemDetails: {
  display: 'flex',
  flexDirection: 'column',
  marginLeft: '0.5rem',
  flex: 1
},
itemMeta: {
  fontSize: '0.8rem',
  color: '#6c757d',
  marginTop: '0.25rem'
},
perishableWarning: {
  fontSize: '0.7rem',
  color: '#e67e22',
  backgroundColor: '#fdf2e9',
  padding: '0.2rem 0.5rem',
  borderRadius: '12px',
  marginTop: '0.25rem',
  display: 'inline-block'
},
summaryRow: {
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: '0.5rem',
  padding: '0.25rem 0'
}


};

export default OrderManagement;
