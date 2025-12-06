class AuthManager {
    constructor() {
        this.init();
    }

    init() {
        this.checkAuthState();
        this.setupEventListeners();
    }

    checkAuthState() {
        auth.onAuthStateChanged((user) => {
            if (user) {
                this.redirectBasedOnRole(user.uid);
            }
        });
    }

    setupEventListeners() {
        // Login Form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Register Form
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }

        // Role Selection Buttons
        document.querySelectorAll('.btn-role').forEach(button => {
            button.addEventListener('click', (e) => this.setRole(e));
        });
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const rememberMe = document.getElementById('rememberMe')?.checked;

        try {
            logger.log('LOGIN_ATTEMPT', { email });
            
            // Set persistence based on remember me
            const persistence = rememberMe ? 
                firebase.auth.Auth.Persistence.LOCAL : 
                firebase.auth.Auth.Persistence.SESSION;
            
            await auth.setPersistence(persistence);
            
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            logger.log('LOGIN_SUCCESS', { userId: user.uid, email: user.email });
            
            // Get user role from Firestore
            const userDoc = await db.collection('users').doc(user.uid).get();
            const userData = userDoc.data();
            
            if (userData && userData.role === 'admin') {
                window.location.href = 'admin-panel.html';
            } else {
                window.location.href = 'userpanel.html';
            }
            
        } catch (error) {
            logger.error('LOGIN_ERROR', error);
            this.showMessage(error.message, 'error');
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const name = document.getElementById('regName').value;
        const email = document.getElementById('regEmail').value;
        const phone = document.getElementById('regPhone').value;
        const password = document.getElementById('regPassword').value;
        const confirmPassword = document.getElementById('regConfirmPassword').value;
        const userType = document.querySelector('input[name="userType"]:checked').value;
        
        // Validation
        if (password !== confirmPassword) {
            this.showMessage('Passwords do not match', 'error');
            return;
        }
        
        if (password.length < 6) {
            this.showMessage('Password must be at least 6 characters', 'error');
            return;
        }

        try {
            logger.log('REGISTER_ATTEMPT', { email, userType });
            
            // Create user in Firebase Auth
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Save additional user data to Firestore
            await db.collection('users').doc(user.uid).set({
                name: name,
                email: email,
                phone: phone,
                role: userType,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                isActive: true,
                totalBookings: 0
            });
            
            logger.log('REGISTER_SUCCESS', { userId: user.uid, email: user.email });
            
            this.showMessage('Registration successful! Redirecting...', 'success');
            
            // Redirect based on role
            setTimeout(() => {
                if (userType === 'admin') {
                    window.location.href = 'admin-panel.html';
                } else {
                    window.location.href = 'userpanel.html';
                }
            }, 2000);
            
        } catch (error) {
            logger.error('REGISTER_ERROR', error);
            this.showMessage(error.message, 'error');
        }
    }

    setRole(e) {
        const role = e.target.dataset.role;
        // Store role preference (you could use localStorage or sessionStorage)
        sessionStorage.setItem('preferredRole', role);
        this.showMessage(`Set to ${role} login mode`, 'success');
    }

    async redirectBasedOnRole(userId) {
        try {
            const userDoc = await db.collection('users').doc(userId).get();
            const userData = userDoc.data();
            
            if (userData) {
                const currentPath = window.location.pathname;
                const isAuthPage = currentPath.includes('login.html') || 
                                   currentPath.includes('register.html');
                
                if (isAuthPage) {
                    if (userData.role === 'admin' && !currentPath.includes('admin-panel.html')) {
                        window.location.href = 'admin-panel.html';
                    } else if (userData.role === 'user' && !currentPath.includes('userpanel.html')) {
                        window.location.href = 'userpanel.html';
                    }
                }
            }
        } catch (error) {
            logger.error('ROLE_REDIRECT_ERROR', error);
        }
    }

    showMessage(message, type) {
        const messageDiv = document.getElementById('message');
        if (messageDiv) {
            messageDiv.textContent = message;
            messageDiv.className = `message ${type}`;
            
            setTimeout(() => {
                messageDiv.textContent = '';
                messageDiv.className = 'message';
            }, 5000);
        } else {
            alert(`${type.toUpperCase()}: ${message}`);
        }
    }

    async logout() {
        try {
            await auth.signOut();
            logger.log('LOGOUT_SUCCESS', { userId: auth.currentUser?.uid });
            window.location.href = 'login.html';
        } catch (error) {
            logger.error('LOGOUT_ERROR', error);
            this.showMessage(error.message, 'error');
        }
    }
}

// Initialize Auth Manager
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
    
    // Add logout functionality if needed
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => window.authManager.logout());
    }
});