#!/bin/bash

# =============================================================================
# Production Start Script
# =============================================================================
# This script runs database migrations before starting the web server.
# Used by Railway and other deployment platforms.

set -e

# Set Flask app for CLI commands
export FLASK_APP=sites.Polaris_Parent.backend.app:app

echo "=== Running database migrations ==="
echo "FLASK_APP=$FLASK_APP"
flask db upgrade --directory sites/Polaris_Parent/backend/migrations

echo "=== Starting Gunicorn server ==="
exec gunicorn -w 4 -b 0.0.0.0:$PORT "sites.Polaris_Parent.backend.app:app"
