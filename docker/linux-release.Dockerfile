# syntax=docker/dockerfile:1.7

FROM node:22.13.0-bookworm AS node

FROM rust:1.97.1-bookworm AS build

COPY --from=node /usr/local/ /usr/local/

ENV APPIMAGE_EXTRACT_AND_RUN=1 \
    DEBIAN_FRONTEND=noninteractive \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:/usr/local/cargo/bin:${PATH}

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libappindicator3-dev \
        librsvg2-dev \
        libwebkit2gtk-4.1-dev \
        patchelf \
        pkg-config \
        xdg-utils \
    && rm -rf /var/lib/apt/lists/*

RUN npm install --global --force pnpm@11.18.0

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/desktop/package.json apps/desktop/package.json

RUN --mount=type=cache,id=easytrim-pnpm,target=/pnpm/store \
    pnpm fetch --frozen-lockfile

COPY . .

RUN --mount=type=cache,id=easytrim-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline

RUN --mount=type=cache,id=easytrim-cargo-registry,target=/usr/local/cargo/registry \
    --mount=type=cache,id=easytrim-cargo-git,target=/usr/local/cargo/git \
    --mount=type=cache,id=easytrim-linux-target,target=/workspace/target \
    pnpm release:local -- --platform linux --no-upload --output /release-artifacts

FROM scratch AS artifacts

COPY --from=build /release-artifacts/ /
