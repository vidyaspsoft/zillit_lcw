import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Input, Spin } from 'antd';
import { EnvironmentOutlined, SearchOutlined, CloseOutlined, AimOutlined } from '@ant-design/icons';
import { GOOGLE_MAPS_API_KEY } from '../../config/constants';

/**
 * PlacePicker - Google Places Autocomplete + Map picker
 * Self-contained: loads Google Maps script if not already loaded.
 */

// ── Load Google Maps script once ──
let googleMapsPromise = null;
function loadGoogleMaps() {
  if (window.google?.maps?.places) return Promise.resolve();
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
      // Script tag exists but not loaded yet — wait for it
      const check = setInterval(() => {
        if (window.google?.maps?.places) { clearInterval(check); resolve(); }
      }, 100);
      setTimeout(() => { clearInterval(check); reject(new Error('Google Maps timeout')); }, 10000);
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });
  return googleMapsPromise;
}

const PlacePicker = ({ onPlaceSelect, initialLat, initialLng, initialSearch = '' }) => {
  const [searchText, setSearchText] = useState(initialSearch);
  const [showMap, setShowMap] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [mapsReady, setMapsReady] = useState(!!window.google?.maps?.places);
  const [mapCenter, setMapCenter] = useState({
    lat: initialLat || 19.076,
    lng: initialLng || 72.8777,
  });

  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  // Load Google Maps on mount
  useEffect(() => {
    loadGoogleMaps()
      .then(() => setMapsReady(true))
      .catch((err) => console.error('PlacePicker:', err.message));
  }, []);

  // Initialize autocomplete when maps ready + input mounted
  useEffect(() => {
    if (!mapsReady || !inputRef.current || autocompleteRef.current) return;

    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ['establishment', 'geocode'],
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (!place.geometry) return;
      const result = extractPlaceData(place);
      setSelectedPlace(result);
      setSearchText(result.formattedAddress || result.name);
      setMapCenter({ lat: result.lat, lng: result.lng });
      onPlaceSelect(result);
    });

    autocompleteRef.current = autocomplete;

    return () => {
      if (autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [mapsReady, onPlaceSelect]);

  // Initialize map when shown
  useEffect(() => {
    if (!showMap || !mapsReady || !mapContainerRef.current) return;

    const map = new window.google.maps.Map(mapContainerRef.current, {
      center: mapCenter,
      zoom: 14,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });
    mapRef.current = map;

    const marker = new window.google.maps.Marker({
      position: mapCenter,
      map,
      draggable: true,
    });
    markerRef.current = marker;

    map.addListener('click', (e) => {
      const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      marker.setPosition(pos);
      reverseGeocode(pos);
    });

    marker.addListener('dragend', () => {
      const pos = { lat: marker.getPosition().lat(), lng: marker.getPosition().lng() };
      reverseGeocode(pos);
    });

    if (initialLat && initialLng) {
      const pos = { lat: initialLat, lng: initialLng };
      marker.setPosition(pos);
      map.setCenter(pos);
    }
  }, [showMap, mapsReady]);

  const reverseGeocode = useCallback((pos) => {
    if (!window.google?.maps) return;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: pos }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const result = extractPlaceData(results[0], pos);
        result.lat = pos.lat;
        result.lng = pos.lng;
        setSelectedPlace(result);
        setSearchText(result.formattedAddress || result.name);
        onPlaceSelect(result);
      } else {
        const result = { name: '', lat: pos.lat, lng: pos.lng, city: '', address: '', formattedAddress: `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}` };
        setSelectedPlace(result);
        onPlaceSelect(result);
      }
    });
  }, [onPlaceSelect]);

  const extractPlaceData = (place, fallbackPos) => {
    const data = {
      name: place.name || '',
      formattedAddress: place.formatted_address || '',
      lat: place.geometry?.location?.lat?.() || fallbackPos?.lat || 0,
      lng: place.geometry?.location?.lng?.() || fallbackPos?.lng || 0,
      city: '',
      address: place.formatted_address || '',
    };
    const components = place.address_components || [];
    for (const comp of components) {
      if (comp.types.includes('locality')) {
        data.city = comp.long_name;
      } else if (comp.types.includes('administrative_area_level_2') && !data.city) {
        data.city = comp.long_name;
      }
    }
    return data;
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) return alert('Geolocation not supported');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const pos = { lat: position.coords.latitude, lng: position.coords.longitude };
        setMapCenter(pos);
        if (mapRef.current) {
          mapRef.current.setCenter(pos);
          markerRef.current?.setPosition(pos);
        }
        reverseGeocode(pos);
        if (!showMap) setShowMap(true);
      },
      () => alert('Unable to get your location')
    );
  };

  const handleClear = () => {
    setSearchText('');
    setSelectedPlace(null);
    if (inputRef.current) inputRef.current.value = '';
    onPlaceSelect({ name: '', lat: null, lng: null, city: '', address: '', formattedAddress: '' });
  };

  if (!mapsReady) {
    return (
      <div className="flex items-center gap-2 p-4 text-gray-400 text-sm">
        <Spin size="small" />
        <span>Loading Google Maps...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search bar + actions */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 ant-input-affix-wrapper" style={{ padding: 0 }}>
          <SearchOutlined className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10 pointer-events-none" style={{ fontSize: 14 }} />
          <input
            ref={inputRef}
            type="text"
            defaultValue={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search location on Google Maps..."
            style={{
              width: '100%',
              height: 40,
              paddingLeft: 34,
              paddingRight: 32,
              border: '1px solid #d9d9d9',
              borderRadius: 10,
              fontSize: 14,
              color: '#1E293B',
              outline: 'none',
              background: '#fff',
              fontFamily: 'inherit',
              transition: 'all 0.2s',
            }}
            onFocus={(e) => { e.target.style.borderColor = '#E8930C'; e.target.style.boxShadow = '0 0 0 2px rgba(232,147,12,0.1)'; }}
            onBlur={(e) => { e.target.style.borderColor = '#d9d9d9'; e.target.style.boxShadow = 'none'; }}
          />
          {(searchText || selectedPlace) && (
            <button
              type="button"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer"
              onClick={handleClear}
            >
              <CloseOutlined style={{ fontSize: 12 }} />
            </button>
          )}
        </div>
        <Button icon={<AimOutlined />} onClick={handleDetectLocation}>
          My Location
        </Button>
        <Button
          type={showMap ? 'primary' : 'default'}
          onClick={() => setShowMap(!showMap)}
        >
          {showMap ? 'Hide Map' : 'Pick on Map'}
        </Button>
      </div>

      {/* Selected place card */}
      {selectedPlace && selectedPlace.lat && (
        <div className="flex items-start gap-2.5 p-3 bg-green-50 border border-green-200 rounded-xl text-sm">
          <EnvironmentOutlined className="text-green-500 mt-0.5 text-base" />
          <div className="min-w-0 flex-1">
            {selectedPlace.name && <div className="font-semibold text-sm text-gray-800">{selectedPlace.name}</div>}
            {selectedPlace.formattedAddress && <div className="text-xs text-gray-500 mt-0.5">{selectedPlace.formattedAddress}</div>}
            <div className="text-[10px] text-gray-400 mt-1">
              {selectedPlace.lat?.toFixed(6)}, {selectedPlace.lng?.toFixed(6)}
              {selectedPlace.city && <span className="ml-2 text-blue-500">{selectedPlace.city}</span>}
            </div>
          </div>
          <button
            type="button"
            className="text-gray-400 hover:text-red-500 bg-transparent border-none cursor-pointer p-1"
            onClick={handleClear}
          >
            <CloseOutlined style={{ fontSize: 11 }} />
          </button>
        </div>
      )}

      {/* Map */}
      {showMap && (
        <div>
          <div
            ref={mapContainerRef}
            className="w-full rounded-xl border border-gray-200 overflow-hidden"
            style={{ height: 240 }}
          />
          <p className="text-[11px] text-gray-400 mt-1.5">Click on the map or drag the marker to select a location</p>
        </div>
      )}
    </div>
  );
};

export default PlacePicker;
