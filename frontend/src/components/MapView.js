import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || 'YOUR_GOOGLE_MAPS_API_KEY';

export default function MapView({ bins }) {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [infoWindows, setInfoWindows] = useState([]);

  useEffect(() => {
    // Load Google Maps script
    if (!window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
      script.async = true;
      script.defer = true;
      script.onload = initMap;
      script.onerror = () => {
        toast.error('Failed to load Google Maps. Please check your API key.');
      };
      document.head.appendChild(script);
    } else {
      initMap();
    }
  }, []);

  useEffect(() => {
    if (map && bins.length > 0) {
      updateMarkers();
    }
  }, [bins, map]);

  const initMap = () => {
    if (!window.google || !mapRef.current) return;

    const center = bins.length > 0 ? { lat: bins[0].latitude, lng: bins[0].longitude } : { lat: 40.7580, lng: -73.9855 };

    const newMap = new window.google.maps.Map(mapRef.current, {
      center,
      zoom: 14,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }],
        },
      ],
    });

    setMap(newMap);
  };

  const updateMarkers = () => {
    // Clear existing markers and info windows
    markers.forEach((marker) => marker.setMap(null));
    infoWindows.forEach((infoWindow) => infoWindow.close());

    const newMarkers = [];
    const newInfoWindows = [];

    bins.forEach((bin) => {
      const position = { lat: bin.latitude, lng: bin.longitude };

      // Determine marker color based on status
      let fillColor;
      switch (bin.status) {
        case 'critical':
          fillColor = '#dc2626';
          break;
        case 'full':
          fillColor = '#ea580c';
          break;
        case 'half-full':
          fillColor = '#ca8a04';
          break;
        default:
          fillColor = '#059669';
      }

      const marker = new window.google.maps.Marker({
        position,
        map,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor,
          fillOpacity: 0.9,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: 10,
        },
        title: bin.location_name,
      });

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; max-width: 200px;">
            <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">${bin.location_name}</h3>
            <p style="margin: 4px 0; font-size: 12px; color: #666;">Fill Level: <strong>${bin.fill_level}%</strong></p>
            <p style="margin: 4px 0; font-size: 12px; color: #666;">Status: <strong style="text-transform: capitalize;">${bin.status.replace('-', ' ')}</strong></p>
          </div>
        `,
      });

      marker.addListener('click', () => {
        // Close all other info windows
        newInfoWindows.forEach((iw) => iw.close());
        infoWindow.open(map, marker);
      });

      newMarkers.push(marker);
      newInfoWindows.push(infoWindow);
    });

    setMarkers(newMarkers);
    setInfoWindows(newInfoWindows);

    // Adjust map bounds to fit all markers
    if (bins.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      bins.forEach((bin) => {
        bounds.extend({ lat: bin.latitude, lng: bin.longitude });
      });
      map.fitBounds(bounds);
    }
  };

  return (
    <div className="relative w-full h-[500px] rounded-lg overflow-hidden border border-gray-200">
      <div ref={mapRef} className="w-full h-full" data-testid="map-container" />
      {!window.google && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-sm text-gray-600">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  );
}