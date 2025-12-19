
/* ... (server.js content remains the same as before) ... */
// server.js (Node.js with Express)
// This is a conceptual backend for CryptoTube's withdrawal system.
// It uses mock data and simplified logic for demonstration.
// For production, you NEED robust database integration, Telegram initData validation,
// real payment gateway integrations, and comprehensive security measures.

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const admin = require('firebase-admin'); // Firebase Admin SDK for secure server-side access

// --- Firebase Admin SDK Initialization ---
// You NEED to download your Firebase Service Account Key JSON file
// from Firebase Console -> Project settings -> Service accounts -> Generate new private key
const serviceAccount = require("./serviceAccountKey.json"); // <--- IMPORTANT: Path to your Firebase Admin SDK JSON

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
  // You might need to specify your databaseURL if using Realtime Database
  // databaseURL: "https://<YOUR_PROJECT_ID>.firebaseio.com"
});

const dbAdmin = admin.firestore(); // Firestore instance for backend

const app = express();
const PORT = process.env.PORT || 3000; // Your frontend app.js should point to this port

// --- Middleware ---
app.use(cors()); // Allows frontend (different origin) to make requests
app.use(bodyParser.json()); // Parses JSON bodies of incoming requests

// Helper to ensure mock user exists and has a balance
async function ensureUser(userId, username) {
    const userRef = dbAdmin.collection('users').doc(userId);
    const doc = await userRef.get();
    if (!doc.exists) {
        // Create user in Firestore (securely by backend)
        await userRef.set({
            telegramId: userId,
            username: username,
            balance: 0.00,
            totalEarned: 0.00,
            ipAddress: 'N/A', // Will be updated by frontend on init
            joinedAt: admin.firestore.FieldValue.serverTimestamp(),
            freeLinks: 5,
            totalLinks: 0
        });
        console.log(`Backend created new user: ${username} (${userId})`);
        return { telegramId: userId, username, balance: 0.00, totalEarned: 0.00 };
    }
    return doc.data();
}

// --- Telegram WebApp InitData Validation Middleware ---
// This is a crucial security step for Telegram Mini Apps.
// In a real app, you'd use a library or custom logic to validate `initData`.
// For this simple demo, we'll just check for headers existence.
app.use(async (req, res, next) => {
    const telegramUserId = req.headers['x-telegram-user-id'];
    const telegramInitData = req.headers['x-telegram-init-data'];

    if (!telegramUserId) {
        return res.status(401).json({ message: 'Unauthorized: Missing X-Telegram-User-ID header.' });
    }
    // In production, validate telegramInitData against Telegram Bot API to ensure request authenticity.
    // E.g., const isValid = validateTelegramInitData(telegramInitData, process.env.BOT_TOKEN);
    // if (!isValid) return res.status(401).json({ message: 'Unauthorized: Invalid Telegram InitData.' });

    req.userId = telegramUserId;
    // For demo, try to get username from frontend init if available
    const userDoc = await dbAdmin.collection('users').doc(telegramUserId).get();
    if (userDoc.exists) {
        req.username = userDoc.data().username;
    } else {
        // This is a fallback, ideally frontend registers the user or sends more info
        req.username = `User_${telegramUserId.split('_')[1] || Date.now()}`;
    }
    
    // Ensure user exists in our mock data/DB
    await ensureUser(req.userId, req.username);

    next();
});

// --- API Endpoints ---

// Get User Balance
app.get('/api/user/balance', async (req, res) => {
    try {
        const userRef = dbAdmin.collection('users').doc(req.userId);
        const doc = await userRef.get();
        if (!doc.exists) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.json({ balance: doc.data().balance || 0.00 });
    } catch (error) {
        console.error('Backend error fetching balance:', error);
        res.status(500).json({ message: 'Failed to fetch balance.' });
    }
});

// Award reward to user (e.g., from watching ads or videos)
app.post('/api/earn-reward', async (req, res) => {
    const { amount } = req.body;
    const userId = req.userId;

    if (amount <= 0 || isNaN(amount)) {
        return res.status(400).json({ message: 'Invalid reward amount.' });
    }

    try {
        const userRef = dbAdmin.collection('users').doc(userId);
        await dbAdmin.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) {
                throw new Error('User not found.');
            }
            const currentBalance = userDoc.data().balance || 0.00;
            const currentTotalEarned = userDoc.data().totalEarned || 0.00;

            transaction.update(userRef, {
                balance: currentBalance + amount,
                totalEarned: currentTotalEarned + amount
            });
        });
        res.status(200).json({ message: `Reward of ${amount.toFixed(2)} added.` });
    } catch (error) {
        console.error('Backend error adding reward:', error);
        res.status(500).json({ message: `Failed to add reward: ${error.message}` });
    }
});

