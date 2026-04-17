"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

type Point = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  date?: string;
};

function FitBounds({
  points,
  currentLocation,
}: {
  points: Point[];
  currentLocation?: { lat: number; lng: number } | null;
}) {
  const map = useMap();

  useEffect(() => {
    const allPoints: [number, number][] = [
      ...points.map((p) => [p.lat, p.lng] as [number, number]),
      ...(currentLocation
        ? [[currentLocation.lat, currentLocation.lng] as [number, number]]
        : []),
    ];

    if (allPoints.length === 0) return;

    if (allPoints.length === 1) {
      map.setView(allPoints[0], 7);
      return;
    }

    map.fitBounds(allPoints, { padding: [30, 30] });
  }, [map, points, currentLocation]);

  return null;
}

export default function TripMapLeaflet({
  points,
  currentLocation,
  onPointClick,
}: {
  points: Point[];
  currentLocation?: { lat: number; lng: number } | null;
  onPointClick?: (id: string) => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const polylinePositions = useMemo<[number, number][]>(
    () => points.map((p) => [p.lat, p.lng]),
    [points]
  );

  if (!points.length) {
    return (
      <div style={{ color: "gray", padding: 8 }}>
        지도에 표시할 location이 아직 없습니다.
      </div>
    );
  }

  if (!mounted) {
    return (
      <div style={{ color: "gray", padding: 8 }}>
        지도를 불러오는 중...
      </div>
    );
  }

  return (
    <div style={{ overflow: "hidden", borderRadius: 16 }}>
      <MapContainer
        center={[37, -96]}
        zoom={4}
        style={{ height: 360, width: "100%" }}
      >
        <FitBounds points={points} currentLocation={currentLocation} />

        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {polylinePositions.length > 1 && (
          <Polyline positions={polylinePositions} />
        )}

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
            pathOptions={{ weight: 2 }}
          >
            <Popup>Current location</Popup>
          </CircleMarker>
        ) : null}
      </MapContainer>
    </div>
  );
}