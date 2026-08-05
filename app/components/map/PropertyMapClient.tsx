"use client";

import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import PropertyMapPopup from "@/app/components/map/PropertyMapPopup";
import { createPropertyPriceIcon } from "@/app/components/map/PropertyPriceMarker";
import { defaultHcmCenter } from "@/lib/map/districtCenters";
import type { MapBounds, PropertyMapListing } from "@/types/map";

type Props = {
  listings: PropertyMapListing[];
  selectedId: string | null;
  hoveredId: string | null;
  height?: number | string;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  onView: (id: string) => void;
  onBoundsSearch: (bounds: MapBounds | null) => void;
};

function toBounds(bounds: L.LatLngBounds): MapBounds {
  return {
    north: bounds.getNorth(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    west: bounds.getWest(),
  };
}

function FitListings({ listings, selectedId }: { listings: PropertyMapListing[]; selectedId: string | null }) {
  const map = useMap();

  useEffect(() => {
    const selected = listings.find((listing) => listing.id === selectedId);
    if (selected) {
      map.flyTo([selected.latitude, selected.longitude], Math.max(map.getZoom(), 15), {
        duration: 0.7,
      });
      return;
    }

    if (listings.length === 0) return;
    const bounds = L.latLngBounds(listings.map((listing) => [listing.latitude, listing.longitude]));
    map.fitBounds(bounds.pad(0.18), { maxZoom: 15 });
  }, [listings, map, selectedId]);

  return null;
}

function MoveWatcher({ onMove }: { onMove: (bounds: MapBounds) => void }) {
  const map = useMapEvents({
    moveend: () => {
      onMove(toBounds(map.getBounds()));
    },
    zoomend: () => {
      onMove(toBounds(map.getBounds()));
    },
  });

  return null;
}

export default function PropertyMapClient({
  listings,
  selectedId,
  hoveredId,
  height = 680,
  onHover,
  onSelect,
  onView,
  onBoundsSearch,
}: Props) {
  const [pendingBounds, setPendingBounds] = useState<MapBounds | null>(null);
  const [moved, setMoved] = useState(false);
  const topMatchId = useMemo(
    () =>
      listings
        .filter((listing) => listing.matchScore !== null)
        .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))[0]?.id || null,
    [listings]
  );
  const center = listings[0]
    ? ([listings[0].latitude, listings[0].longitude] as [number, number])
    : ([defaultHcmCenter.latitude, defaultHcmCenter.longitude] as [number, number]);

  useEffect(() => {
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
  }, []);

  return (
    <div className="property-map-shell" style={{ height }}>
      {listings.length === 0 ? (
        <div className="property-map-empty">Chưa có căn có tọa độ hợp lệ trong bộ lọc này.</div>
      ) : (
        <>
          <MapContainer center={center} zoom={13} scrollWheelZoom className="property-map">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MarkerClusterGroup chunkedLoading showCoverageOnHover={false} maxClusterRadius={42}>
              {listings.map((listing) => {
                const active = selectedId === listing.id || hoveredId === listing.id;
                const icon = createPropertyPriceIcon(
                  listing.priceLabel,
                  listing.priceValue,
                  active,
                  topMatchId === listing.id
                );

                return (
                  <Marker
                    key={listing.id}
                    position={[listing.latitude, listing.longitude]}
                    icon={icon}
                    zIndexOffset={active ? 1000 : topMatchId === listing.id ? 500 : 0}
                    eventHandlers={{
                      mouseover: () => onHover(listing.id),
                      mouseout: () => onHover(null),
                      click: () => onSelect(listing.id),
                    }}
                  >
                    <Popup>
                      <PropertyMapPopup item={listing} onView={onView} />
                    </Popup>
                  </Marker>
                );
              })}
            </MarkerClusterGroup>
            <FitListings listings={listings} selectedId={selectedId} />
            <MoveWatcher
              onMove={(bounds) => {
                setPendingBounds(bounds);
                setMoved(true);
              }}
            />
          </MapContainer>
          {moved && (
            <button
              type="button"
              className="property-map-search-area"
              onClick={() => {
                onBoundsSearch(pendingBounds);
                setMoved(false);
              }}
            >
              Tìm trong khu vực này
            </button>
          )}
          <button
            type="button"
            className="property-map-clear-area"
            onClick={() => {
              onBoundsSearch(null);
              setMoved(false);
            }}
          >
            Toàn bộ kết quả
          </button>
        </>
      )}
    </div>
  );
}
