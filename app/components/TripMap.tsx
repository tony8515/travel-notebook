"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { MapPoint } from "./TripMapLeaflet";

const TripMapLeaflet = dynamic(() => import("./TripMapLeaflet"), {
  ssr: false,
});

type Props = {
  points: MapPoint[];
  onPointClick?: (id: string) => void;
  currentLocation?: { lat: number; lng: number } | null;
};

export default function TripMap(props: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return <TripMapLeaflet {...props} />;
}