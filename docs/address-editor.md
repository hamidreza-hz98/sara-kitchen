# Address editor and map picker

SK-0131 provides `AddressEditor`, a controlled, reusable client component for profile and checkout forms.

## Input contract

The editor owns no persistence and makes no API request. Its parent supplies an `AddressEditorValue`, receives complete values through `onChange`, and submits them through the SK-0130 APIs. This keeps create, edit, and checkout consumers on one form contract.

Address labels, recipient details, Portuguese postal code, full address, delivery notes, default selection, latitude, and longitude are native keyboard-accessible MUI controls with stable labels and error slots. All text is available in English, Portuguese, and Persian.

## Map and fallback behavior

Leaflet is loaded only in the browser. The map starts at the controlled address point, supports standard Leaflet keyboard navigation, and moves the selected marker when the customer clicks a location. OpenStreetMap attribution is present in both the Leaflet control and adjacent explanatory text.

Browser geolocation is opt-in. Denial, absence, timeout, or another failure produces a localized status message but never disables the form. Customers can always enter latitude and longitude manually, so address entry works without geolocation permission and without selecting the map.

## Coordinate safety

The UI presents latitude and longitude in the familiar order, but `geoJsonPointFromLatLng` validates their ranges and stores the canonical point as `[longitude, latitude]`. `latLngFromGeoJsonPoint` performs the inverse mapping. Shared server validation remains authoritative on submission.
