import React from 'react';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  Pin,
  MapMouseEvent,
} from '@vis.gl/react-google-maps';
import { ExternalLink, MapPin } from 'lucide-react';
import { getGoogleMapsUrl } from '../utils/format';

interface DeliveryMapProps {
  latitude: number;
  longitude: number;
  onChangePosition?: (lat: number, lng: number) => void;
  quotaExceeded?: boolean;
}

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export const DeliveryMap: React.FC<DeliveryMapProps> = ({
  latitude,
  longitude,
  onChangePosition,
  quotaExceeded = false,
}) => {
  const position = { lat: latitude, lng: longitude };
  const mapsUrl = getGoogleMapsUrl(true, latitude, longitude);

  if (!MAPS_API_KEY || quotaExceeded) {
    return (
      <div className="rounded-xl border border-[#A97142]/40 bg-[#16110E] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#3B1F11] text-[#D4AF37] flex items-center justify-center shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#FAF7F0]">Position GPS enregistrée</p>
            <p className="font-mono text-xs text-[#D4AF37] tabular-nums mt-0.5">
              {latitude.toFixed(6)}, {longitude.toFixed(6)}
            </p>
          </div>
        </div>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-[#24130B] border border-[#D4AF37]/40 text-[#FAF7F0] text-xs font-semibold hover:bg-[#3B1F11] transition-colors whitespace-nowrap"
        >
          <ExternalLink className="w-4 h-4 text-[#D4AF37]" />
          Vérifier sur Google Maps
        </a>
      </div>
    );
  }

  const handleMapClick = (ev: MapMouseEvent) => {
    if (!onChangePosition || !ev.detail.latLng) return;
    onChangePosition(ev.detail.latLng.lat, ev.detail.latLng.lng);
  };

  return (
    <div className="space-y-2">
      <div className="h-64 w-full rounded-xl overflow-hidden border border-[#A97142]/40 bg-[#16110E]">
        <APIProvider apiKey={MAPS_API_KEY} language="fr" libraries={['marker']}>
          <GoogleMap
            mapId="DEMO_MAP_ID"
            center={position}
            defaultZoom={16}
            gestureHandling="greedy"
            disableDefaultUI={false}
            streetViewControl={false}
            mapTypeControl={false}
            onClick={handleMapClick}
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            style={{ width: '100%', height: '100%' }}
          >
            <AdvancedMarker position={position} title="Lieu de livraison">
              <Pin background="#D4AF37" borderColor="#24130B" glyphColor="#0B0908" />
            </AdvancedMarker>
          </GoogleMap>
        </APIProvider>
      </div>
      {onChangePosition && (
        <p className="text-xs text-[#EFE8DA]/75">
          Astuce : touchez la carte pour ajuster précisément le point de livraison.
        </p>
      )}
    </div>
  );
};
