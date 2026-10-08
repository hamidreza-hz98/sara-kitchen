# Address components

`AddressEditor` is the reusable customer address form used by profile and checkout surfaces. It keeps the canonical value controlled by its parent, stores map coordinates in GeoJSON `[longitude, latitude]` order, and exposes manual coordinate inputs so map interaction and browser geolocation are never required.

The Leaflet map is client-only and uses OpenStreetMap tiles with visible attribution. Geolocation is requested only after the customer activates the button; denial leaves the editor fully usable.
