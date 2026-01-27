"""
Media API Routes

Provides endpoints for media file and folder management:
- GET /media/folders - List media folders
- POST /media/folders - Create media folder
- PUT /media/folders/<id> - Update media folder
- DELETE /media/folders/<id> - Delete media folder
- GET /media - List media files
- POST /media - Upload media file
"""

from flask import jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
import os
import uuid
from werkzeug.utils import secure_filename

from core.backend_engine.factory import db
from core.backend_engine.blueprints.api import bp
from core.backend_engine.models import Media, MediaFolder, User
from core.backend_engine.schemas.media import MediaSchema, MediaFolderSchema
from core.backend_engine.services.storage import upload_file, delete_file

media_schema = MediaSchema()
medias_schema = MediaSchema(many=True)
folder_schema = MediaFolderSchema()
folders_schema = MediaFolderSchema(many=True)


# ==================== Media Folders ====================

@bp.route('/media/folders', methods=['GET'])
@jwt_required()
def api_get_media_folders():
    """Get media folder list"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user.is_editor():
        return jsonify({'message': 'Insufficient permissions'}), 403

    parent_id = request.args.get('parent_id', type=int)
    if parent_id:
        folders = MediaFolder.query.filter_by(parent_id=parent_id).all()
    else:
        folders = MediaFolder.query.filter_by(parent_id=None).all()

    return jsonify(folders_schema.dump(folders)), 200


@bp.route('/media/folders', methods=['POST'])
@jwt_required()
def api_create_media_folder():
    """Create media folder"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user.is_editor():
        return jsonify({'message': 'Insufficient permissions'}), 403

    data = request.get_json()
    name = data.get('name')
    parent_id = data.get('parent_id')

    if not name:
        return jsonify({'message': 'Folder name is required'}), 400

    if parent_id:
        parent = MediaFolder.query.get(parent_id)
        if not parent:
            return jsonify({'message': 'Parent folder does not exist'}), 404
        path = f"{parent.path.rstrip('/')}/{name}"
    else:
        path = f"/{name}"

    if MediaFolder.query.filter_by(name=name, parent_id=parent_id).first():
        return jsonify({'message': 'Folder already exists'}), 409

    folder = MediaFolder(name=name, parent_id=parent_id, path=path, created_by=user_id)
    try:
        db.session.add(folder)
        db.session.commit()
        return jsonify(folder_schema.dump(folder)), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': 'Failed to create folder'}), 500


@bp.route('/media/folders/<int:folder_id>', methods=['PUT'])
@jwt_required()
def api_update_media_folder(folder_id):
    """Update media folder"""
    user = User.query.get(int(get_jwt_identity()))
    if not user.is_editor():
        return jsonify({'message': 'Insufficient permissions'}), 403

    folder = MediaFolder.query.get_or_404(folder_id)
    data = request.get_json()
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'message': 'Folder name cannot be empty'}), 400

    if MediaFolder.query.filter(MediaFolder.name == name, MediaFolder.parent_id == folder.parent_id, MediaFolder.id != folder_id).first():
        return jsonify({'message': 'A folder with the same name already exists at this level'}), 400

    try:
        folder.name = name
        folder.path = f"{MediaFolder.query.get(folder.parent_id).path.rstrip('/')}/{name}" if folder.parent_id else f"/{name}"

        def update_child_paths(parent_folder):
            for child in parent_folder.subfolders:
                child.path = f"{parent_folder.path.rstrip('/')}/{child.name}"
                update_child_paths(child)
        update_child_paths(folder)

        db.session.commit()
        return jsonify({'message': 'Folder updated successfully', 'folder': folder_schema.dump(folder)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': 'Failed to update folder'}), 500


@bp.route('/media/folders/<int:folder_id>', methods=['DELETE'])
@jwt_required()
def api_delete_media_folder(folder_id):
    """Delete media folder"""
    user = User.query.get(int(get_jwt_identity()))
    if not user.is_editor():
        return jsonify({'message': 'Insufficient permissions'}), 403

    folder = MediaFolder.query.get_or_404(folder_id)
    if folder.media_items.count() > 0 or folder.subfolders:
        return jsonify({'message': 'Folder contains items and cannot be deleted'}), 409

    try:
        db.session.delete(folder)
        db.session.commit()
        return jsonify({'message': 'Folder deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': 'Failed to delete folder'}), 500


# ==================== Media Files ====================

@bp.route('/media', methods=['GET'])
@jwt_required()
def api_get_media():
    """Get media file list"""
    user = User.query.get(int(get_jwt_identity()))
    if not user.is_editor():
        return jsonify({'message': 'Insufficient permissions'}), 403

    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 20, type=int), 100)
    folder_id = request.args.get('folder_id', type=int)
    search = request.args.get('search')

    query = Media.query
    if folder_id:
        query = query.filter_by(folder_id=folder_id)
    if search:
        query = query.filter(Media.original_filename.ilike(f'%{search}%'))

    media_pagination = query.order_by(Media.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'media': medias_schema.dump(media_pagination.items),
        'pagination': {
            'page': media_pagination.page,
            'pages': media_pagination.pages,
            'per_page': media_pagination.per_page,
            'total': media_pagination.total
        }
    }), 200


@bp.route('/media', methods=['POST'])
@jwt_required()
def api_upload_media():
    """Upload media file"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user.is_editor():
        return jsonify({'message': 'Insufficient permissions'}), 403

    if 'file' not in request.files:
        return jsonify({'message': 'No file uploaded'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'message': 'Filename cannot be empty'}), 400

    folder_id = request.form.get('folder_id', type=int)

    try:
        file_url, filename = upload_file(file, folder='media')

        # Get file size
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)

        media = Media(
            filename=filename,
            original_filename=file.filename,
            file_path=file_url,
            file_size=file_size,
            mime_type=file.content_type,
            folder_id=folder_id,
            uploaded_by=user_id
        )

        db.session.add(media)
        db.session.commit()
        return jsonify(media_schema.dump(media)), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Upload failed: {str(e)}'}), 500
