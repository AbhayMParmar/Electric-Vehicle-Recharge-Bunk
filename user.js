// user.js - User Manager Class
class UserManager {
    constructor() {
        this.currentUser = null;
        this.stations = [];
        this.userBookings = [];
        this.userLocation = null;
        this.map = null;
        this.markers = [];
        this.realTimeListeners = [];
        
        this.init();
    }

    async init() {
        await this.checkUserAuth();
        this.loadUserData();
        this.setupEventListeners();
        this.setupRealTimeListeners();
        this.initializeMap();
    }

    async checkUserAuth() {
        return new Promise((resolve, reject) => {
            firebase.auth().onAuthStateChanged(async (user) => {
                if (user) {
                    try {
                        const db = firebase.firestore();
                        const userDoc = await db.collection('users').doc(user.uid).get();
                        const userData = userDoc.data();
                        
                        if (userData && userData.role === 'user') {
                            this.currentUser = { ...user, ...userData };
                            this.updateUserProfile();
                            resolve();
                        } else {
                            window.location.href = 'login.html';
                        }
                    } catch (error) {
                        console.error('USER_AUTH_CHECK_ERROR', error);
                        window.location.href = 'login.html';
                    }
                } else {
                    window.location.href = 'login.html';
                }
            });
        });
    }

    updateUserProfile() {
        if (this.currentUser) {
            const userName = document.getElementById('userName');
            const userEmail = document.getElementById('userEmail');
            const userBalance = document.getElementById('userBalance');
            
            if (userName) userName.textContent = this.currentUser.name;
            if (userEmail) userEmail.textContent = this.currentUser.email;
            if (userBalance) userBalance.textContent = `$${(this.currentUser.balance || 0).toFixed(2)}`;
        }
    }

