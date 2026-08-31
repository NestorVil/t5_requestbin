#!/usr/bin/env bash
# Start Docker if it isn't running, wait for the daemon, then bring up the DBs.
set -euo pipefail

if ! docker info >/dev/null 2>&1; then
  case "$(uname -s)" in
    Darwin)
      echo "Docker daemon not running - launching Docker Desktop..."
      open -a Docker
      ;;
    Linux)
      echo "Docker daemon not running. Start it, e.g.:  sudo systemctl start docker" >&2
      exit 1
      ;;
    *)
      echo "Docker daemon not running. Please start Docker Desktop, then retry." >&2
      exit 1
      ;;
  esac

  printf "waiting for Docker"
  for _ in $(seq 1 60); do
    if docker info >/dev/null 2>&1; then
      echo " - ready"
      break
    fi
    printf "."
    sleep 1
  done

  if ! docker info >/dev/null 2>&1; then
    echo
    echo "Docker did not come up within 60s. Start Docker Desktop manually and retry." >&2
    exit 1
  fi
fi

exec docker compose up -d
