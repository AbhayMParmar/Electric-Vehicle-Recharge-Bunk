// admin.js - Enhanced with responsive mobile menu
class AdminManager {
    constructor() {
        this.stations = [];
        this.bookings = [];
        this.users = [];
        this.reports = {
            today: 0,
            week: 0,
            month: 0
        };
        this.isMobileMenuOpen = false;
        this.db = null; // Add db reference
        this.init();
    }

    async init() {
        try {
            await this.initializeFirebase(); // Initialize Firebase first
            await this.checkAuth();
            this.setupEventListeners();
            this.updateCurrentDate();
            await this.loadDashboardData();
            this.setupRealTimeListeners();
            this.setupMobileMenu();
            console.log('Admin Manager initialized successfully');
        } catch (error) {
            console.error('Admin initialization error:', error);
            this.showNotification('Failed to initialize. Please refresh.', 'error');
        }
    }

    async initializeFirebase() {
        try {
            // Check if Firebase is already initialized
            if (!firebase.apps.length) {
                // Initialize Firebase with config
                firebase.initializeApp({
                    apiKey: "YOUR_API_KEY",
                    authDomain: "YOUR_AUTH_DOMAIN",
                    projectId: "YOUR_PROJECT_ID",
                    storageBucket: "YOUR_STORAGE_BUCKET",
                    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
                    appId: "YOUR_APP_ID"
                });
            }
            
            this.db = firebase.firestore();
            console.log('Firebase initialized successfully');
        } catch (error) {
            console.error('Firebase initialization error:', error);
            throw new Error('Failed to initialize Firebase');
        }
    }

    setupMobileMenu() {
        const sidebar = document.getElementById('sidebar');
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const menuToggle = document.getElementById('menuToggle');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        
        // Toggle mobile menu
        const toggleMenu = () => {
            this.isMobileMenuOpen = !this.isMobileMenuOpen;
            sidebar.classList.toggle('active', this.isMobileMenuOpen);
            sidebarOverlay.classList.toggle('active', this.isMobileMenuOpen);
            document.body.style.overflow = this.isMobileMenuOpen ? 'hidden' : '';
        };
        
        // Mobile menu button
        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', toggleMenu);
        }
        
        // Close menu button inside sidebar
        if (menuToggle) {
            menuToggle.addEventListener('click', toggleMenu);
        }
        
