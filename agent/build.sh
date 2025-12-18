#!/bin/bash

set -e

echo "Building deploy-dashboard agent..."

VERSION="${1:-dev}"

mkdir -p dist

echo "Building for Linux AMD64..."
GOOS=linux GOARCH=amd64 go build -ldflags "-s -w" -o dist/deploy-dashboard-agent-linux-amd64 main.go

echo "Building for Linux ARM64..."
GOOS=linux GOARCH=arm64 go build -ldflags "-s -w" -o dist/deploy-dashboard-agent-linux-arm64 main.go

echo "Build complete! Binaries in dist/"
ls -lh dist/
