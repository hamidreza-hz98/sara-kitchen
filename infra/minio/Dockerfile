FROM golang:1.24.8-alpine3.22 AS builder

ARG TARGETARCH=amd64
ARG MINIO_RELEASE=RELEASE.2025-10-15T17-29-55Z
ARG MINIO_COMMIT=9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a

RUN apk add --no-cache ca-certificates git

WORKDIR /source

RUN git init && \
    git remote add origin https://github.com/minio/minio.git && \
    git fetch --depth 1 origin "refs/tags/${MINIO_RELEASE}:refs/tags/${MINIO_RELEASE}" && \
    git checkout --detach "${MINIO_RELEASE}" && \
    test "$(git rev-parse HEAD)" = "${MINIO_COMMIT}" && \
    test "$(git describe --tags --exact-match)" = "${MINIO_RELEASE}"

RUN CGO_ENABLED=0 GOOS=linux GOARCH="${TARGETARCH}" \
    go build -tags kqueue -trimpath \
    --ldflags "$(go run buildscripts/gen-ldflags.go)" \
    -o /out/minio .

FROM alpine:3.22.2

RUN apk add --no-cache ca-certificates && \
    addgroup --system --gid 1000 minio && \
    adduser --system --uid 1000 --ingroup minio --home /nonexistent --disabled-password minio && \
    install -d -o minio -g minio /data

COPY --from=builder /out/minio /usr/local/bin/minio

USER minio:minio
EXPOSE 9000 9001
VOLUME ["/data"]
ENTRYPOINT ["/usr/local/bin/minio"]