        // Close menu when clicking overlay
        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', toggleMenu);
        }
        
        // Close menu when clicking navigation links on mobile
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    toggleMenu();
                }
            });
        });
        
        // Handle window resize
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768 && this.isMobileMenuOpen) {
                toggleMenu();
            }
        });
    }

    async checkAuth() {
        // Simple session check
        const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
        const userEmail = sessionStorage.getItem('userEmail');
        
        if (!isAdmin || !userEmail) {
            console.log('Not authenticated, redirecting to login...');
            window.location.href = 'login.html';
            return;
        }

        // Update admin info
        const adminEmailElement = document.getElementById('adminEmail');
        const adminNameElement = document.getElementById('adminName');
        if (adminEmailElement) {
            adminEmailElement.textContent = userEmail;
        }
        if (adminNameElement) {
            // Extract name from email for display
            const name = userEmail.split('@')[0];
            adminNameElement.textContent = name.charAt(0).toUpperCase() + name.slice(1);
        }
    }

    updateCurrentDate() {
        const dateElement = document.getElementById('currentDate');
        if (dateElement) {
            const now = new Date();
            const options = { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            };
            dateElement.textContent = now.toLocaleDateString('en-US', options);
        }
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // Navigation links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => this.handleNavigation(e));
        });

        // Stats cards click events
        document.querySelectorAll('.stat-card').forEach(card => {
            card.addEventListener('click', (e) => this.handleStatCardClick(e));
        });

        // Add Station Form
        const addStationForm = document.getElementById('addStationForm');
        if (addStationForm) {
            console.log('Found addStationForm');
            addStationForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleAddStation(e);
            });
        } else {
            console.error('addStationForm not found!');
        }

        // Logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
    }

    handleStatCardClick(e) {
        const card = e.currentTarget;
        const targetSection = card.dataset.target;
        
        if (targetSection) {
            // Update navigation
            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === targetSection) {
                    link.classList.add('active');
                }
            });
            
            // Show target section
            this.showSection(targetSection.substring(1)); // Remove # from id
            
            // Update page title
            this.updatePageTitle(targetSection);
            
            console.log(`Navigated to ${targetSection} via stats card`);
        }
    }

    handleNavigation(e) {
        e.preventDefault();
        const targetId = e.currentTarget.getAttribute('href').substring(1);
        this.showSection(targetId);
        this.updatePageTitle('#' + targetId);
    }

    showSection(sectionId) {
        // Hide all sections
        document.querySelectorAll('section').forEach(section => {
            section.classList.add('hidden');
        });
        
        // Show target section
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.remove('hidden');
            
            // Scroll to top of section on mobile
            if (window.innerWidth <= 768) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
            
            // Load section-specific data if needed
            switch(sectionId) {
                case 'bookings':
                    this.loadBookingsData();
                    break;
                case 'users':
                    this.loadUsersData();
                    break;
                case 'reports':
                    this.loadReportsData();
                    break;
            }
        }
    }

    updatePageTitle(targetSection) {
        const pageTitle = document.getElementById('pageTitle');
        if (!pageTitle) return;
        
        const titles = {
            '#dashboard': 'Admin Dashboard',
            '#stations': 'Charging Stations',
            '#bookings': 'Bookings',
            '#users': 'Users',
            '#reports': 'Reports'
        };
        
        // Shorten titles for mobile
        if (window.innerWidth <= 576) {
            pageTitle.textContent = titles[targetSection]?.split(' ')[0] || 'Dashboard';
        } else {
            pageTitle.textContent = titles[targetSection] || 'Admin Dashboard';
        }
    }

    setupRealTimeListeners() {
        try {
            console.log('Setting up real-time listeners...');
            
            if (!this.db) {
                console.error('Firestore db not available');
                this.showNotification('Database connection failed', 'error');
                return;
            }

            // Listen for stations
            this.db.collection('stations').where('isActive', '==', true)
                .onSnapshot(async (snapshot) => {
                    console.log('Stations updated:', snapshot.size);
                    this.stations = [];
                    for (const doc of snapshot.docs) {
                        const station = { id: doc.id, ...doc.data() };
                        // Calculate available slots dynamically
                        station.availableSlots = await this.calculateAvailableSlots(doc.id);
                        this.stations.push(station);
                    }
                    this.updateStationsTable();
                    this.updateStats();
                }, (error) => {
                    console.error('Stations listener error:', error);
                });

            // Listen for bookings
            this.db.collection('bookings').where('status', '==', 'active')
                .onSnapshot((snapshot) => {
                    console.log('Bookings updated:', snapshot.size);
                    this.bookings = [];
                    snapshot.forEach(doc => {
                        this.bookings.push({ id: doc.id, ...doc.data() });
                    });
                    this.updateStats();
                    this.updateBookingsTable();
                });

            // Listen for users
            this.db.collection('users')
                .onSnapshot((snapshot) => {
                    console.log('Users updated:', snapshot.size);
                    this.users = [];
                    snapshot.forEach(doc => {
                        this.users.push({ id: doc.id, ...doc.data() });
                    });
                    this.updateStats();
                    this.updateUsersTable();
                });

        } catch (error) {
            console.error('Real-time listener setup error:', error);
        }
    }

    async calculateAvailableSlots(stationId) {
        try {
            // Get station document
            const stationDoc = await this.db.collection('stations').doc(stationId).get();
            if (!stationDoc.exists) return 0;
            
            const station = stationDoc.data();
            const totalSlots = station.totalSlots || 0;
            
            // Get current time
            const now = new Date();
            
            // Get all active bookings for this station
            const bookingsSnapshot = await this.db.collection('bookings')
                .where('stationId', '==', stationId)
                .where('status', 'in', ['pending', 'confirmed', 'active'])
                .get();
            
            let bookedSlots = 0;
            
            // Check each booking if it overlaps with current time
            bookingsSnapshot.forEach(doc => {
                const booking = doc.data();
                const startTime = booking.startTime?.toDate();
                const endTime = booking.endTime?.toDate();
                
                // If booking times exist and current time is within booking period
                if (startTime && endTime) {
                    if (now >= startTime && now <= endTime) {
                        bookedSlots++;
                    }
                }
            });
            
            // Calculate available slots
            const availableSlots = Math.max(0, totalSlots - bookedSlots);
            
            return availableSlots;
            
        } catch (error) {
            console.error('Error calculating available slots:', error);
            return 0;
        }
    }

    async handleAddStation(e) {
        console.log('handleAddStation called');
        
        if (!this.db) {
            this.showNotification('Database not connected', 'error');
            return;
        }
        
        try {
            // Get form values
            const formData = {
                name: this.getValue('stationName'),
                address: this.getValue('stationAddress'),
                city: this.getValue('stationCity'),
                state: this.getValue('stationState'),
                zip: this.getValue('stationZip'),
                contactNumber: this.getValue('contactNumber'),
                chargerType: this.getValue('chargerType'),
                totalSlots: this.getNumberValue('totalSlots'),
                pricePerHour: this.getNumberValue('pricePerHour'),
                description: this.getValue('stationDescription'),
                imageUrl: this.getValue('stationImage'),
                isActive: true,
                // Note: We don't store availableSlots here - it's calculated dynamically
                createdAt: new Date().toISOString(),
                createdBy: 'admin'
            };

            console.log('Form data:', formData);

            // Validation
            if (!this.validateForm(formData)) {
                return;
            }

            // Show loading
            const submitBtn = document.querySelector('#addStationForm button[type="submit"]');
            if (submitBtn) {
                const originalText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
                submitBtn.disabled = true;

                try {
                    // Save to Firestore
                    await this.db.collection('stations').add(formData);
                    
                    // Success
                    this.showNotification('Station added successfully! All slots are initially available.', 'success');
                    document.getElementById('addStationForm').reset();
                    
                } finally {
                    // Reset button
                    submitBtn.innerHTML = originalText;
                    submitBtn.disabled = false;
                }
            } else {
                console.error('Submit button not found');
                this.showNotification('Form error. Please refresh.', 'error');
            }
            
        } catch (error) {
            console.error('Error adding station:', error);
            this.showNotification('Failed to add station: ' + error.message, 'error');
        }
    }

    // Helper method to get form value
    getValue(elementId) {
        const element = document.getElementById(elementId);
        return element ? element.value.trim() : '';
    }

    // Helper method to get number value
    getNumberValue(elementId) {
        const value = this.getValue(elementId);
        return value ? parseFloat(value) : 0;
    }

    // Validation method
    validateForm(data) {
        // Check required fields
        const requiredFields = ['name', 'address', 'city', 'state', 'zip', 'contactNumber', 'chargerType'];
        for (const field of requiredFields) {
            if (!data[field]) {
                this.showNotification(`Please fill in the ${field.replace(/([A-Z])/g, ' $1').toLowerCase()} field`, 'error');
                return false;
            }
        }

        // Check numeric fields
        if (!data.totalSlots || data.totalSlots < 1 || data.totalSlots > 50) {
            this.showNotification('Total slots must be between 1-50', 'error');
            return false;
        }

        if (!data.pricePerHour || data.pricePerHour < 0) {
            this.showNotification('Price per hour must be a positive number', 'error');
            return false;
        }

        return true;
    }

    updateStationsTable() {
        const tbody = document.getElementById('stationsTableBody');
        if (!tbody) {
            console.error('stationsTableBody not found');
            return;
        }

        if (this.stations.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">
                        <div class="empty-state">
                            <i class="fas fa-charging-station"></i>
                            <h3>No Stations Found</h3>
                            <p class="text-muted">Add your first charging station above</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        this.stations.forEach(station => {
            const typeText = station.chargerType === 'fast' ? 'Fast (DC)' :
                           station.chargerType === 'normal' ? 'Normal (AC)' : 'Both';
            const createdDate = station.createdAt ? 
                new Date(station.createdAt).toLocaleDateString() : 'Recent';
            
            // Get available slots (calculated dynamically)
            const availableSlots = station.availableSlots || 0;
            const totalSlots = station.totalSlots || 0;
            
            // Determine status based on available slots
            let statusBadge = '';
            if (availableSlots === 0) {
                statusBadge = '<span class="badge badge-danger">Full</span>';
            } else if (availableSlots <= 2) {
                statusBadge = '<span class="badge badge-warning">Limited</span>';
            } else {
                statusBadge = '<span class="badge badge-success">Available</span>';
            }
            
            // Truncate description for mobile
            const description = station.description ? 
                (station.description.length > 50 ? station.description.substring(0, 50) + '...' : station.description) : '';
            
            html += `
                <tr>
                    <td>
                        <strong>${station.name || 'Unnamed'}</strong>
                        ${description ? `<br><small class="text-muted">${description}</small>` : ''}
                        <br><small class="text-muted">Added: ${createdDate}</small>
                    </td>
                    <td>
                        <div>${station.address || ''}</div>
                        <small class="text-muted">${station.city || ''}, ${station.state || ''}</small>
                    </td>
                    <td>
                        <strong>${availableSlots}/${totalSlots}</strong><br>
                        <small class="text-muted">Available/Total</small>
                    </td>
                    <td><span class="badge badge-info">${typeText}</span></td>
                    <td>${statusBadge}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-sm btn-edit" onclick="adminManager.editStation('${station.id}')">
                                <i class="fas fa-edit"></i> <span class="btn-text">Edit</span>
                            </button>
                            <button class="btn btn-sm btn-delete" onclick="adminManager.deleteStation('${station.id}')">
                                <i class="fas fa-trash"></i> <span class="btn-text">Delete</span>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    updateBookingsTable() {
        const tbody = document.getElementById('bookingsTableBody');
        if (!tbody) return;

        if (this.bookings.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">
                        <div class="empty-state">
                            <i class="fas fa-book"></i>
                            <h3>No Active Bookings</h3>
                            <p class="text-muted">All bookings will appear here</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        this.bookings.forEach((booking, index) => {
            const startTime = booking.startTime ? 
                new Date(booking.startTime).toLocaleString() : 'Not set';
            const amount = booking.totalAmount ? `$${parseFloat(booking.totalAmount).toFixed(2)}` : '$0.00';
            const userName = booking.userName ? 
                (booking.userName.length > 15 ? booking.userName.substring(0, 15) + '...' : booking.userName) : 'User';
            const stationName = booking.stationName ? 
                (booking.stationName.length > 15 ? booking.stationName.substring(0, 15) + '...' : booking.stationName) : 'Station';
            
            html += `
                <tr>
                    <td><strong>BK-${String(index + 1).padStart(4, '0')}</strong></td>
                    <td>${userName}</td>
                    <td>${stationName}</td>
                    <td><small>${startTime}</small></td>
                    <td>${booking.duration || 0}h</td>
                    <td><strong>${amount}</strong></td>
                    <td><span class="badge badge-success">Active</span></td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    updateUsersTable() {
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;

        if (this.users.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">
                        <div class="empty-state">
                            <i class="fas fa-users"></i>
                            <h3>No Users Found</h3>
                            <p class="text-muted">User data will appear here</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        this.users.forEach(user => {
            const joinedDate = user.createdAt ? 
                new Date(user.createdAt.seconds * 1000).toLocaleDateString() : 'Recent';
            const initials = user.name ? 
                user.name.split(' ').map(n => n[0]).join('').toUpperCase() : 
                user.email ? user.email[0].toUpperCase() : 'U';
            const userName = user.name ? 
                (user.name.length > 15 ? user.name.substring(0, 15) + '...' : user.name) : 'User';
            const userEmail = user.email ? 
                (user.email.length > 20 ? user.email.substring(0, 20) + '...' : user.email) : 'No email';
            
            html += `
                <tr>
                    <td>
                        <div class="user-info">
                            <div class="user-avatar">${initials}</div>
                            <div>
                                <strong>${userName}</strong><br>
                                <small class="text-muted">ID: ${user.id.substring(0, 6)}...</small>
                            </div>
                        </div>
                    </td>
                    <td>${userEmail}</td>
                    <td><small>${user.phone || '-'}</small></td>
                    <td><small>${joinedDate}</small></td>
                    <td><strong>${user.totalBookings || 0}</strong></td>
                    <td><span class="badge badge-success">Active</span></td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    updateStats() {
        // Update stations count
        const stationsEl = document.getElementById('totalStations');
        if (stationsEl) stationsEl.textContent = this.stations.length;

        // Update bookings count
        const bookingsEl = document.getElementById('activeBookings');
        if (bookingsEl) bookingsEl.textContent = this.bookings.length;

        // Update users count
        const usersEl = document.getElementById('totalUsers');
        if (usersEl) usersEl.textContent = this.users.length;

        // Calculate revenue
        const revenueEl = document.getElementById('totalRevenue');
        if (revenueEl) {
            const revenue = this.bookings.reduce((total, booking) => {
                return total + (parseFloat(booking.totalAmount) || 0);
            }, 0);
            revenueEl.textContent = `$${revenue.toFixed(2)}`;
        }
    }

    async loadBookingsData() {
        console.log('Loading bookings data...');
        // Data is already loaded via real-time listener
        this.updateBookingsTable();
    }

    async loadUsersData() {
        console.log('Loading users data...');
        // Data is already loaded via real-time listener
        this.updateUsersTable();
    }

    async loadReportsData() {
        console.log('Loading reports data...');
        
        try {
            // Calculate today's revenue
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayEnd = new Date(today);
            todayEnd.setHours(23, 59, 59, 999);
            
            const todayRevenue = this.bookings.reduce((total, booking) => {
                const bookingDate = booking.createdAt ? new Date(booking.createdAt) : new Date();
                if (bookingDate >= today && bookingDate <= todayEnd) {
                    return total + (parseFloat(booking.totalAmount) || 0);
                }
                return total;
            }, 0);
            
            // Calculate week revenue (last 7 days)
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            
            const weekRevenue = this.bookings.reduce((total, booking) => {
                const bookingDate = booking.createdAt ? new Date(booking.createdAt) : new Date();
                if (bookingDate >= weekAgo) {
                    return total + (parseFloat(booking.totalAmount) || 0);
                }
                return total;
            }, 0);
            
            // Calculate month revenue (last 30 days)
            const monthAgo = new Date();
            monthAgo.setDate(monthAgo.getDate() - 30);
            
            const monthRevenue = this.bookings.reduce((total, booking) => {
                const bookingDate = booking.createdAt ? new Date(booking.createdAt) : new Date();
                if (bookingDate >= monthAgo) {
                    return total + (parseFloat(booking.totalAmount) || 0);
                }
                return total;
            }, 0);
            
            // Update report cards
            const todayEl = document.getElementById('todayRevenue');
            const weekEl = document.getElementById('weekRevenue');
            const monthEl = document.getElementById('monthRevenue');
            
            if (todayEl) todayEl.textContent = `$${todayRevenue.toFixed(2)}`;
            if (weekEl) weekEl.textContent = `$${weekRevenue.toFixed(2)}`;
            if (monthEl) monthEl.textContent = `$${monthRevenue.toFixed(2)}`;
            
            // Update transactions table
            this.updateTransactionsTable();
            
        } catch (error) {
            console.error('Error loading reports:', error);
        }
    }

    updateTransactionsTable() {
        const tbody = document.getElementById('transactionsTableBody');
        if (!tbody) return;

        if (this.bookings.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center">
                        <div class="empty-state">
                            <i class="fas fa-receipt"></i>
                            <h3>No Transactions</h3>
                            <p class="text-muted">Transaction history will appear here</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        // Show recent bookings as transactions
        const recentBookings = this.bookings.slice(0, 10); // Last 10 bookings
        let html = '';
        
        recentBookings.forEach((booking, index) => {
            const bookingDate = booking.createdAt ? 
                new Date(booking.createdAt).toLocaleDateString() : 'Today';
            const amount = booking.totalAmount ? `$${parseFloat(booking.totalAmount).toFixed(2)}` : '$0.00';
            const status = booking.status === 'active' ? 'Completed' : 'Pending';
            const userName = booking.userName ? 
                (booking.userName.length > 12 ? booking.userName.substring(0, 12) + '...' : booking.userName) : 'User';
            
            html += `
                <tr>
                    <td><strong>TXN-${String(index + 1).padStart(4, '0')}</strong></td>
                    <td><small>${bookingDate}</small></td>
                    <td>${userName}</td>
                    <td><strong>${amount}</strong></td>
                    <td><span class="badge ${status === 'Completed' ? 'badge-success' : 'badge-warning'}">${status}</span></td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    editStation(stationId) {
        console.log('Editing station:', stationId);
        const station = this.stations.find(s => s.id === stationId);
        if (!station) {
            this.showNotification('Station not found', 'error');
            return;
        }

        // Navigate to dashboard section
        this.showSection('dashboard');
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === '#dashboard') {
                link.classList.add('active');
            }
        });

        // Fill form with station data
        this.setValue('stationName', station.name);
        this.setValue('stationAddress', station.address);
        this.setValue('stationCity', station.city);
        this.setValue('stationState', station.state);
        this.setValue('stationZip', station.zip);
        this.setValue('contactNumber', station.contactNumber);
        this.setValue('chargerType', station.chargerType);
        this.setValue('totalSlots', station.totalSlots);
        this.setValue('pricePerHour', station.pricePerHour);
        this.setValue('stationDescription', station.description);
        this.setValue('stationImage', station.imageUrl);

        // Change form to update mode
        const form = document.getElementById('addStationForm');
        if (form) {
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Station';
                submitBtn.dataset.editingId = stationId;
                
                // Remove old listener
                const newForm = form.cloneNode(true);
                form.parentNode.replaceChild(newForm, form);
                
                // Add update listener to new form
                newForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.handleUpdateStation(e, stationId);
                });
                
                // Scroll to form
                newForm.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }

    // Helper to set form value
    setValue(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.value = value || '';
        }
    }

    async handleUpdateStation(e, stationId) {
        console.log('Updating station:', stationId);
        
        if (!this.db) {
            this.showNotification('Database not connected', 'error');
            return;
        }
        
        try {
            // Get updated data
            const updatedData = {
                name: this.getValue('stationName'),
                address: this.getValue('stationAddress'),
                city: this.getValue('stationCity'),
                state: this.getValue('stationState'),
                zip: this.getValue('stationZip'),
                contactNumber: this.getValue('contactNumber'),
                chargerType: this.getValue('chargerType'),
                totalSlots: this.getNumberValue('totalSlots'),
                pricePerHour: this.getNumberValue('pricePerHour'),
                description: this.getValue('stationDescription'),
                imageUrl: this.getValue('stationImage'),
                updatedAt: new Date().toISOString()
            };

            console.log('Update data:', updatedData);

            // Validation
            if (!this.validateForm(updatedData)) {
                return;
            }

            // Show loading
            const submitBtn = document.querySelector('#addStationForm button[type="submit"]');
            if (submitBtn) {
                const originalText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
                submitBtn.disabled = true;

                try {
                    // Update in Firestore
                    await this.db.collection('stations').doc(stationId).update(updatedData);
                    
                    this.showNotification('Station updated successfully!', 'success');
                    
                    // Reset form to add mode
                    document.getElementById('addStationForm').reset();
                    
                    // Restore button
                    submitBtn.innerHTML = '<i class="fas fa-plus"></i> Add Station';
                    submitBtn.disabled = false;
                    delete submitBtn.dataset.editingId;
                    
                    // Restore original listener
                    const form = document.getElementById('addStationForm');
                    if (form) {
                        const newForm = form.cloneNode(true);
                        form.parentNode.replaceChild(newForm, form);
                        newForm.addEventListener('submit', (e) => {
                            e.preventDefault();
                            this.handleAddStation(e);
                        });
                    }
                    
                } finally {
                    if (submitBtn.disabled) {
                        submitBtn.disabled = false;
                    }
                }
            }
            
        } catch (error) {
            console.error('Update error:', error);
            this.showNotification('Failed to update: ' + error.message, 'error');
        }
    }

    async deleteStation(stationId) {
        if (!confirm('Are you sure? This will mark the station as inactive.')) {
            return;
        }

        if (!this.db) {
            this.showNotification('Database not connected', 'error');
            return;
        }

        try {
            // Soft delete
            await this.db.collection('stations').doc(stationId).update({
                isActive: false,
                deletedAt: new Date().toISOString()
            });
            
            this.showNotification('Station deleted successfully!', 'success');
            
        } catch (error) {
            console.error('Delete error:', error);
            this.showNotification('Delete failed: ' + error.message, 'error');
        }
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        document.querySelectorAll('.notification-toast').forEach(toast => toast.remove());
        
        // Create notification
        const notification = document.createElement('div');
        notification.className = `notification-toast ${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()" style="background:none;border:none;color:white;cursor:pointer;margin-left:10px;">✕</button>
        `;
        
        document.body.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    async loadDashboardData() {
        try {
            console.log('Loading dashboard data...');
            
            if (!this.db) {
                console.error('Firestore not available');
                this.showNotification('Database connection failed', 'error');
                return;
            }

            // Load initial data
            const [stationsSnapshot, bookingsSnapshot, usersSnapshot] = await Promise.all([
                this.db.collection('stations').where('isActive', '==', true).get(),
                this.db.collection('bookings').where('status', '==', 'active').get(),
                this.db.collection('users').get()
            ]);

            this.stations = [];
            for (const doc of stationsSnapshot.docs) {
                const station = { id: doc.id, ...doc.data() };
                // Calculate available slots dynamically
                station.availableSlots = await this.calculateAvailableSlots(doc.id);
                this.stations.push(station);
            }

            this.bookings = [];
            bookingsSnapshot.forEach(doc => {
                this.bookings.push({ id: doc.id, ...doc.data() });
            });

            this.users = [];
            usersSnapshot.forEach(doc => {
                this.users.push({ id: doc.id, ...doc.data() });
            });

            console.log(`Loaded: ${this.stations.length} stations, ${this.bookings.length} bookings, ${this.users.length} users`);

            this.updateStationsTable();
            this.updateStats();
            
        } catch (error) {
            console.error('Data load error:', error);
            this.showNotification('Failed to load data: ' + error.message, 'error');
        }
    }

    logout() {
        sessionStorage.clear();
        window.location.href = 'login.html';
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing AdminManager...');
    window.adminManager = new AdminManager();
});
