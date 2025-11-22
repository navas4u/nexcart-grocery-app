// src/components/QuickCreditSales.jsx - COMPLETE VERSION WITH STYLES
import { useState } from 'react';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc,
  addDoc,
  setDoc,
  increment,
  arrayUnion
} from 'firebase/firestore';
import { db } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
// ============================================================================
// QUICK CREDIT SALES COMPONENT - WITH UNIFIED CUSTOMER SEARCH
// ============================================================================
const QuickCreditSales = ({ shopId, onSaleCompleted, onClose }) => {
  // ============================================================================
  // STATE MANAGEMENT - Customer search and sale processing
  // ============================================================================
  const [searchPhone, setSearchPhone] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [saleAmount, setSaleAmount] = useState('');
  const [saleDescription, setSaleDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('search'); // 'search', 'customer', 'amount'

  const auth = getAuth();
  const currentUser = auth.currentUser;

  // 🆕 PHASE 2: REGISTRATION STATE VARIABLES
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerPassword, setNewCustomerPassword] = useState(''); // 🆕 ADD THIS LINE

  // ============================================================================
  // UNIFIED CUSTOMER SEARCH - Searches BOTH customer_credits AND customers
  // ============================================================================
  const searchUnifiedCustomers = async () => {
    if (!searchPhone || searchPhone.length < 10) {
      alert('📱 Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    try {
      const formattedPhone = searchPhone.replace(/\D/g, '');
      
      // STEP 1: SEARCH CUSTOMER_CREDITS - Existing credit relationships
      const creditsQuery = query(
        collection(db, 'customer_credits'),
        where('shopId', '==', shopId),
        where('phoneNumber', '==', formattedPhone)
      );
      
      const creditsSnapshot = await getDocs(creditsQuery);
      const creditCustomers = creditsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        source: 'existing_credit',
        isPlatformCustomer: false
      }));

      // STEP 2: IF NO CREDIT CUSTOMERS, SEARCH PLATFORM CUSTOMERS
      let allCustomers = creditCustomers;
      
      if (creditCustomers.length === 0) {
        const customersQuery = query(
          collection(db, 'customers'),
          where('phone', '==', formattedPhone)
        );
        
        const customersSnapshot = await getDocs(customersQuery);
        const platformCustomers = customersSnapshot.docs.map(doc => ({
          id: doc.id,
          customerId: doc.id,
          ...doc.data(),
          source: 'platform_customer',
          isPlatformCustomer: true,
          currentBalance: 0,
          creditLimit: 5000,
          availableCredit: 5000,
          customerName: doc.data().firstName + ' ' + (doc.data().lastName || ''),
          customerEmail: doc.data().email || `${formattedPhone}@nexcart.customer`
        }));

        allCustomers = platformCustomers;
      }

            if (allCustomers.length === 0) {
        // 🆕 PHASE 2: OFFER REGISTRATION INSTEAD OF SHOWING ERROR
        const shouldRegister = window.confirm(
          '❌ No customer found with this phone number.\n\n' +
          'Would you like to register this customer now?\n\n' +
          'This will create:\n' +
          '✅ Customer account in main Auth system\n' +
          '✅ Customer profile in customers collection\n' +
          '✅ Credit account with ₹5000 limit\n' +
          '✅ Phone number stored for future searches'
        );
        
        if (shouldRegister) {
          setNewCustomerPhone(formattedPhone);
          setStep('register'); // 🆕 NEW REGISTRATION STEP
        } else {
          setSearchResults([]);
        }
      } else {
        setSearchResults(allCustomers);
        setStep('customer');
      } 
    } catch (error) {
      console.error('Error searching customers:', error);
      alert('🔍 Error searching for customer. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // CUSTOMER SELECTION HANDLER - Prepare for sale entry
  // ============================================================================
  const handleCustomerSelect = async (customer) => {
    setLoading(true);
    try {
      let finalCustomer = customer;
      
      // CREATE CREDIT ACCOUNT FOR PLATFORM CUSTOMERS
      if (customer.isPlatformCustomer) {
        const creditDocId = `${customer.customerId}_${shopId}`;
        const creditRef = doc(db, 'customer_credits', creditDocId);
        
        const creditData = {
          id: creditDocId,
          customerId: customer.customerId,
          shopId: shopId,
          customerEmail: customer.customerEmail,
          customerName: customer.customerName,
          phoneNumber: searchPhone.replace(/\D/g, ''),
          creditLimit: 5000,
          currentBalance: 0,
          availableCredit: 5000,
          createdAt: new Date(),
          updatedAt: new Date(),
          paymentHistory: [],
          status: 'active',
          isPlatformCustomer: true
        };

        await setDoc(creditRef, creditData);
        
        finalCustomer = {
          ...customer,
          id: creditDocId,
          source: 'platform_customer_activated'
        };
        
        console.log('✅ Created credit account for platform customer:', creditDocId);
      }

      setSelectedCustomer(finalCustomer);
      setStep('amount');
      setSaleDescription(`Quick credit sale - ${finalCustomer.customerName}`);
      
    } catch (error) {
      console.error('Error preparing customer for sale:', error);
      alert('❌ Error preparing customer account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

     // ============================================================================
  // 🆕 PHASE 2: NEW CUSTOMER REGISTRATION - WITH SESSION PRESERVATION
  // ============================================================================
  const registerNewCustomer = async () => {
    // 🆕 VALIDATE PASSWORD LENGTH
    if (!newCustomerPassword || newCustomerPassword.length < 6) {
      alert('❌ Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    
    // 🆕 CLEAR MESSAGE FOR SHOP OWNER ABOUT RE-LOGIN
    const shopOwnerMessage = 
      '🔐 SHOP OWNER VERIFICATION REQUIRED\n\n' +
      'To register a new customer, we need to verify your identity.\n\n' +
      '📋 WHAT WILL HAPPEN:\n' +
      '1. You enter your password below\n' + 
      '2. System creates customer account\n' +
      '3. You are automatically re-logged in\n' +
      '4. Continue with credit sale immediately\n\n' +
      '🔒 Your session remains secure throughout.';

    // 🆕 GET SHOP OWNER PASSWORD WITH CLEAR EXPLANATION
    let shopOwnerPassword = null;
    try {
      shopOwnerPassword = prompt(shopOwnerMessage, '');
      
      if (!shopOwnerPassword) {
        alert('❌ Registration cancelled. Password required for security verification.');
        setLoading(false);
        return;
      }
    } catch (error) {
      alert('❌ Cannot proceed without password verification.');
      setLoading(false);
      return;
    }

    const shopOwnerEmail = currentUser.email;

    try {
      const email = newCustomerEmail || `${newCustomerPhone}@nexcart.customer`;
      
      console.log('🔐 Creating Auth account with custom password...', email);
      
      // 🆕 STEP 1: CREATE AUTH ACCOUNT WITH CUSTOM PASSWORD
      const userCredential = await createUserWithEmailAndPassword(auth, email, newCustomerPassword);
      const userId = userCredential.user.uid;
      console.log('✅ Auth account created:', userId);

      // 🆕 STEP 2: CREATE CUSTOMER PROFILE
      console.log('👤 Creating customer profile...');
      const customerData = {
        firstName: newCustomerName.split(' ')[0],
        lastName: newCustomerName.split(' ').slice(1).join(' ') || '',
        phone: newCustomerPhone,
        email: email,
        createdAt: new Date(),
        updatedAt: new Date(),
        isProfileComplete: false,
        registeredBy: currentUser.uid,
        shopId: shopId,
        address: {
          street: '',
          area: '',
          city: '',
          state: '',
          pincode: '',
          landmark: ''
        },
        privacySettings: {
          discoverableByShops: false,
          privacyLevel: "private"
        }
      };
      
      await setDoc(doc(db, 'customers', userId), customerData);
      console.log('✅ Customer profile created');

      // 🆕 STEP 3: CREATE CREDIT ACCOUNT
      console.log('💰 Creating credit account...');
      const creditDocId = `${userId}_${shopId}`;
      const creditData = {
        id: creditDocId,
        customerId: userId,
        shopId: shopId,
        customerEmail: email,
        customerName: newCustomerName,
        phoneNumber: newCustomerPhone,
        creditLimit: 5000,
        currentBalance: 0,
        availableCredit: 5000,
        createdAt: new Date(),
        updatedAt: new Date(),
        paymentHistory: [],
        status: 'active',
        registeredBy: currentUser.uid,
        isPlatformCustomer: true
      };

      await setDoc(doc(db, 'customer_credits', creditDocId), creditData);
      console.log('✅ Credit account created:', creditDocId);

      // 🆕 STEP 4: RE-LOGIN SHOP OWNER WITH SUCCESS MESSAGE
      console.log('🔄 Re-authenticating shop owner...');
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      await signInWithEmailAndPassword(auth, shopOwnerEmail, shopOwnerPassword);
      console.log('✅ Shop owner re-authenticated');

      // 🆕 STEP 5: SHOW SUCCESS WITH CLEAR CREDENTIALS
      const credentialsMessage = `✅ CUSTOMER REGISTRATION COMPLETE!\n\n` +
        `📍 LOGIN CREDENTIALS - SHARE WITH CUSTOMER:\n` +
        `📧 Email: ${email}\n` +
        `🔐 Password: ${newCustomerPassword}\n\n` +
        `📱 CUSTOMER INSTRUCTIONS:\n` +
        `1. Download NexCart Customer App\n` +
        `2. Login with above credentials\n` +
        `3. Complete address in profile settings\n` +
        `4. Start shopping with ₹5,000 credit!\n\n` +
        `💰 You can now record the first credit sale for this customer!`;
      
      alert(credentialsMessage);

      // 🆕 STEP 6: AUTO-SELECT FOR IMMEDIATE SALE
      const newCustomer = {
        id: creditDocId,
        customerId: userId,
        customerEmail: email,
        customerName: newCustomerName,
        phoneNumber: newCustomerPhone,
        currentBalance: 0,
        creditLimit: 5000,
        availableCredit: 5000,
        source: 'new_registration'
      };

      setSelectedCustomer(newCustomer);
      setStep('amount');

    } catch (error) {
      console.error('❌ Registration Error:', error);
      
      // 🆕 TRY TO RE-LOGIN SHOP OWNER EVEN ON ERROR
      try {
        const { signInWithEmailAndPassword } = await import('firebase/auth');
        await signInWithEmailAndPassword(auth, shopOwnerEmail, shopOwnerPassword);
        console.log('✅ Shop owner re-authenticated after error');
        
        // Show error but keep shop owner logged in
        let errorMessage = `Error registering customer: ${error.message}`;
        if (error.code === 'auth/email-already-in-use') {
          errorMessage = '❌ Email already registered. Please use a different email or leave it blank for auto-generation.';
        } else if (error.code === 'auth/weak-password') {
          errorMessage = '❌ Password is too weak. Please use a stronger password.';
        } else if (error.code === 'auth/wrong-password') {
          errorMessage = '❌ Your shop owner password was incorrect. Please try registration again.';
        }
        
        alert(errorMessage);
        
      } catch (reloginError) {
        console.error('❌ Failed to re-authenticate shop owner:', reloginError);
        alert('❌ Registration failed AND could not restore your session. Please login again.');
        onClose(); // Close the modal
        return;
      }
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // QUICK CREDIT SALE PROCESSING - Creates order with auto-approval
  // ============================================================================
  const processQuickCreditSale = async () => {
    const amount = parseFloat(saleAmount);
    if (!amount || amount <= 0) {
      alert('💰 Please enter a valid sale amount greater than 0');
      return;
    }

    if (selectedCustomer.availableCredit < amount) {
      alert(`❌ Sale amount (₹${amount}) exceeds available credit (₹${selectedCustomer.availableCredit})`);
      return;
    }

    setLoading(true);
    try {
      // STEP 1: CREATE ORDER RECORD
      const quickOrder = {
        orderId: `QC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        customerId: selectedCustomer.customerId,
        customerEmail: selectedCustomer.customerEmail,
        shopId: shopId,
        shopName: "Quick Sale",
        items: [{
          productId: 'quick_sale_' + Date.now(),
          name: saleDescription || 'Quick Credit Sale',
          price: amount,
          quantity: 1,
          total: amount.toFixed(2),
          unit: 'sale'
        }],
        orderTotal: amount,
        totalAmount: amount,
        subtotal: amount,
        deliveryFee: 0,
        paymentMethod: 'credit',
        creditAmount: amount,
        cashAmount: 0,
        creditRequested: true,
        status: 'pending_approval',
        creditApproved: false,
        orderType: 'quick_credit_sale',
        deliveryType: 'pickup',
        orderNotes: 'Quick credit sale processed by shop owner',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // STEP 2: SAVE ORDER TO FIRESTORE
      const orderRef = await addDoc(collection(db, 'orders'), quickOrder);
      const orderWithId = { ...quickOrder, id: orderRef.id };

      // STEP 3: AUTO-APPROVE CREDIT
      const creditRef = doc(db, 'customer_credits', selectedCustomer.id);
      
      await updateDoc(creditRef, {
        currentBalance: increment(amount),
        availableCredit: increment(-amount),
        updatedAt: new Date(),
        paymentHistory: arrayUnion({
          date: new Date(),
          amount: amount,
          orderId: orderRef.id,
          type: 'credit_purchase',
          description: saleDescription || `Quick credit sale - ${selectedCustomer.customerName}`,
          recordedBy: currentUser.uid,
          recordedByEmail: currentUser.email,
          autoApproved: true
        })
      });

      // STEP 4: UPDATE ORDER STATUS TO COMPLETED
      await updateDoc(orderRef, {
        status: 'completed',
        creditApproved: true,
        confirmedAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date()
      });

      // STEP 5: UPDATE SHOP STATISTICS
      try {
        const shopRef = doc(db, 'shops', shopId);
        await updateDoc(shopRef, {
          'stats.totalSales': increment(1),
          'stats.totalRevenue': increment(amount),
          updatedAt: new Date()
        });
      } catch (shopError) {
        console.log('Shop stats update optional - continuing...');
      }

      // STEP 6: SHOW SUCCESS & CLEAN UP
      alert(`✅ Quick credit sale recorded successfully!\n\n` +
            `Customer: ${selectedCustomer.customerName}\n` +
            `Amount: ₹${amount.toLocaleString()}\n` +
            `Description: ${saleDescription}\n` +
            `Order ID: ${orderRef.id.slice(-8)}\n\n` +
            `Credit account ${selectedCustomer.isPlatformCustomer ? 'created and ' : ''}updated.`);

      resetForm();
      
      if (onSaleCompleted) {
        onSaleCompleted({
          customer: selectedCustomer,
          saleAmount: amount,
          orderId: orderRef.id,
          description: saleDescription,
          isNewCustomer: selectedCustomer.isPlatformCustomer
        });
      }

      onClose();

    } catch (error) {
      console.error('Error processing quick credit sale:', error);
      alert(`❌ Error recording sale: ${error.message}\n\nPlease try again.`);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // UI HELPER FUNCTIONS - Form management
  // ============================================================================
    const resetForm = () => {
    setSearchPhone('');
    setSearchResults([]);
    setSelectedCustomer(null);
    setSaleAmount('');
    setSaleDescription('');
    setStep('search');
    // 🆕 Reset registration fields
    setNewCustomerPhone('');
    setNewCustomerName('');
    setNewCustomerEmail('');
    setNewCustomerPassword(''); // 🆕 ADD THIS LINE
  };

    const goBack = () => {
    if (step === 'customer') {
      setStep('search');
      setSearchResults([]);
    } else if (step === 'amount') {
      setStep('customer');
      setSelectedCustomer(null);
    } else if (step === 'register') {
      setStep('search'); // 🆕 Handle registration step
      setNewCustomerName('');
      setNewCustomerEmail('');
    }
  };

  // ============================================================================
  // RENDER LOGIC - Modal UI with clear step progression
  // ============================================================================
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalContent}>
        
        {/* MODAL HEADER */}
        <div style={styles.modalHeader}>
          <h3>💰 Quick Credit Sale</h3>
          <button onClick={onClose} style={styles.closeButton}>✕</button>
        </div>

        {/* STEP 1: CUSTOMER SEARCH */}
        {step === 'search' && (
          <div style={styles.stepContent}>
            <div style={styles.inputGroup}>
              <label>🔍 Search Customer by Phone</label>
              <input
                type="tel"
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter customer's registered phone number"
                style={styles.phoneInput}
                maxLength={10}
              />
              <small style={styles.helpText}>
                Searches both existing credit customers and platform customers
              </small>
            </div>

            <div style={styles.actionButtons}>
              <button onClick={onClose} style={styles.cancelButton}>
                Cancel
              </button>
              <button 
                onClick={searchUnifiedCustomers}
                disabled={loading || !searchPhone || searchPhone.length < 10}
                style={loading ? styles.searchButtonDisabled : styles.searchButton}
              >
                {loading ? '🔍 Searching...' : '🔍 Search Customer'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: CUSTOMER SELECTION */}
        {step === 'customer' && searchResults.length > 0 && (
          <div style={styles.stepContent}>
            <h4>👥 Select Customer</h4>
            <p style={styles.resultsInfo}>Found {searchResults.length} customer(s)</p>
            
            <div style={styles.customersList}>
              {searchResults.map(customer => (
                <div 
                  key={customer.id}
                  onClick={() => handleCustomerSelect(customer)}
                  style={styles.customerCard}
                >
                  <div style={styles.customerInfo}>
                    <strong>{customer.customerName}</strong>
                    <div>📞 {searchPhone.replace(/\D/g, '')}</div>
                    <div>💰 Current Balance: ₹{customer.currentBalance?.toLocaleString()}</div>
                    <div>💳 Available Credit: ₹{customer.availableCredit?.toLocaleString()}</div>
                    <div style={getCustomerSourceStyle(customer.source)}>
                      {getCustomerSourceLabel(customer.source)}
                    </div>
                  </div>
                  <div style={styles.selectArrow}>→</div>
                </div>
              ))}
            </div>

            <div style={styles.actionButtons}>
              <button onClick={goBack} style={styles.secondaryButton}>
                ← Back to Search
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: SALE AMOUNT ENTRY */}
        {step === 'amount' && selectedCustomer && (
          <div style={styles.stepContent}>
            <h4>💰 Enter Sale Details</h4>
            
            {/* SELECTED CUSTOMER SUMMARY */}
            <div style={styles.customerSummary}>
              <h5>Customer: {selectedCustomer.customerName}</h5>
              <div style={styles.balanceInfo}>
                <div>📞 Phone: {searchPhone.replace(/\D/g, '')}</div>
                <div>💰 Current Balance: ₹{selectedCustomer.currentBalance?.toLocaleString()}</div>
                <div>💳 Available Credit: ₹{selectedCustomer.availableCredit?.toLocaleString()}</div>
                <div>🏪 Credit Limit: ₹{selectedCustomer.creditLimit?.toLocaleString()}</div>
                <div style={getCustomerSourceStyle(selectedCustomer.source)}>
                  Type: {getCustomerSourceLabel(selectedCustomer.source)}
                </div>
              </div>
            </div>

            {/* SALE AMOUNT INPUT */}
            <div style={styles.inputGroup}>
              <label>💵 Sale Amount (₹)</label>
              <input
                type="number"
                value={saleAmount}
                onChange={(e) => setSaleAmount(e.target.value)}
                placeholder="Enter sale amount"
                style={styles.amountInput}
                min="1"
                max={selectedCustomer.availableCredit}
                step="1"
              />
              <small style={styles.helpText}>
                Maximum: ₹{selectedCustomer.availableCredit?.toLocaleString()} (available credit)
              </small>
            </div>

            {/* SALE DESCRIPTION */}
            <div style={styles.inputGroup}>
              <label>📝 Description (Optional)</label>
              <input
                type="text"
                value={saleDescription}
                onChange={(e) => setSaleDescription(e.target.value)}
                placeholder="e.g., Groceries, Electronics, General purchase..."
                style={styles.descriptionInput}
              />
              <small style={styles.helpText}>
                This will appear in customer's credit history
              </small>
            </div>

            {/* SALE PREVIEW */}
            {saleAmount && (
              <div style={styles.salePreview}>
                <h5>📋 Sale Summary</h5>
                <div style={styles.previewItem}>
                  <span>Customer:</span>
                  <span>{selectedCustomer.customerName}</span>
                </div>
                <div style={styles.previewItem}>
                  <span>Customer Type:</span>
                  <span>{getCustomerSourceLabel(selectedCustomer.source)}</span>
                </div>
                <div style={styles.previewItem}>
                  <span>Sale Amount:</span>
                  <span style={styles.amount}>₹{parseFloat(saleAmount).toLocaleString()}</span>
                </div>
                <div style={styles.previewItem}>
                  <span>Current Balance:</span>
                  <span>₹{selectedCustomer.currentBalance?.toLocaleString()}</span>
                </div>
                <div style={styles.previewItem}>
                  <span>New Balance:</span>
                  <span style={styles.balance}>
                    ₹{(selectedCustomer.currentBalance + parseFloat(saleAmount)).toLocaleString()}
                  </span>
                </div>
                <div style={styles.previewItem}>
                  <span>Remaining Credit:</span>
                  <span style={styles.credit}>
                    ₹{(selectedCustomer.availableCredit - parseFloat(saleAmount)).toLocaleString()}
                  </span>
                </div>
              </div>
            )}
            

            {/* ACTION BUTTONS */}
            <div style={styles.actionButtons}>
              <button onClick={goBack} style={styles.secondaryButton}>
                ← Change Customer
              </button>
              <button 
                onClick={processQuickCreditSale}
                disabled={loading || !saleAmount || parseFloat(saleAmount) <= 0}
                style={loading ? styles.primaryButtonDisabled : styles.primaryButton}
              >
                {loading ? 'Processing...' : '✅ Record Credit Sale'}
              </button>
            </div>
          </div>
        )} 

        {/* 🆕 STEP 4: CUSTOMER REGISTRATION - PLACE RIGHT HERE */}
                {/* 🆕 STEP 4: CUSTOMER REGISTRATION */}
        {step === 'register' && (
          <div style={styles.stepContent}>
            <h4>👥 Register New Customer</h4>
            
            <div style={styles.inputGroup}>
              <label>📱 Phone Number</label>
              <input
                type="tel"
                value={newCustomerPhone}
                readOnly
                style={styles.phoneInput}
              />
              <small style={styles.helpText}>
                Phone number from your search - cannot be changed
              </small>
            </div>

            <div style={styles.inputGroup}>
              <label>👤 Customer Full Name *</label>
              <input
                type="text"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                placeholder="Enter customer full name"
                style={styles.nameInput}
                required
              />
              <small style={styles.helpText}>
                Required for account creation
              </small>
            </div>

            {/* 🆕 PASSWORD FIELD - THIS WAS MISSING! */}
            <div style={styles.inputGroup}>
              <label>🔐 Set Login Password *</label>
              <input
                type="password"
                value={newCustomerPassword}
                onChange={(e) => setNewCustomerPassword(e.target.value)}
                placeholder="Enter 6+ character password"
                style={styles.passwordInput}
                minLength="6"
                required
              />
              <small style={styles.helpText}>
                Minimum 6 characters. Customer will use this password to login to NexCart app.
              </small>
              {newCustomerPassword && newCustomerPassword.length < 6 && (
                <small style={styles.errorText}>
                  ❌ Password must be at least 6 characters
                </small>
              )}
            </div>

            <div style={styles.inputGroup}>
              <label>📧 Email (Optional)</label>
              <input
                type="email"
                value={newCustomerEmail}
                onChange={(e) => setNewCustomerEmail(e.target.value)}
                placeholder="customer@example.com"
                style={styles.emailInput}
              />
              <small style={styles.helpText}>
                If no email provided, will use: {newCustomerPhone}@nexcart.customer
              </small>
            </div>

            {/* 🆕 REGISTRATION PREVIEW */}
            <div style={styles.registrationPreview}>
              <h5>📋 Account Summary</h5>
              <div style={styles.previewItem}>
                <span>Name:</span>
                <span>{newCustomerName || 'Not set'}</span>
              </div>
              <div style={styles.previewItem}>
                <span>Phone:</span>
                <span>{newCustomerPhone}</span>
              </div>
              <div style={styles.previewItem}>
                <span>Email:</span>
                <span>{newCustomerEmail || `${newCustomerPhone}@nexcart.customer`}</span>
              </div>
              <div style={styles.previewItem}>
                <span>Password:</span>
                <span>{newCustomerPassword ? '••••••' : 'Not set'}</span>
              </div>
              <div style={styles.previewItem}>
                <span>Credit Limit:</span>
                <span style={styles.limit}>₹5,000</span>
              </div>
            </div>

            <div style={styles.actionButtons}>
              <button onClick={() => setStep('search')} style={styles.secondaryButton}>
                ← Cancel Registration
              </button>
              <button 
                onClick={registerNewCustomer}
                disabled={loading || !newCustomerName || !newCustomerPassword || newCustomerPassword.length < 6}
                style={
                  loading || !newCustomerName || !newCustomerPassword || newCustomerPassword.length < 6 
                    ? styles.primaryButtonDisabled 
                    : styles.primaryButton
                }
              >
                {loading ? 'Creating Account...' : '✅ Create Customer Account'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

// ============================================================================
// HELPER FUNCTIONS - Customer source labeling
// ============================================================================
const getCustomerSourceLabel = (source) => {
  const sources = {
    'existing_credit': '🛒 Existing Credit Customer',
    'platform_customer': '🌐 Platform Customer (New Credit)',
    'platform_customer_activated': '🌐 Platform Customer (Credit Activated)'
  };
  return sources[source] || 'Customer';
};

const getCustomerSourceStyle = (source) => {
  const baseStyle = {
    fontSize: '0.8rem',
    fontWeight: '600',
    marginTop: '0.25rem',
  };
  
  const colors = {
    'existing_credit': { color: '#27ae60' },
    'platform_customer': { color: '#3498db' },
    'platform_customer_activated': { color: '#9b59b6' }
  };
  
  return { ...baseStyle, ...(colors[source] || { color: '#7f8c8d' }) };
};

// ============================================================================
// COMPONENT STYLES - COMPLETE STYLES SECTION
// ============================================================================
const styles = {
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
    zIndex: 1000,
    padding: '1rem',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '500px',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
  },
  modalHeader: {
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
    color: '#7f8c8d',
  },
  stepContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  phoneInput: {
    padding: '1rem',
    border: '2px solid #e9ecef',
    borderRadius: '8px',
    fontSize: '1.1rem',
    fontFamily: 'monospace',
  },
  amountInput: {
    padding: '1rem',
    border: '2px solid #e9ecef',
    borderRadius: '8px',
    fontSize: '1.1rem',
    fontFamily: 'monospace',
  },
  descriptionInput: {
    padding: '1rem',
    border: '2px solid #e9ecef',
    borderRadius: '8px',
    fontSize: '1rem',
  },
  helpText: {
    color: '#6c757d',
    fontSize: '0.8rem',
  },
  actionButtons: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'flex-end',
    marginTop: '1rem',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  searchButton: {
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  searchButtonDisabled: {
    backgroundColor: '#bdc3c7',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '8px',
    cursor: 'not-allowed',
    fontSize: '0.9rem',
  },
  primaryButton: {
    backgroundColor: '#27ae60',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  primaryButtonDisabled: {
    backgroundColor: '#bdc3c7',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '8px',
    cursor: 'not-allowed',
    fontSize: '0.9rem',
  },
  secondaryButton: {
    backgroundColor: '#95a5a6',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  customersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    maxHeight: '300px',
    overflowY: 'auto',
  },
  customerCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem',
    border: '2px solid #e9ecef',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    backgroundColor: '#f8f9fa',
  },
  customerInfo: {
    flex: 1,
  },
  selectArrow: {
    fontSize: '1.5rem',
    color: '#3498db',
    fontWeight: 'bold',
  },
  customerSummary: {
    backgroundColor: '#e8f4fd',
    padding: '1rem',
    borderRadius: '8px',
    border: '1px solid #b3d9ff',
  },
  balanceInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    fontSize: '0.9rem',
    color: '#2c3e50',
  },
  salePreview: {
    backgroundColor: '#d4edda',
    padding: '1rem',
    borderRadius: '8px',
    border: '1px solid #c3e6cb',
  },
  previewItem: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '0.5rem',
    padding: '0.25rem 0',
  },
  amount: {
    color: '#e74c3c',
    fontWeight: 'bold',
  },
  balance: {
    color: '#2c3e50',
    fontWeight: 'bold',
  },
  credit: {
    color: '#27ae60',
    fontWeight: 'bold',
  },
  resultsInfo: {
    color: '#7f8c8d',
    fontSize: '0.9rem',
    marginBottom: '1rem',
  },
    nameInput: {
    padding: '1rem',
    border: '2px solid #e9ecef',
    borderRadius: '8px',
    fontSize: '1rem',
  },
  emailInput: {
    padding: '1rem',
    border: '2px solid #e9ecef',
    borderRadius: '8px',
    fontSize: '1rem',
  },
  registrationPreview: {
    backgroundColor: '#e8f4fd',
    padding: '1rem',
    borderRadius: '8px',
    border: '1px solid #b3d9ff',
  },
  limit: {
    color: '#27ae60',
    fontWeight: 'bold',
  },
  passwordInput: {
    padding: '1rem',
    border: '2px solid #e9ecef',
    borderRadius: '8px',
    fontSize: '1rem',
  },
  errorText: {
    color: '#e74c3c',
    fontSize: '0.8rem',
    marginTop: '0.25rem',
  },
};

export default QuickCreditSales;