// firebase-config.js
const firebaseConfig = {
    apiKey: "AIzaSyCwlOYb-GNV7kBqX_Bo58OTN1FlINqGhao",
    authDomain: "electric-vehicle-recharg-bee81.firebaseapp.com",
    projectId: "electric-vehicle-recharg-bee81",
    storageBucket: "electric-vehicle-recharg-bee81.firebasestorage.app",
    messagingSenderId: "320394409518",
    appId: "1:320394409518:web:42142d9e41200b976091bf",
    measurementId: "G-DZEKDPXZVT"
};

// Check if Firebase is already initialized
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Export initialized services as a single object
window.firebaseServices = {
    auth: firebase.auth(),
    db: firebase.firestore(),
    storage: firebase.storage ? firebase.storage() : null
};

console.log('Firebase initialized:', {
    auth: !!window.firebaseServices.auth,
    db: !!window.firebaseServices.db,
    storage: !!window.firebaseServices.storage
});

// Logging utility
const logger = {
    log: (action, details) => {
        console.log(`[${new Date().toISOString()}] ${action}:`, details);
        // You can also send logs to Firebase
        window.firebaseServices.db.collection('logs').add({
            action,
            details,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            user: window.firebaseServices.auth.currentUser ? 
                  window.firebaseServices.auth.currentUser.email : 'anonymous'
        });
    },
    error: (action, error) => {
        console.error(`[${new Date().toISOString()}] ERROR ${action}:`, error);
        window.firebaseServices.db.collection('error_logs').add({
            action,
            error: error.toString(),
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            user: window.firebaseServices.auth.currentUser ? 
                  window.firebaseServices.auth.currentUser.email : 'anonymous'
        });
    }
};
