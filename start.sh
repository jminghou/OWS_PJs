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

echo "=== Creating default admin if not exists ==="
python -c "
from sites.Polaris_Parent.backend.app import app
from core.backend_engine.factory import db
from core.backend_engine.models import User
import os

with app.app_context():
    # Check if admin already exists
    admin = User.query.filter_by(role='admin').first()
    if admin:
        print('Admin already exists, skipping')
    else:
        admin_email = os.environ.get('ADMIN_EMAIL')
        admin_password = os.environ.get('ADMIN_PASSWORD')
        admin_username = os.environ.get('ADMIN_USERNAME', 'admin')

        if admin_email and admin_password:
            user = User(
                username=admin_username,
                email=admin_email,
                role='admin',
                is_active=True
            )
            user.set_password(admin_password)
            db.session.add(user)
            db.session.commit()
            print(f'Default admin ({admin_username}) created successfully!')
        else:
            print('ADMIN_EMAIL or ADMIN_PASSWORD not set, skipping admin creation')
"

echo "=== Starting Gunicorn server ==="
exec gunicorn -w 4 -b 0.0.0.0:$PORT "sites.Polaris_Parent.backend.app:app"
