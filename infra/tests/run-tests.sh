#!/bin/sh
set -e

if [ ! -f "docker-compose.yml" ]; then
  echo "Expected docker-compose.yml to exist."
  exit 1
fi

if [ ! -f "Dockerfile.app" ]; then
  echo "Expected Dockerfile.app to exist."
  exit 1
fi

echo "Infra placeholder tests passed."
