// firebase-config.js - Simplified version
const firebaseConfig = {
    apiKey: "AIzaSyCwlOYb-GNV7kBqX_Bo58OTN1FlINqGhao",
    authDomain: "electric-vehicle-recharg-bee81.firebaseapp.com",
    projectId: "electric-vehicle-recharg-bee81",
    storageBucket: "electric-vehicle-recharg-bee81.firebasestorage.app",
    messagingSenderId: "320394409518",
    appId: "1:320394409518:web:42142d9e41200b976091bf",
    measurementId: "G-DZEKDPXZVT"
};

// Initialize Firebase only once
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log('Firebase initialized successfully');
}

// Initialize Firestore only (no Storage for now to avoid CORS issues)
const db = firebase.firestore();

// Make db available globally
window.db = db;
console.log('Firestore initialized:', !!db);

// Logging utility
const logger = {
    log: (action, details) => {
        console.log(`[${new Date().toISOString()}] ${action}:`, details);
        // You can also send logs to Firebase
        db.collection('logs').add({
            action,
            details,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            user: auth.currentUser ? auth.currentUser.email : 'anonymous'
        });
    },
    error: (action, error) => {
        console.error(`[${new Date().toISOString()}] ERROR ${action}:`, error);
        db.collection('error_logs').add({
            action,
            error: error.toString(),
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            user: auth.currentUser ? auth.currentUser.email : 'anonymous'
        });
    }
};