import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || 'YOUR_GOOGLE_MAPS_API_KEY';

export default function DriverMapView({ route, bins }) {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [directionsRenderer, setDirectionsRenderer] = useState(null);

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
      displayRoute();
    }
  }, [bins, map, route]);

  const initMap = () => {
    if (!window.google || !mapRef.current) return;

    const center = bins.length > 0 ? { lat: bins[0].latitude, lng: bins[0].longitude } : { lat: 40.7580, lng: -73.9855 };

    const newMap = new window.google.maps.Map(mapRef.current, {
      center,
      zoom: 13,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }],
        },
      ],
    });

    const renderer = new window.google.maps.DirectionsRenderer({
      map: newMap,
      suppressMarkers: false,
    });

    setMap(newMap);
    setDirectionsRenderer(renderer);
  };

  const displayRoute = async () => {
    if (!map || !directionsRenderer || bins.length === 0) return;

    // Create custom markers for bins
    bins.forEach((bin, index) => {
      const position = { lat: bin.latitude, lng: bin.longitude };

      new window.google.maps.Marker({
        position,
        map,
        label: {
          text: (index + 1).toString(),
          color: 'white',
          fontWeight: 'bold',
        },
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: '#0d9488',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: 12,
        },
        title: bin.location_name,
      });
    });

    // Request directions with waypoints
    if (bins.length >= 2) {
      const directionsService = new window.google.maps.DirectionsService();
      const origin = { lat: bins[0].latitude, lng: bins[0].longitude };
      const destination = { lat: bins[bins.length - 1].latitude, lng: bins[bins.length - 1].longitude };
      
      const waypoints = bins.slice(1, -1).map((bin) => ({
        location: { lat: bin.latitude, lng: bin.longitude },
        stopover: true,
      }));

      try {
        const result = await directionsService.route({
          origin,
          destination,
          waypoints,
          optimizeWaypoints: false,
          travelMode: window.google.maps.TravelMode.DRIVING,
        });

        directionsRenderer.setDirections(result);
      } catch (error) {
        console.error('Directions request failed:', error);
        // If directions fail, just fit bounds to show all bins
        const bounds = new window.google.maps.LatLngBounds();
        bins.forEach((bin) => {
          bounds.extend({ lat: bin.latitude, lng: bin.longitude });
        });
        map.fitBounds(bounds);
      }
    } else if (bins.length === 1) {
      map.setCenter({ lat: bins[0].latitude, lng: bins[0].longitude });
      map.setZoom(15);
    }
  };

  return (
    <div className="relative w-full h-[500px] rounded-lg overflow-hidden border border-gray-200">
      <div ref={mapRef} className="w-full h-full" data-testid="driver-map-container" />
      {!window.google && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-sm text-gray-600">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  );
}