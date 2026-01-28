#!/bin/bash

# =============================================================================
# Production Start Script
# =============================================================================
# This script initializes the database and starts the web server.
# Used by Railway and other deployment platforms.

set -e

# Set Flask app for CLI commands
export FLASK_APP=sites.Polaris_Parent.backend.app:app

echo "=== Initializing database tables ==="
python -c "
from sites.Polaris_Parent.backend.app import app
from core.backend_engine.factory import db

with app.app_context():
    db.create_all()
    print('Database tables created successfully!')
"

echo "=== Starting Gunicorn server ==="
exec gunicorn -w 4 -b 0.0.0.0:$PORT "sites.Polaris_Parent.backend.app:app"
