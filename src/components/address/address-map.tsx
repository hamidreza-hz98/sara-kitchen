"use client";

import Box from "@mui/material/Box";
import { useEffect } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";

export type AddressMapPosition = Readonly<{ latitude: number; longitude: number }>;

export type AddressMapProps = Readonly<{
  position: AddressMapPosition;
  onPositionChange(position: AddressMapPosition): void;
  ariaLabel: string;
  descriptionId?: string;
  disabled?: boolean;
}>;

function MapEvents({
  disabled,
  onPositionChange,
}: Pick<AddressMapProps, "disabled" | "onPositionChange">) {
  useMapEvents({
    click(event) {
      if (!disabled) onPositionChange({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    },
  });
  return null;
}

function Recenter({ position }: Readonly<{ position: AddressMapPosition }>) {
  const map = useMap();
  useEffect(() => {
    map.panTo([position.latitude, position.longitude], { animate: false });
  }, [map, position.latitude, position.longitude]);
  return null;
}

export function AddressMap({
  position,
  onPositionChange,
  ariaLabel,
  descriptionId,
  disabled,
}: AddressMapProps) {
  return (
    <Box
      aria-label={ariaLabel}
      aria-describedby={descriptionId}
      role="region"
      sx={{
        blockSize: { xs: 280, md: 360 },
        border: 1,
        borderColor: "divider",
        borderRadius: 3,
        overflow: "hidden",
        "& .leaflet-container": { blockSize: "100%", inlineSize: "100%", zIndex: 0 },
      }}
    >
      <MapContainer
        center={[position.latitude, position.longitude]}
        zoom={15}
        keyboard
        scrollWheelZoom={!disabled}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <CircleMarker
          center={[position.latitude, position.longitude]}
          pathOptions={{ color: "#2D2D4F", fillColor: "#FF6161", fillOpacity: 1 }}
          radius={10}
        />
        <Recenter position={position} />
        <MapEvents
          {...(disabled === undefined ? {} : { disabled })}
          onPositionChange={onPositionChange}
        />
      </MapContainer>
    </Box>
  );
}
