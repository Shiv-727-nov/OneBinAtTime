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

export default function LeafletMap({ bins, center = null }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize map if not already done
    if (!mapInstanceRef.current) {
      const defaultCenter = center || (bins.length > 0 ? [bins[0].latitude, bins[0].longitude] : [13.0827, 80.2707]);
      
      mapInstanceRef.current = L.map(mapRef.current).setView(defaultCenter, 12);

      // Add OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(mapInstanceRef.current);
    }

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Add markers for bins
    if (bins && bins.length > 0) {
      bins.forEach((bin) => {
        // Create custom icon based on status
        let iconColor;
        switch (bin.status) {
          case 'critical':
            iconColor = '#dc2626';
            break;
          case 'full':
            iconColor = '#ea580c';
            break;
          case 'half-full':
            iconColor = '#ca8a04';
            break;
          default:
            iconColor = '#059669';
        }

        const customIcon = L.divIcon({
          className: 'custom-bin-marker',
          html: `<div style="background-color: ${iconColor}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const marker = L.marker([bin.latitude, bin.longitude], { icon: customIcon })
          .addTo(mapInstanceRef.current)
          .bindPopup(`
            <div style="min-width: 150px;">
              <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">${bin.location_name}</h3>
              <p style="margin: 4px 0; font-size: 12px; color: #666;">Fill Level: <strong>${bin.fill_level}%</strong></p>
              <p style="margin: 4px 0; font-size: 12px; color: #666;">Status: <strong style="text-transform: capitalize;">${bin.status.replace('-', ' ')}</strong></p>
            </div>
          `);

        markersRef.current.push(marker);
      });

      // Fit map to show all markers
      const bounds = L.latLngBounds(bins.map((bin) => [bin.latitude, bin.longitude]));
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
    }

    return () => {
      // Cleanup on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [bins, center]);

  return (
    <div 
      ref={mapRef} 
      className="w-full h-[500px] rounded-lg overflow-hidden border border-gray-200" 
      data-testid="leaflet-map-container"
    />
  );
}
