class MainApp {
    constructor() {
        this.map = null;
        this.markers = [];
        this.init();
    }

    init() {
        this.initializeMap();
        this.setupEventListeners();
        this.loadStations();
    }

    initializeMap() {
        // Default center (New York)
        const defaultCenter = { lat: 40.7128, lng: -74.0060 };
        
        this.map = new google.maps.Map(document.getElementById('map'), {
            center: defaultCenter,
            zoom: 10,
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
                    const userLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    
                    // Center map on user location
                    this.map.setCenter(userLocation);
                    this.map.setZoom(12);
                    
                    // Add user marker
                    new google.maps.Marker({
                        position: userLocation,
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
                    this.loadNearbyStations(userLocation);
                    
                },
                (error) => {
                    console.error("Error getting location:", error);
                    // Load stations from default location
                    this.loadStations();
                }
            );
        } else {
            // Geolocation not supported
            this.loadStations();
        }
    }

    setupEventListeners() {
        // Search button
        const searchBtn = document.getElementById('searchBtn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => this.handleSearch());
        }

        // Search input enter key
        const searchInput = document.getElementById('locationSearch');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleSearch();
                }
            });
        }

        // Locate me button
        const locateBtn = document.getElementById('locateMe');
        if (locateBtn) {
            locateBtn.addEventListener('click', () => this.getUserLocation());
        }

        // Filter select
        const filterSelect = document.getElementById('filterType');
        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => this.filterStations(e.target.value));
        }

        // Mobile menu toggle
        const menuToggle = document.querySelector('.menu-toggle');
        if (menuToggle) {
            menuToggle.addEventListener('click', () => this.toggleMobileMenu());
        }
    }

    async loadStations() {
        try {
            // This would typically fetch from your API
            // For demo, we'll use sample data
            const sampleStations = [
                {
                    id: '1',
                    name: 'Downtown Charging Hub',
                    address: '123 Main St',
                    city: 'New York',
                    state: 'NY',
                    coordinates: { lat: 40.7128, lng: -74.0060 },
                    availableSlots: 4,
                    totalSlots: 8,
                    chargerType: 'fast',
                    pricePerHour: 12.99
                },
                {
                    id: '2',
                    name: 'Green Energy Station',
                    address: '456 Park Ave',
                    city: 'New York',
                    state: 'NY',
                    coordinates: { lat: 40.7589, lng: -73.9851 },
                    availableSlots: 2,
                    totalSlots: 6,
                    chargerType: 'normal',
                    pricePerHour: 9.99
                },
                {
                    id: '3',
                    name: 'EV Power Center',
                    address: '789 Broadway',
                    city: 'New York',
                    state: 'NY',
                    coordinates: { lat: 40.7306, lng: -73.9352 },
                    availableSlots: 6,
                    totalSlots: 10,
                    chargerType: 'both',
                    pricePerHour: 14.99
                }
            ];

            this.displayStations(sampleStations);
            
        } catch (error) {
            console.error('Error loading stations:', error);
        }
    }

    async loadNearbyStations(location) {
        // In a real application, you would query your backend API
        // with the location coordinates to get nearby stations
        
        console.log('Loading stations near:', location);
        // For now, we'll just load all stations
        this.loadStations();
    }

    displayStations(stations) {
        // Clear existing markers
        this.markers.forEach(marker => marker.setMap(null));
        this.markers = [];
        
        // Add markers for each station
        stations.forEach(station => {
            if (station.coordinates) {
                const marker = new google.maps.Marker({
                    position: {
                        lat: station.coordinates.lat,
                        lng: station.coordinates.lng
                    },
                    map: this.map,
                    title: station.name,
                    icon: this.getMarkerIcon(station)
                });
                
                // Add info window
                const infoWindow = new google.maps.InfoWindow({
                    content: `
                        <div style="padding: 10px;">
                            <h3 style="margin: 0 0 10px 0;">${station.name}</h3>
                            <p style="margin: 5px 0;">${station.address}, ${station.city}</p>
                            <p style="margin: 5px 0;"><strong>Available:</strong> ${station.availableSlots}/${station.totalSlots}</p>
                            <p style="margin: 5px 0;"><strong>Type:</strong> ${station.chargerType}</p>
                            <p style="margin: 5px 0;"><strong>Price:</strong> $${station.pricePerHour}/hour</p>
                            <a href="pages/login.html" style="display: inline-block; margin-top: 10px; padding: 8px 16px; background: #00a884; color: white; text-decoration: none; border-radius: 4px;">Book Now</a>
                        </div>
                    `
                });
                
                marker.addListener('click', () => {
                    infoWindow.open(this.map, marker);
                });
                
                this.markers.push(marker);
            }
        });
    }

    getMarkerIcon(station) {
        // Create custom marker icon based on station type and availability
        const svgIcon = {
            path: 'M 0,0 C -2,-20 -10,-22 -10,-30 A 10,10 0 1,1 10,-30 C 10,-22 2,-20 0,0 z',
            fillColor: station.availableSlots > 0 ? '#00a884' : '#e53e3e',
            fillOpacity: 0.8,
            strokeWeight: 2,
            strokeColor: '#FFFFFF',
            scale: 1,
            anchor: new google.maps.Point(0, -30)
        };
        
        if (station.chargerType === 'fast') {
            svgIcon.fillColor = '#3182ce';
        }
        
        return svgIcon;
    }

    handleSearch() {
        const searchInput = document.getElementById('locationSearch');
        const location = searchInput.value.trim();
        
        if (!location) {
            alert('Please enter a location to search');
            return;
        }
        
        // Use Google Maps Geocoding to convert location string to coordinates
        const geocoder = new google.maps.Geocoder();
        
        geocoder.geocode({ address: location }, (results, status) => {
            if (status === 'OK' && results[0]) {
                const location = results[0].geometry.location;
                
                // Center map on searched location
                this.map.setCenter(location);
                this.map.setZoom(12);
                
                // Load stations near this location
                this.loadNearbyStations({
                    lat: location.lat(),
                    lng: location.lng()
                });
                
            } else {
                alert('Location not found. Please try a different location.');
            }
        });
    }

    filterStations(filterType) {
        // This would filter stations based on the selected filter
        console.log('Filtering stations by:', filterType);
        
        // In a real application, you would re-fetch or filter existing stations
        // For now, we'll just reload all stations
        this.loadStations();
    }

    toggleMobileMenu() {
        const navLinks = document.querySelector('.nav-links');
        navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
    }

    checkAuthState() {
        // Check if user is logged in
        auth.onAuthStateChanged((user) => {
            const authButtons = document.querySelector('.auth-buttons');
            
            if (user) {
                // User is logged in
                authButtons.innerHTML = `
                    <a href="pages/user-panel.html" class="btn-primary">
                        <i class="fas fa-user"></i> Dashboard
                    </a>
                    <button onclick="mainApp.logout()" class="btn-logout">
                        Logout
                    </button>
                `;
            } else {
                // User is not logged in
                authButtons.innerHTML = `
                    <a href="pages/login.html" class="btn-login">Login</a>
                    <a href="pages/register.html" class="btn-register">Register</a>
                `;
            }
        });
    }

    async logout() {
        try {
            await auth.signOut();
            window.location.reload();
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
}

// Initialize Main App
document.addEventListener('DOMContentLoaded', () => {
    window.mainApp = new MainApp();
    mainApp.checkAuthState();
});