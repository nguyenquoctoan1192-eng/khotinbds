"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";

import MarkerClusterGroup from "react-leaflet-cluster";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import PropertyMapPopup from "@/app/components/map/PropertyMapPopup";
import { createPropertyPriceIcon } from "@/app/components/map/PropertyPriceMarker";
import { defaultHcmCenter } from "@/lib/map/districtCenters";

import type { PropertyMapListing } from "@/types/map";

type Props = {
  listings: PropertyMapListing[];
  selectedId: string | null;
  hoveredId: string | null;

  currentListingId: string;

  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  onView: (id: string) => void;
};

function InvalidateMapSize() {
  const map = useMap();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      window.clearTimeout(timer);
    };
  }, [map]);

  return null;
}

function InitialFitBounds({
  listings,
  currentListingId,
}: {
  listings: PropertyMapListing[];
  currentListingId: string;
}) {
  const map = useMap();

  useEffect(() => {
    if (listings.length === 0) {
      return;
    }

    const current = listings.find(
      (listing) => listing.id === currentListingId
    );

    /*
     * Nếu có tin chính:
     * ưu tiên lấy vị trí tin chính làm trung tâm.
     */
    if (current) {
      /*
       * Nếu chỉ có tin chính hoặc tất cả tin còn lại
       * ở quá xa, vẫn lấy tin chính làm center ban đầu.
       */
      map.setView(
        [current.latitude, current.longitude],
        listings.length === 1 ? 16 : 14,
        {
          animate: false,
        }
      );
    }

    /*
     * Nếu có nhiều tin có tọa độ thật,
     * fit để nhìn thấy toàn bộ.
     */
    if (listings.length >= 2) {
      const exactListings = listings.filter(
        (listing) => !listing.approximateLocation
      );

      const boundsSource =
        exactListings.length >= 2
          ? exactListings
          : listings;

      if (boundsSource.length >= 2) {
        const bounds = L.latLngBounds(
          boundsSource.map((listing) => [
            listing.latitude,
            listing.longitude,
          ])
        );

        map.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 16,
          animate: false,
        });

        /*
         * Sau fitBounds, đưa tin chính vào vùng nhìn thấy.
         */
        if (current) {
          const currentLatLng = L.latLng(
            current.latitude,
            current.longitude
          );

          if (!bounds.contains(currentLatLng)) {
            map.panTo(currentLatLng, {
              animate: false,
            });
          }
        }
      }
    }
  }, [listings, currentListingId, map]);

  return null;
}

export default function RelatedListingsMapClient({
  listings,
  selectedId,
  hoveredId,
  currentListingId,
  onHover,
  onSelect,
  onView,
}: Props) {
  /*
   * Không mutate mảng listings bằng sort().
   */
  const topMatchId = useMemo(() => {
    return [...listings]
      .filter(
        (listing) =>
          listing.matchScore !== null
      )
      .sort(
        (a, b) =>
          (b.matchScore ?? 0) -
          (a.matchScore ?? 0)
      )[0]?.id ?? null;
  }, [listings]);

  const center: [number, number] = listings[0]
    ? [
        listings[0].latitude,
        listings[0].longitude,
      ]
    : [
        defaultHcmCenter.latitude,
        defaultHcmCenter.longitude,
      ];

  useEffect(() => {
    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",

      iconUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",

      shadowUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
  }, []);

  if (listings.length === 0) {
    return (
      <div className="related-map-empty">
        Chưa có bất động sản có tọa độ hợp lệ để hiển thị.
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "430px",
        minHeight: "320px",
        position: "relative",
        overflow: "hidden",
        borderRadius: "12px",
      }}
    >
      <MapContainer
        center={center}
        zoom={14}
        scrollWheelZoom
        dragging
        doubleClickZoom
        touchZoom
        zoomControl
        style={{
          width: "100%",
          height: "100%",
          minHeight: "320px",
          borderRadius: "12px",
        }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors &copy; CARTO"
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains={["a", "b", "c", "d"]}
          maxZoom={20}
        />

        <InvalidateMapSize />

        <InitialFitBounds
          listings={listings}
          currentListingId={currentListingId}
        />

        <MarkerClusterGroup
          chunkedLoading
          showCoverageOnHover={false}
          maxClusterRadius={45}
          spiderfyOnMaxZoom
          zoomToBoundsOnClick
        >
          {listings.map((listing) => {
            const isCurrent =
              listing.id === currentListingId;

            const active =
              selectedId === listing.id ||
              hoveredId === listing.id;

            const icon = createPropertyPriceIcon(
              listing.priceLabel,
              listing.priceValue,
              active || isCurrent,
              topMatchId === listing.id
            );

            return (
              <Marker
                key={listing.id}
                position={[
                  listing.latitude,
                  listing.longitude,
                ]}
                icon={icon}
                zIndexOffset={
                  isCurrent
                    ? 3000
                    : active
                    ? 2000
                    : topMatchId === listing.id
                    ? 1000
                    : 0
                }
                eventHandlers={{
                  mouseover: () => {
                    onHover(listing.id);
                  },

                  mouseout: () => {
                    onHover(null);
                  },

                  click: () => {
                    onSelect(listing.id);
                  },
                }}
              >
                <Popup
                  closeButton
                  autoPan
                  autoPanPadding={[30, 30]}
                  maxWidth={320}
                  minWidth={240}
                >
                  <PropertyMapPopup
                    item={listing}
                    onView={onView}
                  />
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}