"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import PropertyMapPopup from "@/app/components/map/PropertyMapPopup";
import { createPropertyPriceIcon } from "@/app/components/map/PropertyPriceMarker";
import { defaultHcmCenter } from "@/lib/map/districtCenters";
import type { PropertyMapListing } from "@/types/map";

type Props = {
  listings: PropertyMapListing[];
  selectedId: string | null;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  onView: (id: string) => void;
};

function FitRelatedListings({ listings }: { listings: PropertyMapListing[] }) {
  const map = useMap();

  useEffect(() => {
    if (listings.length === 0) return;

    const bounds = L.latLngBounds(
      listings.map((listing) => [listing.latitude, listing.longitude])
    );
    map.fitBounds(bounds.pad(0.18), { maxZoom: 15 });
  }, [listings, map]);

  return null;
}

function PanToSelected({
  listings,
  selectedId,
}: {
  listings: PropertyMapListing[];
  selectedId: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!selectedId) return;
    const selected = listings.find((listing) => listing.id === selectedId);
    if (!selected) return;

    map.panTo([selected.latitude, selected.longitude], { animate: true, duration: 0.55 });
  }, [listings, map, selectedId]);

  return null;
}

export default function RelatedListingsMapClient({
  listings,
  selectedId,
  hoveredId,
  onHover,
  onSelect,
  onView,
}: Props) {
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

  if (listings.length === 0) {
    return (
      <div className="related-map-empty">
        Chưa có căn liên quan có tọa độ hợp lệ để hiển thị marker.
      </div>
    );
  }

  return (
    <MapContainer center={center} zoom={13} scrollWheelZoom className="related-map">
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
      <FitRelatedListings listings={listings} />
      <PanToSelected listings={listings} selectedId={selectedId} />
    </MapContainer>
  );
}
