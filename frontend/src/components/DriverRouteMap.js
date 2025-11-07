import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export default function DriverRouteMap({ bins, driverLocation }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const routeLineRef = useRef(null);
  const driverMarkerRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || !bins || bins.length === 0) return;

    // Initialize map if not already done
    if (!mapInstanceRef.current) {
      const defaultCenter = bins.length > 0 
        ? [bins[0].latitude, bins[0].longitude] 
        : driverLocation 
        ? [driverLocation.lat, driverLocation.lng]
        : [13.0827, 80.2707];
      
      try {
        mapInstanceRef.current = L.map(mapRef.current).setView(defaultCenter, 13);

        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(mapInstanceRef.current);
      } catch (error) {
        console.error('Error initializing map:', error);
        return;
      }
    }

    // Clear existing markers and route safely
    try {
      markersRef.current.forEach((marker) => {
        if (marker && mapInstanceRef.current) {
          marker.remove();
        }
      });
      markersRef.current = [];
      
      if (routeLineRef.current && mapInstanceRef.current) {
        routeLineRef.current.remove();
        routeLineRef.current = null;
      }
      
      if (driverMarkerRef.current && mapInstanceRef.current) {
        driverMarkerRef.current.remove();
        driverMarkerRef.current = null;
      }
    } catch (error) {
      console.error('Error clearing markers:', error);
    }

    if (!mapInstanceRef.current) return;

    // Add driver marker if location available
    if (driverLocation) {
      try {
        const driverIcon = L.divIcon({
          className: 'driver-marker',
          html: `<div style="background-color: #3b82f6; width: 36px; height: 36px; border-radius: 50%; border: 4px solid white; box-shadow: 0 3px 8px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center;">
            <svg width="20" height="20" fill="white" viewBox="0 0 24 24">
              <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm0 2.18l6 2.25v4.66c0 4.11-2.68 7.94-6 8.82-3.32-.88-6-4.71-6-8.82V6.43l6-2.25z"/>
            </svg>
          </div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        driverMarkerRef.current = L.marker([driverLocation.lat, driverLocation.lng], { icon: driverIcon })
          .addTo(mapInstanceRef.current)
          .bindPopup('<div style="text-align: center; font-weight: 600;">Your Location</div>');
      } catch (error) {
        console.error('Error adding driver marker:', error);
      }
    }

    // Add markers for bins with numbered icons
    if (bins && bins.length > 0) {
      const routeCoordinates = [];

      bins.forEach((bin, index) => {
        try {
          // Determine marker color based on bin status
          let markerColor;
          switch (bin.status) {
            case 'critical':
              markerColor = '#dc2626';
              break;
            case 'full':
              markerColor = '#ea580c';
              break;
            case 'half-full':
              markerColor = '#ca8a04';
              break;
            case 'empty':
              markerColor = '#059669';
              break;
            default:
              markerColor = '#6b7280';
          }

          const customIcon = L.divIcon({
            className: 'custom-numbered-marker',
            html: `<div style="background-color: ${markerColor}; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px;">${index + 1}</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          });

          const marker = L.marker([bin.latitude, bin.longitude], { icon: customIcon })
            .addTo(mapInstanceRef.current)
            .bindPopup(`
              <div style="min-width: 150px;">
                <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">Stop ${index + 1}: ${bin.location_name}</h3>
                <p style="margin: 4px 0; font-size: 12px; color: #666;">Fill Level: <strong>${bin.fill_level}%</strong></p>
                <p style="margin: 4px 0; font-size: 12px; color: #666;">Status: <strong style="text-transform: capitalize;">${bin.status.replace('-', ' ')}</strong></p>
              </div>
            `);

          markersRef.current.push(marker);
          routeCoordinates.push([bin.latitude, bin.longitude]);
        } catch (error) {
          console.error('Error adding bin marker:', error);
        }
      });

      // Draw route line connecting all bins
      if (routeCoordinates.length > 1) {
        try {
          routeLineRef.current = L.polyline(routeCoordinates, {
            color: '#0d9488',
            weight: 4,
            opacity: 0.7,
            dashArray: '10, 10',
          }).addTo(mapInstanceRef.current);
        } catch (error) {
          console.error('Error adding route line:', error);
        }
      }

      // Fit map to show all markers including driver
      try {
        const allCoordinates = [...routeCoordinates];
        if (driverLocation) {
          allCoordinates.push([driverLocation.lat, driverLocation.lng]);
        }
        
        if (allCoordinates.length > 0) {
          const bounds = L.latLngBounds(allCoordinates);
          mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
        }
      } catch (error) {
        console.error('Error fitting bounds:', error);
      }
    }
  }, [bins, driverLocation]);

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (error) {
          console.error('Error removing map:', error);
        }
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div 
      ref={mapRef} 
      className="w-full h-[500px] rounded-lg overflow-hidden border border-gray-200 shadow-md" 
      data-testid="driver-route-map-container"
    />
  );
}