// Deduct cost from user (e.g., for submitting links)
app.post('/api/deduct-cost', async (req, res) => {
    const { amount } = req.body;
    const userId = req.userId;

    if (amount <= 0 || isNaN(amount)) {
        return res.status(400).json({ message: 'Invalid deduction amount.' });
    }

    try {
        const userRef = dbAdmin.collection('users').doc(userId);
        await dbAdmin.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) {
                throw new Error('User not found.');
            }
            const currentBalance = userDoc.data().balance || 0.00;

            if (currentBalance < amount) {
                throw new Error('Insufficient balance for deduction.');
            }

            transaction.update(userRef, {
                balance: currentBalance - amount
            });
        });
        res.status(200).json({ message: `Cost of ${amount.toFixed(2)} deducted.` });
    } catch (error) {
        console.error('Backend error deducting cost:', error);
        res.status(500).json({ message: `Failed to deduct cost: ${error.message}` });
    }
});


// Submit Withdrawal Request
app.post('/api/withdraw', async (req, res) => {
    const { amount, type, destination, amountUSDT } = req.body;
    const userId = req.userId;
    const username = req.username; // From middleware
    const userIp = req.ip; // Express's way to get client IP

    try {
        // 1. Fetch user's current balance from Firestore
        const userRef = dbAdmin.collection('users').doc(userId);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            return res.status(404).json({ message: 'User not found on backend.' });
        }
        const userBalance = userDoc.data().balance || 0.00;

        // 2. Server-side Validation
        if (amount <= 0 || isNaN(amount)) {
            return res.status(400).json({ message: 'Invalid withdrawal amount.' });
        }
        if (amount < 1) { // Min withdrawal 1 Peso
            return res.status(400).json({ message: 'Minimum withdrawal is 1⚡ Peso.' });
        }
        if (userBalance < amount) {
            return res.status(400).json({ message: 'Insufficient balance on backend.' });
        }

        // More specific validation (e.g., regex for Gcash, crypto address validation)
        if (type === 'Gcash' && !/^(09|\+639)\d{9}$/.test(destination)) {
             return res.status(400).json({ message: 'Invalid Gcash number format.' });
        }
        if (type === 'FaucetPay' && (!destination.includes('@') || amount > 100)) { // Simplified FaucetPay email/max check
            return res.status(400).json({ message: 'Invalid FaucetPay email or amount exceeds 100⚡ Peso limit.' });
        }

        // 3. Deduct Balance (Atomic operation in a real DB transaction)
        // For Firestore, this is an update with FieldValue.increment.
        await userRef.update({
            balance: admin.firestore.FieldValue.increment(-amount)
        });

        // 4. Create Withdrawal Record
        const withdrawalData = {
            userId,
            username,
            amountPeso: amount,
            type,
            details: destination,
            amountUSDT: amountUSDT || null,
            status: 'Pending',
            requestedAt: admin.firestore.FieldValue.serverTimestamp(),
            ipAddress: userIp
        };

        const withdrawalRef = await dbAdmin.collection('withdrawals').add(withdrawalData);
        const withdrawalId = withdrawalRef.id;

        // 5. Simulate payout routing (optional, based on amount)
        let speed = 'Admin-Fast Review'; // Default
        if (amount < 10) speed = 'Auto-Instant';
        else if (amount < 50) speed = 'Smart-Queue';

        console.log(`Withdrawal request ${withdrawalId} received for ${username} (${userId}). Amount: ${amount} ${type}. Status: Pending. Speed: ${speed}`);

        // In a real system, you would push this to a queue for an asynchronous payout processor
        // E.g., messageQueue.sendToQueue('payouts', { withdrawalId, amount, type, destination, ... });

        res.status(200).json({
            message: `Withdrawal request submitted for ${amount.toFixed(2)}⚡ Peso (${speed}). ID: ${withdrawalId}. It will be processed.`,
            status: 'Pending'
        });

    } catch (error) {
        console.error('Backend withdrawal error:', error);
        // Important: If deduction succeeded but record failed, you need to refund!
        // This is why atomic transactions are crucial.
        res.status(500).json({ message: 'An internal server error occurred during withdrawal.' });
    }
});

