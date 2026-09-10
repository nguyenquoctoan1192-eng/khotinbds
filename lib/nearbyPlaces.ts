import type { NearbyPlace } from "@/lib/socialListingContent";

type OSMElement = {
  type: "node" | "way" | "relation";
  id: number;

  lat?: number;
  lon?: number;

  center?: {
    lat: number;
    lon: number;
  };

  tags?: Record<string, string>;
};

const OVERPASS_ENDPOINT =
  "https://overpass-api.de/api/interpreter";

const CATEGORY_RULES = [
  {
    category: "university",
    query: `
      nwr["amenity"="university"](around:R,LAT,LNG);
    `,
  },
  {
    category: "school",
    query: `
      nwr["amenity"="school"](around:R,LAT,LNG);
    `,
  },
  {
    category: "hospital",
    query: `
      nwr["amenity"="hospital"](around:R,LAT,LNG);
    `,
  },
  {
    category: "park",
    query: `
      nwr["leisure"="park"](around:R,LAT,LNG);
    `,
  },
  {
    category: "sports",
    query: `
      nwr["leisure"="sports_centre"](around:R,LAT,LNG);
      nwr["leisure"="stadium"](around:R,LAT,LNG);
    `,
  },
  {
    category: "market",
    query: `
      nwr["amenity"="marketplace"](around:R,LAT,LNG);
    `,
  },
  {
    category: "mall",
    query: `
      nwr["shop"="mall"](around:R,LAT,LNG);
    `,
  },
  {
    category: "transit",
    query: `
      nwr["public_transport"="station"](around:R,LAT,LNG);
      nwr["railway"="station"](around:R,LAT,LNG);
    `,
  },
  {
    category: "residential",
    query: `
      nwr["place"="neighbourhood"](around:R,LAT,LNG);
      nwr["place"="suburb"](around:R,LAT,LNG);
    `,
  },
];

function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  const earthRadius = 6371000;

  const dLat =
    ((lat2 - lat1) * Math.PI) / 180;

  const dLng =
    ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  return (
    2 *
    earthRadius *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a),
    )
  );
}

function getElementCoordinates(
  element: OSMElement,
) {
  if (
    typeof element.lat === "number" &&
    typeof element.lon === "number"
  ) {
    return {
      lat: element.lat,
      lng: element.lon,
    };
  }

  if (
    typeof element.center?.lat === "number" &&
    typeof element.center?.lon === "number"
  ) {
    return {
      lat: element.center.lat,
      lng: element.center.lon,
    };
  }

  return null;
}

async function fetchCategory(
  category: string,
  query: string,
  latitude: number,
  longitude: number,
) {
  const radius = 1800;

  const body = `
[out:json][timeout:8];
(
  ${query
    .replaceAll("R", String(radius))
    .replaceAll("LAT", String(latitude))
    .replaceAll("LNG", String(longitude))}
);
out center tags;
`;

  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    9000,
  );

  try {
    const response = await fetch(
      OVERPASS_ENDPOINT,
      {
        method: "POST",
        headers: {
          "content-type":
            "application/x-www-form-urlencoded;charset=UTF-8",
          "user-agent":
            "KhotinBDS/1.0 real-estate-nearby-poi",
        },
        body: new URLSearchParams({
          data: body,
        }),
        signal: controller.signal,
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return [];
    }

    const json =
      (await response.json()) as {
        elements?: OSMElement[];
      };

    return (json.elements ?? [])
      .map((element) => {
        const coordinates =
          getElementCoordinates(element);

        const name =
          element.tags?.name ||
          element.tags?.["name:vi"] ||
          "";

        if (!coordinates || !name) {
          return null;
        }

        return {
          name,
          category,
          distanceMeters: Math.round(
            distanceMeters(
              latitude,
              longitude,
              coordinates.lat,
              coordinates.lng,
            ),
          ),
        } satisfies NearbyPlace;
      })
      .filter(
        (
          item,
        ): item is NearbyPlace =>
          Boolean(item),
      );
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function getNearbyPlaces(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
) {
  if (
    latitude === null ||
    latitude === undefined ||
    longitude === null ||
    longitude === undefined
  ) {
    return [];
  }

  if (
    !Number.isFinite(Number(latitude)) ||
    !Number.isFinite(Number(longitude))
  ) {
    return [];
  }

  const lat = Number(latitude);
  const lng = Number(longitude);

  const results =
    await Promise.all(
      CATEGORY_RULES.map((rule) =>
        fetchCategory(
          rule.category,
          rule.query,
          lat,
          lng,
        ),
      ),
    );

  const all = results.flat();

  const seen = new Set<string>();

  return all
    .filter((place) => {
      const key = place.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .sort(
      (a, b) =>
        (a.distanceMeters ?? 999999) -
        (b.distanceMeters ?? 999999),
    )
    .slice(0, 12);
}