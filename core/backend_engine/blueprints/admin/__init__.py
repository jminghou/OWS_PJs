"""
Admin Blueprint

Provides traditional server-rendered admin panel routes:
- / - Dashboard
- /contents - Content management
- /categories - Category management
- /users - User management
- /comments - Comment management
- /settings - System settings

Note: For modern SPA admin panels, use the API blueprint instead.
"""

from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_required, current_user
from functools import wraps
from datetime import datetime

from core.backend_engine.factory import db
from core.backend_engine.models import Content, Category, User, Tag, Comment, Setting

bp = Blueprint('admin', __name__)


def admin_required(f):
    """Admin permission decorator"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or not current_user.is_admin():
            flash('Admin permission required', 'error')
            return redirect(url_for('main.index'))
        return f(*args, **kwargs)
    return decorated_function


def editor_required(f):
    """Editor permission decorator"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or not current_user.is_editor():
            flash('Editor permission required', 'error')
            return redirect(url_for('main.index'))
        return f(*args, **kwargs)
    return decorated_function


@bp.route('/')
@login_required
@editor_required
def dashboard():
    """Admin dashboard"""
    stats = {
        'total_contents': Content.query.count(),
        'published_contents': Content.query.filter_by(status='published').count(),
        'draft_contents': Content.query.filter_by(status='draft').count(),
        'total_users': User.query.count(),
        'pending_comments': Comment.query.filter_by(status='pending').count(),
        'total_categories': Category.query.count()
    }

    recent_contents = Content.query.order_by(Content.created_at.desc()).limit(5).all()
    recent_comments = Comment.query.order_by(Comment.created_at.desc()).limit(10).all()

    return render_template('admin/dashboard.html',
                           stats=stats,
                           recent_contents=recent_contents,
                           recent_comments=recent_comments)


# Content management
@bp.route('/contents')
@login_required
@editor_required
def content_list():
    """Content list"""
    page = request.args.get('page', 1, type=int)
    status = request.args.get('status')
    category_id = request.args.get('category_id', type=int)

    query = Content.query

    if not current_user.is_admin():
        query = query.filter_by(author_id=current_user.id)

    if status:
        query = query.filter_by(status=status)

    if category_id:
        query = query.filter_by(category_id=category_id)

    contents = query.order_by(Content.created_at.desc()).paginate(
        page=page, per_page=20, error_out=False
    )

    categories = Category.query.filter_by(is_active=True).all()

    return render_template('admin/content_list.html',
                           contents=contents,
                           categories=categories)


@bp.route('/contents/new', methods=['GET', 'POST'])
@login_required
@editor_required
def content_create():
    """Create new content"""
    if request.method == 'POST':
        content = Content(
            title=request.form.get('title'),
            content=request.form.get('content'),
            summary=request.form.get('summary'),
            slug=request.form.get('slug'),
            status=request.form.get('status', 'draft'),
            content_type=request.form.get('content_type', 'article'),
            category_id=request.form.get('category_id', type=int),
            author_id=current_user.id,
            meta_title=request.form.get('meta_title'),
            meta_description=request.form.get('meta_description')
        )

        if content.status == 'published':
            content.published_at = datetime.utcnow()

        db.session.add(content)
        db.session.commit()

        flash('Content created successfully', 'success')
        return redirect(url_for('admin.content_list'))

    categories = Category.query.filter_by(is_active=True).all()
    return render_template('admin/content_form.html', categories=categories)


@bp.route('/contents/<int:content_id>/edit', methods=['GET', 'POST'])
@login_required
@editor_required
def content_edit(content_id):
    """Edit content"""
    content = Content.query.get_or_404(content_id)

    if not current_user.is_admin() and content.author_id != current_user.id:
        flash('Insufficient permissions', 'error')
        return redirect(url_for('admin.content_list'))

    if request.method == 'POST':
        content.title = request.form.get('title')
        content.content = request.form.get('content')
        content.summary = request.form.get('summary')
        content.slug = request.form.get('slug')
        content.status = request.form.get('status')
        content.content_type = request.form.get('content_type')
        content.category_id = request.form.get('category_id', type=int)
        content.meta_title = request.form.get('meta_title')
        content.meta_description = request.form.get('meta_description')

        if content.status == 'published' and not content.published_at:
            content.published_at = datetime.utcnow()

        db.session.commit()

        flash('Content updated successfully', 'success')
        return redirect(url_for('admin.content_list'))

    categories = Category.query.filter_by(is_active=True).all()
    return render_template('admin/content_form.html', content=content, categories=categories)


@bp.route('/contents/<int:content_id>/delete', methods=['POST'])
@login_required
@editor_required
def content_delete(content_id):
    """Delete content"""
    content = Content.query.get_or_404(content_id)

    if not current_user.is_admin() and content.author_id != current_user.id:
        flash('Insufficient permissions', 'error')
        return redirect(url_for('admin.content_list'))

    db.session.delete(content)
    db.session.commit()

    flash('Content deleted successfully', 'success')
    return redirect(url_for('admin.content_list'))


# Category management
@bp.route('/categories')
@login_required
@admin_required
def category_list():
    """Category list"""
    categories = Category.query.all()
    return render_template('admin/category_list.html', categories=categories)


# User management
@bp.route('/users')
@login_required
@admin_required
def user_list():
    """User list"""
    page = request.args.get('page', 1, type=int)
    users = User.query.paginate(page=page, per_page=20, error_out=False)
    return render_template('admin/user_list.html', users=users)


# Comment management
@bp.route('/comments')
@login_required
@editor_required
def comment_list():
    """Comment list"""
    page = request.args.get('page', 1, type=int)
    status = request.args.get('status')

    query = Comment.query
    if status:
        query = query.filter_by(status=status)

    comments = query.order_by(Comment.created_at.desc()).paginate(
        page=page, per_page=20, error_out=False
    )

    return render_template('admin/comment_list.html', comments=comments)


@bp.route('/comments/<int:comment_id>/approve', methods=['POST'])
@login_required
@editor_required
def comment_approve(comment_id):
    """Approve comment"""
    comment = Comment.query.get_or_404(comment_id)
    comment.status = 'approved'
    db.session.commit()

    flash('Comment approved', 'success')
    return redirect(url_for('admin.comment_list'))


@bp.route('/comments/<int:comment_id>/reject', methods=['POST'])
@login_required
@editor_required
def comment_reject(comment_id):
    """Reject comment"""
    comment = Comment.query.get_or_404(comment_id)
    comment.status = 'rejected'
    db.session.commit()

    flash('Comment rejected', 'success')
    return redirect(url_for('admin.comment_list'))


# Settings management
@bp.route('/settings')
@login_required
@admin_required
def settings():
    """System settings"""
    settings = Setting.query.all()
    return render_template('admin/settings.html', settings=settings)
