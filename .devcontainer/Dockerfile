FROM mcr.microsoft.com/devcontainers/javascript-node:22

RUN apt-get update && apt-get install -y \
    git \
    curl \
    wget \
    jq \
    ripgrep \
    fd-find \
    build-essential \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*