"use client";
export const dynamic = "force-dynamic";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Popup,
  Polyline,
  CircleMarker,
  useMap,
} from "react-leaflet";

export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  date?: string;
};

type Props = {
  points: MapPoint[];
  onPointClick?: (id: string) => void;
  currentLocation?: { lat: number; lng: number } | null;
};

function FitBounds({
  points,
  currentLocation,
}: {
  points: MapPoint[];
  currentLocation?: { lat: number; lng: number } | null;
}) {
  const map = useMap();

  useEffect(() => {
    const bounds: [number, number][] = points.map((p) => [p.lat, p.lng]);

    if (currentLocation) {
      bounds.push([currentLocation.lat, currentLocation.lng]);
    }

    if (!bounds.length) return;

    map.fitBounds(bounds, { padding: [20, 20] });
  }, [map, points, currentLocation]);

  return null;
}

export default function TripMapLeaflet({
  points,
  onPointClick,
  currentLocation,
}: Props) {
  if (!points.length && !currentLocation) {
    return (
      <div style={{ color: "gray", padding: 8 }}>
        지도에 표시할 location이 아직 없습니다.
      </div>
    );
  }

  const polylinePositions: [number, number][] = points.map((p) => [p.lat, p.lng]);

  return (
    <div style={{ overflow: "hidden", borderRadius: 16 }}>
      <MapContainer center={[37, -96]} zoom={4} style={{ height: 360, width: "100%" }}>
        <FitBounds points={points} currentLocation={currentLocation} />

        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {points.map((p, i) => (
          <CircleMarker
            key={`${p.id}-${i}`}
            center={[p.lat, p.lng]}
            radius={8}
            pathOptions={{ weight: 2 }}
            eventHandlers={{
              click: () => onPointClick?.(p.id),
            }}
          >
            <Popup>
              <div>
                <div style={{ fontWeight: 700 }}>{p.label}</div>
                {p.date ? <div style={{ marginTop: 4 }}>{p.date}</div> : null}
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {currentLocation ? (
          <CircleMarker
            center={[currentLocation.lat, currentLocation.lng]}
            radius={9}
            pathOptions={{
              weight: 3,
              color: "#2563eb",
              fillColor: "#60a5fa",
              fillOpacity: 0.9,
            }}
          >
            <Popup>현재 위치</Popup>
          </CircleMarker>
        ) : null}

        {polylinePositions.length >= 2 ? <Polyline positions={polylinePositions} /> : null}
      </MapContainer>
    </div>
  );
}