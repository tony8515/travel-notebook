"use client";

import { useEffect, useState } from "react";

type MapPoint = {
  lat: number;
  lng: number;
  label: string;
};

export default function TripMap({ mapPoints }: { mapPoints: MapPoint[] }) {
  const [Map, setMap] = useState<any>(null);

  useEffect(() => {
    const loadMap = async () => {
      const L = await import("leaflet");
      const RL = await import("react-leaflet");

      const {
        MapContainer,
        TileLayer,
        Marker,
        Popup,
        Polyline,
      } = RL;

      setMap(() => ({
        MapContainer,
        TileLayer,
        Marker,
        Popup,
        Polyline,
      }));
    };

    loadMap();
  }, []);

  if (!Map) return <div>Loading map...</div>;

  if (!mapPoints.length) {
    return <div style={{ color: "gray" }}>지도에 표시할 location이 아직 없습니다.</div>;
  }

  const { MapContainer, TileLayer, Marker, Popup, Polyline } = Map;

  const mapCenter: [number, number] = [mapPoints[0].lat, mapPoints[0].lng];
  const polylinePositions: [number, number][] = mapPoints.map((p) => [p.lat, p.lng]);

  return (
    <MapContainer
      center={mapCenter}
      zoom={5}
      style={{ height: 400, width: "100%", borderRadius: 16 }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {mapPoints.map((p, i) => (
        <Marker key={i} position={[p.lat, p.lng]}>
          <Popup>{p.label}</Popup>
        </Marker>
      ))}

      <Polyline positions={polylinePositions} />
    </MapContainer>
  );
}