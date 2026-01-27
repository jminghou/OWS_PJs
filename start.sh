#!/bin/bash

# =============================================================================
# Production Start Script
# =============================================================================
# This script runs database migrations before starting the web server.
# Used by Railway and other deployment platforms.

set -e

echo "=== Running database migrations ==="
flask db upgrade

echo "=== Starting Gunicorn server ==="
exec gunicorn -w 4 -b 0.0.0.0:$PORT "sites.Polaris_Parent.backend.app:app"
