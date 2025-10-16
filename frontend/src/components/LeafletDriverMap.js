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

export default function LeafletDriverMap({ bins }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const routeLineRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize map if not already done
    if (!mapInstanceRef.current) {
      const defaultCenter = bins.length > 0 ? [bins[0].latitude, bins[0].longitude] : [13.0827, 80.2707];
      
      mapInstanceRef.current = L.map(mapRef.current).setView(defaultCenter, 13);

      // Add OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(mapInstanceRef.current);
    }

    // Clear existing markers and route
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    if (routeLineRef.current) {
      routeLineRef.current.remove();
      routeLineRef.current = null;
    }

    // Add markers for bins with numbered icons
    if (bins && bins.length > 0) {
      const routeCoordinates = [];

      bins.forEach((bin, index) => {
        const customIcon = L.divIcon({
          className: 'custom-numbered-marker',
          html: `<div style="background-color: #0d9488; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px;">${index + 1}</div>`,
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
      });

      // Draw route line connecting all bins
      if (routeCoordinates.length > 1) {
        routeLineRef.current = L.polyline(routeCoordinates, {
          color: '#0d9488',
          weight: 4,
          opacity: 0.7,
          dashArray: '10, 10',
        }).addTo(mapInstanceRef.current);
      }

      // Fit map to show all markers
      const bounds = L.latLngBounds(routeCoordinates);
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
    }

    return () => {
      // Cleanup on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [bins]);

  return (
    <div 
      ref={mapRef} 
      className="w-full h-[500px] rounded-lg overflow-hidden border border-gray-200" 
      data-testid="leaflet-driver-map-container"
    />
  );
}
