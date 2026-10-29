# MongoDB media provider

Set `MEDIA_STORAGE_PROVIDER=mongodb` to store new managed media in GridFS using the existing `MONGODB_URI`. MinIO settings may be omitted when no MinIO files need to be accessed. Keep all MinIO settings configured if previously stored MinIO files must remain readable. MinIO does not need to be running for new MongoDB uploads or readiness checks. Switching the variable back to `minio` makes new uploads use MinIO again; existing MongoDB files remain readable through the media provider router.

The provider stores originals and image variants in GridFS and uses the `media_object_reservations` collection to reserve keys atomically. It supports upload, stat, streaming read, delete, copy, move, health, and short lived signed read links. Media metadata records persist the selected provider. The application serves signed MongoDB files from `/api/media/file`; its signature uses `AUTH_SESSION_SECRET`, so rotating that secret expires outstanding links.

GridFS occupies space in the same MongoDB database as application data. Check the database quota before enabling this option, especially on MongoDB Atlas Free clusters. Back up the GridFS collections and `media_object_reservations` together with media metadata. Changing providers does not migrate existing objects.
