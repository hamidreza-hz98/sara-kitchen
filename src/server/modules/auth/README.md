# Auth

Owns credential verification orchestration, login, logout, signup coordination, password reset/change flows, and actor resolution. It may consume the public APIs of Admins, Customers, and Sessions. Password hashes remain owned by the relevant identity module; session persistence remains owned by Sessions.
