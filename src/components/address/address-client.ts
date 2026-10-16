import {
  DEFAULT_PORTO_POSITION,
  geoJsonPointFromLatLng,
  type AddressEditorValue,
} from "./address-editor";
import {
  isValidCustomerMobile,
  isValidCustomerName,
  normalizeCustomerMobile,
  normalizeCustomerName,
} from "@/validations/customer-identity";
import {
  isPortuguesePostalCode,
  normalizePortuguesePostalCode,
} from "@/validations/portuguese-postal";

export type CustomerAddress = AddressEditorValue & Readonly<{ id: string; version: number }>;

export const EMPTY_CUSTOMER_ADDRESS: AddressEditorValue = {
  name: "",
  recipientName: "",
  recipientMobile: "",
  formattedAddress: "",
  location: geoJsonPointFromLatLng(
    DEFAULT_PORTO_POSITION.latitude,
    DEFAULT_PORTO_POSITION.longitude,
  ),
  postalCode: "",
  deliveryNotes: null,
  isDefault: false,
};

export function responseData(value: unknown): unknown {
  return typeof value === "object" && value !== null && "data" in value
    ? (value as { data: unknown }).data
    : null;
}

export function parseCustomerAddress(value: unknown): CustomerAddress | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const location = item.location as { type?: unknown; coordinates?: unknown } | undefined;
  if (
    typeof item.id !== "string" ||
    typeof item.name !== "string" ||
    typeof item.recipientName !== "string" ||
    typeof item.recipientMobile !== "string" ||
    typeof item.formattedAddress !== "string" ||
    typeof item.postalCode !== "string" ||
    !location ||
    location.type !== "Point" ||
    !Array.isArray(location.coordinates) ||
    location.coordinates.length !== 2 ||
    !location.coordinates.every(
      (coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate),
    )
  )
    return null;
  return {
    id: item.id,
    version: typeof item.version === "number" ? item.version : 0,
    name: item.name,
    recipientName: item.recipientName,
    recipientMobile: item.recipientMobile,
    formattedAddress: item.formattedAddress,
    postalCode: item.postalCode,
    deliveryNotes: typeof item.deliveryNotes === "string" ? item.deliveryNotes : null,
    isDefault: item.isDefault === true,
    location: {
      type: "Point",
      coordinates: [Number(location.coordinates[0]), Number(location.coordinates[1])],
    },
  };
}

export function validateCustomerAddress(value: AddressEditorValue): boolean {
  const name = normalizeCustomerName(value.name);
  const recipientName = normalizeCustomerName(value.recipientName);
  const mobile = normalizeCustomerMobile(value.recipientMobile);
  const formattedAddress = value.formattedAddress.trim();
  const postalCode = normalizePortuguesePostalCode(value.postalCode);
  const [longitude, latitude] = value.location.coordinates;
  return (
    name.length <= 80 &&
    isValidCustomerName(name) &&
    recipientName.length <= 160 &&
    isValidCustomerName(recipientName) &&
    isValidCustomerMobile(mobile) &&
    formattedAddress.length >= 5 &&
    formattedAddress.length <= 500 &&
    isPortuguesePostalCode(postalCode) &&
    (value.deliveryNotes?.length ?? 0) <= 500 &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90
  );
}