// Get User Withdrawal History
app.get('/api/user/withdrawals', async (req, res) => {
    const userId = req.userId;
    try {
        const snapshot = await dbAdmin.collection('withdrawals')
            .where('userId', '==', userId)
            .orderBy('requestedAt', 'desc')
            .get();
        const withdrawals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(withdrawals);
    } catch (error) {
        console.error('Backend error fetching user withdrawals:', error);
        res.status(500).json({ message: 'Failed to fetch withdrawal history.' });
    }
});


// --- Admin Endpoints (Require Admin Authentication) ---
// For a real app, define admin authentication middleware here.
// For this demo, we'll just check for a 'secret' header or similar.
const adminAuthMiddleware = (req, res, next) => {
    // In production, this would involve proper token-based authentication
    // or session management for an admin user.
    const adminToken = req.headers['authorization'];
    if (adminToken === 'Bearer DEMO_ADMIN_TOKEN') { // Simple demo token
        req.adminId = req.userId; // Assign the current user ID as admin ID for demo
        next();
    } else {
        res.status(403).json({ message: 'Forbidden: Admin access required.' });
    }
};

// Get All Withdrawal Requests for Admin
app.get('/api/admin/withdrawals', adminAuthMiddleware, async (req, res) => {
    try {
        const snapshot = await dbAdmin.collection('withdrawals')
            .where('status', '==', 'Pending') // Admins usually review pending requests
            .orderBy('requestedAt', 'asc')
            .get();
        const withdrawals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(withdrawals);
    } catch (error) {
        console.error('Backend error fetching all withdrawals for admin:', error);
        res.status(500).json({ message: 'Failed to fetch admin withdrawals.' });
    }
});

// Update Withdrawal Status by Admin
app.post('/api/admin/withdrawals/:id/status', adminAuthMiddleware, async (req, res) => {
    const withdrawalId = req.params.id;
    const { status, reason } = req.body;
    const adminId = req.adminId; // From adminAuthMiddleware

    try {
        const withdrawalRef = dbAdmin.collection('withdrawals').doc(withdrawalId);
        const withdrawalDoc = await withdrawalRef.get();
        if (!withdrawalDoc.exists) {
            return res.status(404).json({ message: 'Withdrawal request not found.' });
        }
        const currentWithdrawal = withdrawalDoc.data();

        if (['Approved', 'Rejected', 'Failed'].includes(currentWithdrawal.status)) {
            return res.status(400).json({ message: `Withdrawal already ${currentWithdrawal.status}. Cannot change.` });
        }

        const updateData = {
            status: status,
            processedBy: adminId, // Renamed from approvedBy for generic processing
            processedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        if (reason) updateData.reason = reason;

        await withdrawalRef.update(updateData);

        // If rejected/failed, refund the user's balance
        if (status === 'Rejected' || status === 'Failed') {
            const userRef = dbAdmin.collection('users').doc(currentWithdrawal.userId);
            await userRef.update({
                balance: admin.firestore.FieldValue.increment(currentWithdrawal.amountPeso)
            });
            console.log(`Withdrawal ${withdrawalId} ${status}. ${currentWithdrawal.amountPeso} Peso refunded to ${currentWithdrawal.userId}.`);
        }
        // In a real system, 'Approved' would trigger the actual payout process here
        // or a notification to a payment worker.

        res.status(200).json({ message: `Withdrawal ${withdrawalId} status updated to ${status}.` });

    } catch (error) {
        console.error('Backend error updating withdrawal status:', error);
        res.status(500).json({ message: 'Failed to update withdrawal status.' });
    }
});


// --- Start Server ---
app.listen(PORT, () => {
    console.log(`CryptoTube Backend Server running on http://localhost:${PORT}`);
    console.log('--- IMPORTANT ---');
    console.log('This is a DEMO backend. It lacks full security, validation, and real payment integration.');
    console.log('DO NOT USE IN PRODUCTION WITHOUT SIGNIFICANT DEVELOPMENT.');
});
