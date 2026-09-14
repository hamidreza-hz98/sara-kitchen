# Orders

Owns order codes, immutable customer/address/item/pricing snapshots, status machine/history, fulfillment timing, and checkout transaction boundaries. It may consume public APIs from Carts, Customers, Addresses, Dishes, and Transactions. It never imports those modules’ models or repositories.
