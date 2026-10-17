import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/dynamic", () => ({
  default: () =>
    function MapFixture(props: {
      ariaLabel: string;
      descriptionId?: string;
      onPositionChange(position: { latitude: number; longitude: number }): void;
    }) {
      return (
        <button
          aria-label={props.ariaLabel}
          aria-describedby={props.descriptionId}
          onClick={() => props.onPositionChange({ latitude: 41.16, longitude: -8.62 })}
          type="button"
        >
          map
        </button>
      );
    },
}));

import {
  AddressEditor,
  geoJsonPointFromLatLng,
  latLngFromGeoJsonPoint,
  type AddressEditorValue,
} from "@/components/address";
import messages from "@/locales/messages/en";

const initial: AddressEditorValue = {
  name: "Home",
  recipientName: "Sara Kazemi",
  recipientMobile: "+351912345678",
  formattedAddress: "Rua de Santa Catarina 100, Porto",
  location: { type: "Point", coordinates: [-8.606, 41.1496] },
  postalCode: "4000-008",
  deliveryNotes: null,
  isDefault: true,
};

function Harness({ onValue }: Readonly<{ onValue?(value: AddressEditorValue): void }>) {
  const [value, setValue] = useState(initial);
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <AddressEditor
        onChange={(next) => {
          setValue(next);
          onValue?.(next);
        }}
        value={value}
      />
    </NextIntlClientProvider>
  );
}

describe("AddressEditor", () => {
  it("keeps GeoJSON longitude before latitude for map and keyboard changes", () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);

    fireEvent.click(screen.getByRole("button", { name: "Delivery location map" }));
    expect(
      screen.getByRole("button", { name: "Delivery location map" }),
    ).toHaveAccessibleDescription("Choose a point on the map or enter the coordinates below.");
    expect(onValue).toHaveBeenLastCalledWith(
      expect.objectContaining({ location: { type: "Point", coordinates: [-8.62, 41.16] } }),
    );

    const [latitude, longitude] = screen.getAllByRole("spinbutton");
    expect(latitude).toHaveAccessibleName("Latitude");
    expect(longitude).toHaveAccessibleName("Longitude");
    fireEvent.change(latitude!, { target: { value: "41.2" } });
    fireEvent.change(longitude!, { target: { value: "-8.7" } });
    expect(onValue).toHaveBeenLastCalledWith(
      expect.objectContaining({ location: { type: "Point", coordinates: [-8.7, 41.2] } }),
    );
  });

  it("remains usable and explains the fallback when geolocation is denied", () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((_success: PositionCallback, failure: PositionErrorCallback) =>
          failure({ code: 1 } as GeolocationPositionError),
        ),
      },
    });
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Use my location" }));
    expect(screen.getByRole("status")).toHaveTextContent("Location permission was denied");
    expect(screen.getByRole("textbox", { name: /Full address/u })).toBeEnabled();
    expect(screen.getAllByRole("spinbutton")).toHaveLength(2);
  });

  it("validates coordinate bounds in the conversion contract", () => {
    expect(geoJsonPointFromLatLng(41.15, -8.61)).toEqual({
      type: "Point",
      coordinates: [-8.61, 41.15],
    });
    expect(latLngFromGeoJsonPoint({ type: "Point", coordinates: [-8.61, 41.15] })).toEqual({
      latitude: 41.15,
      longitude: -8.61,
    });
    expect(() => geoJsonPointFromLatLng(91, -8.61)).toThrow(RangeError);
    expect(() => geoJsonPointFromLatLng(41.15, -181)).toThrow(RangeError);
  });
});
