"use client";

import Link from "next/link";
import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import PropertyMapPopup from "@/app/components/map/PropertyMapPopup";
import { createPropertyPriceIcon } from "@/app/components/map/PropertyPriceMarker";
import { defaultHcmCenter } from "@/lib/map/districtCenters";
import type { PropertyMapListing } from "@/types/map";

function FitMap({ listings }: { listings: PropertyMapListing[] }) {
  const map = useMap();

  useEffect(() => {
    if (listings.length === 0) return;

    const bounds = L.latLngBounds(
      listings.map((listing) => [listing.latitude, listing.longitude])
    );
    map.fitBounds(bounds.pad(0.16), { maxZoom: 14 });
  }, [listings, map]);

  return null;
}

export default function HomeAreaMapClient({
  listings,
}: {
  listings: PropertyMapListing[];
}) {
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
      <div className="home-area-map-empty">
        <span className="home-area-map-empty__icon" aria-hidden>
          ⌖
        </span>
        <strong>Đang cập nhật vị trí bất động sản.</strong>
        <span>Dữ liệu tọa độ sẽ hiển thị tại đây khi được bổ sung.</span>
        <Link href="/?q=nhà cho thuê">Xem danh sách theo khu vực</Link>
      </div>
    );
  }

  return (
    <MapContainer center={center} zoom={12} scrollWheelZoom={false} className="home-area-map">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MarkerClusterGroup chunkedLoading showCoverageOnHover={false} maxClusterRadius={44}>
        {listings.slice(0, 24).map((listing) => (
          <Marker
            key={listing.id}
            position={[listing.latitude, listing.longitude]}
            icon={createPropertyPriceIcon(listing.priceLabel, listing.priceValue, false, false)}
          >
            <Popup>
              <PropertyMapPopup
                item={listing}
                onView={(id) => window.location.assign(`/listing/${id}`)}
              />
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>
      <FitMap listings={listings} />
    </MapContainer>
  );
}
