"""Create dedicated local acceptance identity; never alter existing users."""
import json
import os
import secrets
import sys
from pathlib import Path
from datetime import datetime
SITE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SITE.parents[1]))
os.environ['FLASK_SKIP_DOTENV'] = '1'
os.environ['REPORT_JOBS_ENABLED'] = 'false'
from sites.Polaris_Parent.backend.app import app
from core.backend_engine.factory import db
from core.backend_engine.models import User
from sqlalchemy.engine import make_url

with app.app_context():
    output = SITE / '.local-private/acceptance.json'
    assert not output.exists(), 'Use existing acceptance credentials; do not create duplicates'
    assert make_url(app.config['SQLALCHEMY_DATABASE_URI']).host in ('localhost', '127.0.0.1')
    stamp = datetime.now().strftime('%Y%m%d%H%M%S')
    username = f'fulfilment-{stamp}@example.test'
    assert User.query.filter_by(username=username).first() is None
    password = secrets.token_urlsafe(24) + 'Aa1!'
    user = User(username=username, email=username, role='admin', is_active=True)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    output.write_text(json.dumps({'admin': username, 'password': password, 'admin_id': user.id,
                                 'run': stamp}), encoding='utf-8')
    print('Created dedicated local acceptance admin:', user.id)
