"""
Traditional Auth Blueprint

Provides session-based authentication routes (for server-rendered pages):
- /login - User login
- /logout - User logout
- /register - User registration

Note: For API authentication, use the JWT-based routes in the api blueprint.
"""

from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_user, logout_user, current_user
from datetime import datetime

from core.backend_engine.factory import db
from core.backend_engine.models import User

bp = Blueprint('auth', __name__)


@bp.route('/login', methods=['GET', 'POST'])
def login():
    """User login"""
    if current_user.is_authenticated:
        return redirect(url_for('main.index'))

    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        remember_me = request.form.get('remember_me')

        user = User.query.filter_by(username=username).first()

        if user and user.check_password(password) and user.is_active:
            user.last_login = datetime.utcnow()
            db.session.commit()

            login_user(user, remember=bool(remember_me))
            next_page = request.args.get('next')
            if not next_page or not next_page.startswith('/'):
                next_page = url_for('main.index')
            return redirect(next_page)
        else:
            flash('Invalid username or password', 'error')

    return render_template('auth/login.html')


@bp.route('/logout')
def logout():
    """User logout"""
    logout_user()
    return redirect(url_for('main.index'))


@bp.route('/register', methods=['GET', 'POST'])
def register():
    """User registration"""
    if current_user.is_authenticated:
        return redirect(url_for('main.index'))

    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')

        # Validation
        if password != confirm_password:
            flash('Password confirmation does not match', 'error')
            return render_template('auth/register.html')

        if User.query.filter_by(username=username).first():
            flash('Username already exists', 'error')
            return render_template('auth/register.html')

        if User.query.filter_by(email=email).first():
            flash('Email already exists', 'error')
            return render_template('auth/register.html')

        # Create new user
        user = User(username=username, email=email)
        try:
            user.set_password(password)
        except ValueError as e:
            flash(str(e), 'error')
            return render_template('auth/register.html')
        db.session.add(user)
        db.session.commit()

        flash('Registration successful, please login', 'success')
        return redirect(url_for('auth.login'))

    return render_template('auth/register.html')
