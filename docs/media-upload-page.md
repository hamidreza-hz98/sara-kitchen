# Media upload page

`/dashboard/media/upload` requires the `media:create` permission. It uses the existing
single-file `POST /api/media` endpoint through the bounded bulk coordinator. Each
file is an independent request; a failed item does not roll back a successful one.

The current serverless inline policy allows JPEG, PNG, WebP, and AVIF images up to
3 MiB each and 10 files per selection. Video and PDF uploads remain unsupported
until background processing is available. The browser checks filename, extension,
declared MIME type, size, empty files, and duplicate selection; the server checks
bytes and signatures authoritatively. A checksum conflict is shown as an existing
library item rather than silently uploading again.

English alt text is required. Portuguese and Persian alt text are optional and can
be edited in the queue before upload. The page displays per-file and overall
progress, retries transient transport failures through the coordinator, permits
manual retry of failed files, and cancels active requests through an abort signal.
It warns on same-origin link navigation and full-page unload while unsubmitted or
failed files remain. Successful rows remain visible with a result summary; clearing
the list never deletes uploaded media.