    async loadUserData() {
        try {
            const db = firebase.firestore();
            
            // Load user's bookings
            const bookingsSnapshot = await db.collection('bookings')
                .where('userId', '==', this.currentUser.uid)
                .orderBy('createdAt', 'desc')
                .limit(10)
                .get();
            
            this.userBookings = [];
            bookingsSnapshot.forEach(doc => {
                this.userBookings.push({ id: doc.id, ...doc.data() });
            });
            
            this.updateBookingsList();
            
            // Load nearby stations
            await this.loadNearbyStations();
            
            console.log('USER_DATA_LOADED', {
                userId: this.currentUser.uid,
                bookings: this.userBookings.length
            });
            
        } catch (error) {
            console.error('USER_DATA_LOAD_ERROR', error);
            this.showNotification('Failed to load user data', 'error');
        }
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.user-nav a').forEach(link => {
            link.addEventListener('click', (e) => this.handleNavigation(e));
        });

        // Search functionality
        const searchInput = document.getElementById('searchLocation');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.searchStations(e.target.value));
        }

        // Location button
        const locateBtn = document.getElementById('locateUser');
        if (locateBtn) {
            locateBtn.addEventListener('click', () => this.getUserLocation());
        }

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.filterStations(e.target.dataset.filter));
        });

        // Logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
    }

    setupRealTimeListeners() {
        const db = firebase.firestore();
        
        // Listen for station updates
        const stationsListener = db.collection('stations')
            .where('isActive', '==', true)
            .onSnapshot((snapshot) => {
                snapshot.forEach(async (doc) => {
                    const station = { id: doc.id, ...doc.data() };
                    // Calculate available slots for each station
                    station.availableSlots = await this.calculateAvailableSlots(station.id);
                    
                    // Update or add station
                    const index = this.stations.findIndex(s => s.id === station.id);
                    if (index !== -1) {
                        this.stations[index] = station;
                    } else {
                        this.stations.push(station);
                    }
                });
                
                this.updateStationsList();
                this.updateMapMarkers();
            });

        this.realTimeListeners.push(stationsListener);

        // Listen for user's booking updates
        const bookingsListener = db.collection('bookings')
            .where('userId', '==', this.currentUser.uid)
            .onSnapshot((snapshot) => {
                this.userBookings = [];
                snapshot.forEach(doc => {
                    this.userBookings.push({ id: doc.id, ...doc.data() });
                });
                this.updateBookingsList();
            });

        this.realTimeListeners.push(bookingsListener);
    }

    handleNavigation(e) {
        e.preventDefault();
        const targetId = e.target.getAttribute('href').substring(1);
        
        // Update active nav link
        document.querySelectorAll('.user-nav a').forEach(link => {
            link.classList.remove('active');
        });
        e.target.classList.add('active');
        
        // Show corresponding section
        document.querySelectorAll('.dashboard-section, .bookings-section, .profile-section').forEach(section => {
            section.classList.add('hidden');
        });
        
        const targetSection = document.getElementById(targetId);
        if (targetSection) {
            targetSection.classList.remove('hidden');
        }
    }

    initializeMap() {
        // Default center (New York)
        const defaultCenter = { lat: 40.7128, lng: -74.0060 };
        
        this.map = new google.maps.Map(document.getElementById('map'), {
            center: defaultCenter,
            zoom: 12,
            styles: [
                {
                    featureType: "poi",
                    elementType: "labels",
                    stylers: [{ visibility: "off" }]
                }
            ]
        });

        // Try to get user location
        this.getUserLocation();
    }

    getUserLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.userLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    
                    // Center map on user location
                    this.map.setCenter(this.userLocation);
                    this.map.setZoom(14);
                    
                    // Add user marker
                    new google.maps.Marker({
                        position: this.userLocation,
                        map: this.map,
                        icon: {
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 10,
                            fillColor: "#4285F4",
                            fillOpacity: 1,
                            strokeWeight: 2,
                            strokeColor: "#FFFFFF"
                        },
                        title: "Your Location"
                    });
                    
                    // Load nearby stations
                    this.loadNearbyStations();
                    
                },
                (error) => {
                    console.error("Error getting location:", error);
                    this.showNotification("Unable to get your location", "error");
                }
            );
        }
    }

    async loadNearbyStations() {
        try {
            const db = firebase.firestore();
            const stationsSnapshot = await db.collection('stations')
                .where('isActive', '==', true)
                .get();
            
            this.stations = [];
            stationsSnapshot.forEach(doc => {
                this.stations.push({ id: doc.id, ...doc.data() });
            });
            
            // Calculate available slots for all stations
            for (let station of this.stations) {
                station.availableSlots = await this.calculateAvailableSlots(station.id);
            }
            
            this.updateStationsList();
            this.updateMapMarkers();
            
        } catch (error) {
            console.error('LOAD_STATIONS_ERROR', error);
            this.showNotification('Failed to load stations', 'error');
        }
    }

    async calculateAvailableSlots(stationId) {
        try {
            const db = firebase.firestore();
            
            // Get station data
            const stationDoc = await db.collection('stations').doc(stationId).get();
            if (!stationDoc.exists) return 0;
            
            const station = stationDoc.data();
            const totalSlots = station.totalSlots || 0;
            
            // Get current time
            const now = new Date();
            
            // Get all bookings for this station
            const bookingsSnapshot = await db.collection('bookings')
                .where('stationId', '==', stationId)
                .where('status', 'in', ['confirmed', 'active'])
                .get();
            
            // Count active bookings at current time
            let activeBookingsCount = 0;
            
            bookingsSnapshot.forEach(doc => {
                const booking = doc.data();
                
                // Check if booking is active now
                if (booking.startTime && booking.endTime) {
                    const startTime = booking.startTime.toDate();
                    const endTime = booking.endTime.toDate();
                    
                    // If current time is within booking timeframe, count it as active
                    if (now >= startTime && now <= endTime) {
                        activeBookingsCount++;
                    }
                }
            });
            
            // Calculate available slots
            const availableSlots = Math.max(0, totalSlots - activeBookingsCount);
            return availableSlots;
            
        } catch (error) {
            console.error('Error calculating available slots:', error);
            // Return default value if calculation fails
            return 3; // Default slots for demo
        }
    }

    async checkTimeSlotAvailability(stationId, startTime, endTime) {
        try {
            const db = firebase.firestore();
            
            // Get station data
            const stationDoc = await db.collection('stations').doc(stationId).get();
            if (!stationDoc.exists) return false;
            
            const station = stationDoc.data();
            const totalSlots = station.totalSlots || 0;
            
            // Get all bookings for this station that overlap with requested time
            const bookingsSnapshot = await db.collection('bookings')
                .where('stationId', '==', stationId)
                .where('status', 'in', ['pending', 'confirmed', 'active'])
                .get();
            
            // Count bookings that overlap with requested time
            let overlappingBookingsCount = 0;
            
            bookingsSnapshot.forEach(doc => {
                const booking = doc.data();
                
                if (booking.startTime && booking.endTime) {
                    const bookingStart = booking.startTime.toDate();
                    const bookingEnd = booking.endTime.toDate();
                    
                    // Check if time ranges overlap
                    const timeOverlaps = (startTime < bookingEnd && endTime > bookingStart);
                    
                    if (timeOverlaps) {
                        overlappingBookingsCount++;
                    }
                }
            });
            
            // Check if there's at least one slot available
            return overlappingBookingsCount < totalSlots;
            
        } catch (error) {
            console.error('Error checking time slot availability:', error);
            return false;
        }
    }

    updateMapMarkers() {
        // Clear existing markers
        this.markers.forEach(marker => marker.setMap(null));
        this.markers = [];
        
        // Add new markers
        this.stations.forEach(station => {
            if (station.coordinates) {
                const marker = new google.maps.Marker({
                    position: {
                        lat: station.coordinates.latitude,
                        lng: station.coordinates.longitude
                    },
                    map: this.map,
                    title: station.name,
                    icon: this.getMarkerIcon(station)
                });
                
                // Add info window
                const infoWindow = new google.maps.InfoWindow({
                    content: this.getStationInfoWindowContent(station)
                });
                
                marker.addListener('click', () => {
                    infoWindow.open(this.map, marker);
                });
                
                this.markers.push(marker);
            }
        });
    }

    getMarkerIcon(station) {
        const availableSlots = station.availableSlots || 0;
        let fillColor = "#e53e3e"; // Red for no slots
        
        if (availableSlots > 3) {
            fillColor = "#00a884"; // Green for many slots
        } else if (availableSlots > 0) {
            fillColor = "#d69e2e"; // Yellow for few slots
        }
        
        if (station.chargerType === 'fast') {
            fillColor = "#3182ce"; // Blue for fast chargers
        }
        
        return {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: fillColor,
            fillOpacity: 0.8,
            strokeWeight: 2,
            strokeColor: "#FFFFFF",
            scale: 15
        };
    }

    getStationInfoWindowContent(station) {
        const availableSlots = station.availableSlots || 0;
        const totalSlots = station.totalSlots || 0;
        
        return `
            <div class="info-window">
                <h3>${station.name}</h3>
                <p>${station.address}</p>
                <p>${station.city}, ${station.state} ${station.zip}</p>
                <hr>
                <p><strong>Available Slots:</strong> ${availableSlots}/${totalSlots}</p>
                <p><strong>Charger Type:</strong> ${station.chargerType}</p>
                <p><strong>Price:</strong> $${station.pricePerHour || 0}/hour</p>
                <p><strong>Contact:</strong> ${station.contactNumber || 'N/A'}</p>
                <button onclick="userManager.bookStation('${station.id}')" 
                        class="book-btn" 
                        ${availableSlots > 0 ? '' : 'disabled'}>
                    ${availableSlots > 0 ? 'Book Now' : 'No Slots Available'}
                </button>
            </div>
        `;
    }

    updateStationsList() {
        const stationsList = document.getElementById('stationsList');
        if (!stationsList) return;

        stationsList.innerHTML = '';
        
        if (this.stations.length === 0) {
            stationsList.innerHTML = '<p class="no-stations">No stations available.</p>';
            return;
        }
        
        this.stations.forEach(station => {
            const stationCard = document.createElement('div');
            stationCard.className = 'station-card';
            
            const availableSlots = station.availableSlots || 0;
            const totalSlots = station.totalSlots || 0;
            
            let badgeClass = 'unavailable';
            let badgeText = 'Full';
            
            if (availableSlots > 0) {
                badgeClass = 'available';
                badgeText = `${availableSlots} slots available`;
            }
            
            stationCard.innerHTML = `
                <div class="station-header">
                    <h3>${station.name}</h3>
                    <span class="availability-badge ${badgeClass}">${badgeText}</span>
                </div>
                
                <div class="station-info">
                    <p><i class="fas fa-map-marker-alt"></i> ${station.address}, ${station.city}</p>
                    <p><i class="fas fa-phone"></i> ${station.contactNumber || 'N/A'}</p>
                    <p><i class="fas fa-bolt"></i> ${station.chargerType} Charging</p>
                    <p><i class="fas fa-car"></i> ${availableSlots}/${totalSlots} slots</p>
                    <p><i class="fas fa-money-bill-wave"></i> $${station.pricePerHour || 0}/hour</p>
                </div>
                
                <div class="station-actions">
                    <button class="btn-primary" onclick="userManager.viewStationDetails('${station.id}')">
                        <i class="fas fa-info-circle"></i> Details
                    </button>
                    <button class="btn-secondary" onclick="userManager.bookStation('${station.id}')" 
                            ${availableSlots > 0 ? '' : 'disabled'}>
                        <i class="fas fa-calendar-check"></i> Book Slot
                    </button>
                </div>
            `;
            
            stationsList.appendChild(stationCard);
        });
    }

    updateBookingsList() {
        const bookingsList = document.getElementById('bookingsList');
        if (!bookingsList) return;

        bookingsList.innerHTML = '';
        
        if (this.userBookings.length === 0) {
            bookingsList.innerHTML = '<p class="no-bookings">No bookings found.</p>';
            return;
        }

        this.userBookings.forEach(booking => {
            const bookingCard = document.createElement('div');
            bookingCard.className = 'booking-card';
            
            const startTime = booking.startTime ? 
                new Date(booking.startTime.seconds * 1000).toLocaleString() : 'Not set';
            const endTime = booking.endTime ? 
                new Date(booking.endTime.seconds * 1000).toLocaleString() : 'Not set';
            
            bookingCard.innerHTML = `
                <div class="booking-header">
                    <h3>Booking #${booking.id.substring(0, 8)}</h3>
                    <span class="status-badge ${booking.status}">${booking.status}</span>
                </div>
                
                <div class="booking-info">
                    <p><i class="fas fa-charging-station"></i> ${booking.stationName || 'Unknown Station'}</p>
                    <p><i class="fas fa-clock"></i> Start: ${startTime}</p>
                    <p><i class="fas fa-clock"></i> End: ${endTime}</p>
                    <p><i class="fas fa-money-bill-wave"></i> Total: $${booking.totalAmount || 0}</p>
                </div>
                
                <div class="booking-actions">
                    ${booking.status === 'active' ? `
                        <button class="btn-warning" onclick="userManager.cancelBooking('${booking.id}')">
                            <i class="fas fa-times"></i> Cancel
                        </button>
                    ` : ''}
                    ${booking.status === 'pending' ? `
                        <button class="btn-success" onclick="userManager.confirmBooking('${booking.id}')">
                            <i class="fas fa-check"></i> Confirm Payment
                        </button>
                    ` : ''}
                </div>
            `;
            
            bookingsList.appendChild(bookingCard);
        });
    }

    async viewStationDetails(stationId) {
        try {
            const db = firebase.firestore();
            const stationDoc = await db.collection('stations').doc(stationId).get();
            const station = stationDoc.data();
            
            if (!station) {
                this.showNotification('Station not found', 'error');
                return;
            }

            // Calculate available slots
            station.availableSlots = await this.calculateAvailableSlots(stationId);

            // Show station details in a modal
            const modal = this.createStationModal(station);
            document.body.appendChild(modal);
            
        } catch (error) {
            console.error('VIEW_STATION_DETAILS_ERROR', error);
            this.showNotification('Failed to load station details', 'error');
        }
    }

    createStationModal(station) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${station.name}</h2>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="modal-section">
                        <h3><i class="fas fa-map-marker-alt"></i> Location</h3>
                        <p>${station.address}</p>
                        <p>${station.city}, ${station.state} ${station.zip}</p>
                    </div>
                    
                    <div class="modal-section">
                        <h3><i class="fas fa-info-circle"></i> Information</h3>
                        <div class="info-grid">
                            <div class="info-item">
                                <i class="fas fa-bolt"></i>
                                <span>Charger Type: ${station.chargerType}</span>
                            </div>
                            <div class="info-item">
                                <i class="fas fa-car"></i>
                                <span>Available Slots: ${station.availableSlots || 0}/${station.totalSlots || 0}</span>
                            </div>
                            <div class="info-item">
                                <i class="fas fa-money-bill-wave"></i>
                                <span>Price: $${station.pricePerHour}/hour</span>
                            </div>
                            <div class="info-item">
                                <i class="fas fa-phone"></i>
                                <span>Contact: ${station.contactNumber || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                    
                    ${station.description ? `
                    <div class="modal-section">
                        <h3><i class="fas fa-file-alt"></i> Description</h3>
                        <p>${station.description}</p>
                    </div>
                    ` : ''}
                    
                    ${station.imageUrl ? `
                    <div class="modal-section">
                        <h3><i class="fas fa-image"></i> Photos</h3>
                        <img src="${station.imageUrl}" alt="${station.name}" style="max-width: 100%; border-radius: 8px;">
                    </div>
                    ` : ''}
                </div>
                <div class="modal-footer">
                    <button class="btn-primary" onclick="userManager.bookStation('${station.id}')" 
                            ${station.availableSlots > 0 ? '' : 'disabled'}>
                        <i class="fas fa-calendar-check"></i> Book Now
                    </button>
                    <button class="btn-secondary close-modal">Close</button>
                </div>
            </div>
        `;
        
        // Add close functionality
        modal.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => modal.remove());
        });
        
        return modal;
    }

    async bookStation(stationId) {
        try {
            const db = firebase.firestore();
            const stationDoc = await db.collection('stations').doc(stationId).get();
            let station = stationDoc.data();
            
            if (!station) {
                this.showNotification('Station not found', 'error');
                return;
            }

            // Calculate current available slots
            station.availableSlots = await this.calculateAvailableSlots(stationId);
            
            if (station.availableSlots <= 0) {
                this.showNotification('No slots available at this station', 'error');
                return;
            }

            // Show booking form
            this.showBookingForm(station);
            
        } catch (error) {
            console.error('BOOK_STATION_ERROR', error);
            this.showNotification('Failed to book station', 'error');
        }
    }

    showBookingForm(station) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Book Charging Slot</h2>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="booking-summary">
                        <h3>${station.name}</h3>
                        <p>${station.address}, ${station.city}</p>
                        <p>Available Slots: <strong>${station.availableSlots}</strong></p>
                        <p>Price: <strong>$${station.pricePerHour || 0}/hour</strong></p>
                    </div>
                    
                    <form id="bookingForm">
                        <div class="form-group">
                            <label for="bookingDate">Date *</label>
                            <input type="date" id="bookingDate" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="startTime">Start Time *</label>
                            <input type="time" id="startTime" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="duration">Duration (hours) *</label>
                            <select id="duration" required>
                                <option value="1">1 hour</option>
                                <option value="2" selected>2 hours</option>
                                <option value="3">3 hours</option>
                                <option value="4">4 hours</option>
                                <option value="5">5 hours</option>
                                <option value="6">6 hours</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="vehicleType">Vehicle Type *</label>
                            <input type="text" id="vehicleType" required placeholder="e.g., Tesla Model 3">
                        </div>
                        
                        <div class="form-group">
                            <label for="licensePlate">License Plate</label>
                            <input type="text" id="licensePlate" placeholder="Optional">
                        </div>
                        
                        <div class="price-summary">
                            <h4>Price Summary</h4>
                            <p>Duration: <span id="durationDisplay">2</span> hours</p>
                            <p>Total: $<span id="totalPrice">${(station.pricePerHour || 0) * 2}</span></p>
                        </div>
                        
                        <div id="slotStatus" class="slot-status" style="display: none;">
                            <i class="fas fa-spinner fa-spin"></i>
                            <span>Checking slot availability...</span>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn-primary" id="checkAvailabilityBtn" onclick="userManager.checkBookingAvailability('${station.id}')">
                        <i class="fas fa-search"></i> Check Availability
                    </button>
                    <button class="btn-secondary close-modal">Cancel</button>
                </div>
            </div>
        `;
        
        // Add close functionality
        modal.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => modal.remove());
        });
        
        // Update price when duration changes
        const durationSelect = modal.querySelector('#duration');
        const durationDisplay = modal.querySelector('#durationDisplay');
        const totalPrice = modal.querySelector('#totalPrice');
        
        durationSelect.addEventListener('change', (e) => {
            const duration = parseInt(e.target.value);
            const total = duration * station.pricePerHour;
            
            durationDisplay.textContent = duration;
            totalPrice.textContent = total.toFixed(2);
        });
        
        // Set default date to today
        const today = new Date().toISOString().split('T')[0];
        modal.querySelector('#bookingDate').value = today;
        
        // Set default time to next hour
        const nextHour = new Date();
        nextHour.setHours(nextHour.getHours() + 1);
        nextHour.setMinutes(0, 0, 0);
        const timeString = nextHour.toTimeString().slice(0, 5);
        modal.querySelector('#startTime').value = timeString;
        
        document.body.appendChild(modal);
    }

    async checkBookingAvailability(stationId) {
        try {
            const checkBtn = document.getElementById('checkAvailabilityBtn');
            const slotStatus = document.getElementById('slotStatus');
            
            if (checkBtn) checkBtn.disabled = true;
            if (slotStatus) {
                slotStatus.style.display = 'block';
                slotStatus.className = 'slot-status';
                slotStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking slot availability...';
            }
            
            const date = document.getElementById('bookingDate').value;
            const startTime = document.getElementById('startTime').value;
            const duration = parseInt(document.getElementById('duration').value);
            const vehicleType = document.getElementById('vehicleType').value;
            
            if (!date || !startTime || !duration || !vehicleType) {
                this.showNotification('Please fill all required fields', 'error');
                if (checkBtn) checkBtn.disabled = false;
                if (slotStatus) slotStatus.style.display = 'none';
                return;
            }

            // Calculate times
            const startDateTime = new Date(`${date}T${startTime}`);
            const endDateTime = new Date(startDateTime.getTime() + (duration * 60 * 60 * 1000));
            
            // Check if booking is in the future
            if (startDateTime < new Date()) {
                this.showNotification('Booking time must be in the future', 'error');
                if (checkBtn) checkBtn.disabled = false;
                if (slotStatus) {
                    slotStatus.className = 'slot-status unavailable';
                    slotStatus.innerHTML = '<i class="fas fa-times-circle"></i> Booking time must be in the future';
                }
                return;
            }

            // Check time slot availability
            const isSlotAvailable = await this.checkTimeSlotAvailability(stationId, startDateTime, endDateTime);
            
            if (slotStatus) {
                if (isSlotAvailable) {
                    slotStatus.className = 'slot-status available';
                    slotStatus.innerHTML = '<i class="fas fa-check-circle"></i> Slots available! You can proceed with booking.';
                    
                    // Replace the check button with confirm booking button
                    if (checkBtn) {
                        checkBtn.textContent = 'Confirm Booking';
                        checkBtn.onclick = () => this.submitBooking(stationId);
                    }
                } else {
                    slotStatus.className = 'slot-status unavailable';
                    slotStatus.innerHTML = '<i class="fas fa-times-circle"></i> No slots available for the selected time period';
                    
                    if (checkBtn) checkBtn.disabled = false;
                }
            }
            
        } catch (error) {
            console.error('Error checking booking availability:', error);
            const slotStatus = document.getElementById('slotStatus');
            if (slotStatus) {
                slotStatus.className = 'slot-status unavailable';
                slotStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error checking availability';
            }
            
            const checkBtn = document.getElementById('checkAvailabilityBtn');
            if (checkBtn) checkBtn.disabled = false;
        }
    }

    async submitBooking(stationId) {
        try {
            const db = firebase.firestore();
            
            // Get station data
            const stationDoc = await db.collection('stations').doc(stationId).get();
            const station = stationDoc.data();
            
            if (!station) {
                this.showNotification('Station not found', 'error');
                return;
            }

            const bookingDate = document.getElementById('bookingDate').value;
            const startTime = document.getElementById('startTime').value;
            const duration = parseInt(document.getElementById('duration').value);
            const vehicleType = document.getElementById('vehicleType').value;
            const licensePlate = document.getElementById('licensePlate').value;

            if (!bookingDate || !startTime || !vehicleType) {
                this.showNotification('Please fill all required fields', 'error');
                return;
            }

            // Calculate times
            const startDateTime = new Date(`${bookingDate}T${startTime}`);
            const endDateTime = new Date(startDateTime.getTime() + (duration * 60 * 60 * 1000));
            
            // Check if booking is in the future
            if (startDateTime < new Date()) {
                this.showNotification('Booking time must be in the future', 'error');
                return;
            }

            // Check time slot availability one more time
            const isSlotAvailable = await this.checkTimeSlotAvailability(stationId, startDateTime, endDateTime);
            if (!isSlotAvailable) {
                this.showNotification('No slots available at the selected time. Please choose a different time.', 'error');
                return;
            }

            const totalAmount = duration * station.pricePerHour;
            
            // Check user balance
            if (this.currentUser.balance < totalAmount) {
                this.showNotification('Insufficient balance. Please add funds to your wallet.', 'error');
                return;
            }

            const bookingData = {
                stationId: stationId,
                stationName: station.name,
                userId: this.currentUser.uid,
                userName: this.currentUser.name,
                userEmail: this.currentUser.email,
                startTime: firebase.firestore.Timestamp.fromDate(startDateTime),
                endTime: firebase.firestore.Timestamp.fromDate(endDateTime),
                duration: duration,
                vehicleType: vehicleType,
                licensePlate: licensePlate,
                totalAmount: totalAmount,
                status: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                paymentStatus: 'pending'
            };

            console.log('CREATE_BOOKING_ATTEMPT', {
                stationId,
                userId: this.currentUser.uid,
                bookingData
            });

            // Start a batch write for atomic operations
            const batch = db.batch();
            
            // Create booking document
            const bookingRef = db.collection('bookings').doc();
            batch.set(bookingRef, bookingData);
            
            // Deduct amount from user balance
            const userRef = db.collection('users').doc(this.currentUser.uid);
            const newBalance = this.currentUser.balance - totalAmount;
            batch.update(userRef, { balance: newBalance });
            
            // Commit the batch
            await batch.commit();
            
            // Update local user balance
            this.currentUser.balance = newBalance;
            this.updateUserProfile();

            console.log('CREATE_BOOKING_SUCCESS', {
                bookingId: bookingRef.id,
                stationId
            });

            this.showNotification('Booking created successfully! Please confirm payment.', 'success');
            
            // Close modal
            const modal = document.querySelector('.modal');
            if (modal) modal.remove();
            
            // Reload stations to update available slots
            await this.loadNearbyStations();
            
        } catch (error) {
            console.error('CREATE_BOOKING_ERROR', error);
            this.showNotification('Failed to create booking', 'error');
        }
    }

    async cancelBooking(bookingId) {
        if (!confirm('Are you sure you want to cancel this booking?')) {
            return;
        }

        try {
            const db = firebase.firestore();
            const bookingDoc = await db.collection('bookings').doc(bookingId).get();
            const booking = bookingDoc.data();
            
            if (!booking) {
                this.showNotification('Booking not found', 'error');
                return;
            }

            // Check if booking can be cancelled
            if (booking.status === 'completed' || booking.status === 'cancelled') {
                this.showNotification('This booking cannot be cancelled', 'error');
                return;
            }

            // Update booking status
            await db.collection('bookings').doc(bookingId).update({
                status: 'cancelled',
                cancelledAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Refund to user balance
            const userRef = db.collection('users').doc(this.currentUser.uid);
            const userDoc = await userRef.get();
            const userData = userDoc.data();
            const newBalance = (userData.balance || 0) + (booking.totalAmount || 0);
            
            await userRef.update({ balance: newBalance });
            
            // Update local user balance
            this.currentUser.balance = newBalance;
            this.updateUserProfile();

            console.log('CANCEL_BOOKING_SUCCESS', { bookingId });
            this.showNotification('Booking cancelled successfully. Amount refunded to your wallet.', 'success');
            
            // Reload stations to update available slots
            await this.loadNearbyStations();
            
        } catch (error) {
            console.error('CANCEL_BOOKING_ERROR', error);
            this.showNotification('Failed to cancel booking', 'error');
        }
    }

    async confirmBooking(bookingId) {
        try {
            const db = firebase.firestore();
            const bookingDoc = await db.collection('bookings').doc(bookingId).get();
            const booking = bookingDoc.data();
            
            if (!booking || booking.status !== 'pending') {
                this.showNotification('Invalid booking status', 'error');
                return;
            }

            // Update booking status to confirmed
            await db.collection('bookings').doc(bookingId).update({
                status: 'confirmed',
                paymentStatus: 'paid',
                confirmedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            console.log('CONFIRM_BOOKING_SUCCESS', { bookingId });
            this.showNotification('Booking confirmed! Your slot is reserved.', 'success');
            
        } catch (error) {
            console.error('CONFIRM_BOOKING_ERROR', error);
            this.showNotification('Failed to confirm booking', 'error');
        }
    }

    searchStations(searchTerm) {
        const filteredStations = this.stations.filter(station => 
            station.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            station.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
            station.city.toLowerCase().includes(searchTerm.toLowerCase())
        );

        this.updateFilteredStationsList(filteredStations);
    }

    filterStations(filterType) {
        let filteredStations = this.stations;
        
        if (filterType === 'available') {
            filteredStations = this.stations.filter(station => station.availableSlots > 0);
        } else if (filterType === 'fast') {
            filteredStations = this.stations.filter(station => station.chargerType === 'fast');
        } else if (filterType === 'cheap') {
            filteredStations = [...this.stations].sort((a, b) => a.pricePerHour - b.pricePerHour);
        }

        this.updateFilteredStationsList(filteredStations);
        
        // Update active filter button
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
    }

    updateFilteredStationsList(filteredStations) {
        const stationsList = document.getElementById('stationsList');
        if (!stationsList) return;
        
        stationsList.innerHTML = '';
        
        if (filteredStations.length === 0) {
            stationsList.innerHTML = '<p class="no-stations">No stations match your filter.</p>';
            return;
        }
        
        filteredStations.forEach(station => {
            const stationCard = document.createElement('div');
            stationCard.className = 'station-card';
            
            const availableSlots = station.availableSlots || 0;
            let badgeClass = 'unavailable';
            let badgeText = 'Full';
            
            if (availableSlots > 0) {
                badgeClass = 'available';
                badgeText = `${availableSlots} slots available`;
            }
            
            stationCard.innerHTML = `
                <div class="station-header">
                    <h3>${station.name}</h3>
                    <span class="availability-badge ${badgeClass}">${badgeText}</span>
                </div>
                
                <div class="station-info">
                    <p><i class="fas fa-map-marker-alt"></i> ${station.address}, ${station.city}</p>
                    <p><i class="fas fa-phone"></i> ${station.contactNumber || 'N/A'}</p>
                    <p><i class="fas fa-bolt"></i> ${station.chargerType} Charging</p>
                    <p><i class="fas fa-car"></i> ${availableSlots} slots available</p>
                    <p><i class="fas fa-money-bill-wave"></i> $${station.pricePerHour || 0}/hour</p>
                </div>
                
                <div class="station-actions">
                    <button class="btn-primary" onclick="userManager.viewStationDetails('${station.id}')">
                        <i class="fas fa-info-circle"></i> Details
                    </button>
                    <button class="btn-secondary" onclick="userManager.bookStation('${station.id}')" 
                            ${availableSlots > 0 ? '' : 'disabled'}>
                        <i class="fas fa-calendar-check"></i> Book Slot
                    </button>
                </div>
            `;
            
            stationsList.appendChild(stationCard);
        });
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification-toast ${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">&times;</button>
        `;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            color: white;
            display: flex;
            justify-content: space-between;
            align-items: center;
            min-width: 300px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        if (type === 'success') {
            notification.style.backgroundColor = '#38a169';
        } else if (type === 'error') {
            notification.style.backgroundColor = '#e53e3e';
        } else {
            notification.style.backgroundColor = '#4299e1';
        }
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    async logout() {
        try {
            await firebase.auth().signOut();
            // Clean up real-time listeners
            this.realTimeListeners.forEach(unsubscribe => unsubscribe());
            this.realTimeListeners = [];
            
            console.log('USER_LOGOUT', { userId: this.currentUser?.uid });
            window.location.href = 'login.html';
        } catch (error) {
            console.error('LOGOUT_ERROR', error);
            this.showNotification(error.message, 'error');
        }
    }
}

// Initialize User Manager
document.addEventListener('DOMContentLoaded', () => {
    window.userManager = new UserManager();
});
