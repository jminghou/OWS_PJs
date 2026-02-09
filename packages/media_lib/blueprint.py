"""
Media Library - Flask Blueprint (API Routes)

所有端點前綴: /api/v1/media-lib

檔案管理:
    GET    /files          列出檔案
    GET    /files/<id>     取得單一檔案
    POST   /files          上傳檔案
    PUT    /files/<id>     更新 metadata
    DELETE /files/<id>     刪除檔案
    POST   /files/move     批次移動檔案

資料夾管理:
    GET    /folders        列出資料夾
    POST   /folders        建立資料夾
    PUT    /folders/<id>   更新資料夾
    DELETE /folders/<id>   刪除資料夾

標籤管理:
    GET    /tags           列出標籤
    POST   /tags           建立標籤
    DELETE /tags/<id>      刪除標籤

Metadata:
    PUT    /files/<id>/metadata     更新 metadata

公開查詢:
    GET    /public/lookup?chart_id=xxx   透過命盤ID查圖片
    GET    /public/search?status=...     搜尋
"""

import os
import mimetypes
from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity

from core.backend_engine.factory import db
from core.backend_engine.models import User
from packages.media_lib.models import MLFile, MLFileVariant, MLFolder, MLTag, MLFileMetadata
from packages.media_lib.schemas import MLFileSchema, MLFolderSchema, MLTagSchema, MLFileMetadataSchema
from packages.media_lib.storage import GCSStorage
from packages.media_lib.image_processor import is_image, get_image_dimensions, generate_variants
from packages.media_lib.utils import slugify

media_lib_bp = Blueprint('media_lib', __name__)

file_schema = MLFileSchema()
files_schema = MLFileSchema(many=True)
folder_schema = MLFolderSchema()
folders_schema = MLFolderSchema(many=True)
tag_schema = MLTagSchema()
tags_schema = MLTagSchema(many=True)


def _require_editor():
    """檢查是否為 editor 以上權限，回傳 user 或 abort。"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user or not user.is_editor():
        return None, (jsonify({'error': 'Insufficient permissions'}), 403)
    return user, None


# =============================================================================
# 檔案管理
# =============================================================================

@media_lib_bp.route('/files', methods=['GET'])
@jwt_required()
def list_files():
    """列出檔案，支援分頁、搜尋、資料夾篩選、標籤篩選。"""
    user, err = _require_editor()
    if err:
        return err

    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 20, type=int), 100)
    folder_id = request.args.get('folder_id', type=int)
    tag_id = request.args.get('tag_id', type=int)
    search = request.args.get('search', '').strip()

    query = MLFile.query

    if folder_id is not None:
        query = query.filter_by(folder_id=folder_id if folder_id != 0 else None)
    if tag_id:
        query = query.filter(MLFile.tags.any(MLTag.id == tag_id))
    if search:
        query = query.filter(MLFile.original_filename.ilike(f'%{search}%'))

    pagination = query.order_by(MLFile.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    return jsonify({
        'files': files_schema.dump(pagination.items),
        'pagination': {
            'page': pagination.page,
            'pages': pagination.pages,
            'per_page': pagination.per_page,
            'total': pagination.total,
        }
    }), 200


@media_lib_bp.route('/files/<int:file_id>', methods=['GET'])
@jwt_required()
def get_file(file_id):
    """取得單一檔案詳情。"""
    user, err = _require_editor()
    if err:
        return err

    ml_file = MLFile.query.get_or_404(file_id)
    return jsonify(file_schema.dump(ml_file)), 200


@media_lib_bp.route('/files', methods=['POST'])
@jwt_required()
def upload_file():
    """上傳檔案到 GCS，圖片類型自動產生變體。"""
    user, err = _require_editor()
    if err:
        return err

    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'Filename is empty'}), 400

    folder_id = request.form.get('folder_id', type=int)

    try:
        gcs = GCSStorage.get_instance()

        # 讀取檔案內容到記憶體
        file_data = file.read()
        file_size = len(file_data)
        mime_type = file.content_type or 'application/octet-stream'

        # 上傳原圖到 GCS
        file.seek(0)
        public_url, gcs_path, unique_name = gcs.upload(
            file, file.filename, content_type=mime_type
        )

        # 取得圖片尺寸
        width, height = None, None
        if is_image(mime_type):
            width, height = get_image_dimensions(file_data)

        # 建立資料庫記錄
        ml_file = MLFile(
            filename=unique_name,
            original_filename=file.filename,
            gcs_path=gcs_path,
            public_url=public_url,
            file_size=file_size,
            mime_type=mime_type,
            width=width,
            height=height,
            folder_id=folder_id,
            uploaded_by=user.id,
        )
        db.session.add(ml_file)
        db.session.flush()  # 取得 ml_file.id

        # 自動建立 metadata 記錄
        metadata = MLFileMetadata(file_id=ml_file.id)
        db.session.add(metadata)

        # 產生圖片變體
        if is_image(mime_type):
            variants = generate_variants(file_data, mime_type)
            for v in variants:
                # 變體的 GCS 路徑：在原檔路徑前加上變體類型前綴
                base_path = os.path.dirname(gcs_path)
                variant_gcs_path = f'{base_path}/{v["variant_type"]}_{unique_name}'
                # 如果副檔名不同，替換
                if v['ext'] != os.path.splitext(unique_name)[1]:
                    variant_gcs_path = os.path.splitext(variant_gcs_path)[0] + v['ext']

                variant_url = gcs.upload_bytes(
                    v['data'], variant_gcs_path, v['content_type']
                )

                variant_record = MLFileVariant(
                    file_id=ml_file.id,
                    variant_type=v['variant_type'],
                    gcs_path=variant_gcs_path,
                    public_url=variant_url,
                    width=v['width'],
                    height=v['height'],
                    file_size=v['file_size'],
                )
                db.session.add(variant_record)

        db.session.commit()

        return jsonify(file_schema.dump(ml_file)), 201

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Upload failed: {e}')
        return jsonify({'error': f'Upload failed: {str(e)}'}), 500


@media_lib_bp.route('/files/<int:file_id>', methods=['PUT'])
@jwt_required()
def update_file(file_id):
    """更新檔案 metadata（alt_text, caption, folder_id, tags）。"""
    user, err = _require_editor()
    if err:
        return err

    ml_file = MLFile.query.get_or_404(file_id)
    data = request.get_json()

    if 'alt_text' in data:
        ml_file.alt_text = data['alt_text']
    if 'caption' in data:
        ml_file.caption = data['caption']
    if 'folder_id' in data:
        ml_file.folder_id = data['folder_id'] or None

    # 更新標籤
    if 'tag_ids' in data:
        tags = MLTag.query.filter(MLTag.id.in_(data['tag_ids'])).all()
        ml_file.tags = tags

    try:
        db.session.commit()
        return jsonify(file_schema.dump(ml_file)), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Update failed'}), 500


@media_lib_bp.route('/files/<int:file_id>', methods=['DELETE'])
@jwt_required()
def delete_file(file_id):
    """刪除檔案及其所有 GCS 上的變體。"""
    user, err = _require_editor()
    if err:
        return err

    ml_file = MLFile.query.get_or_404(file_id)

    try:
        gcs = GCSStorage.get_instance()

        # 刪除 GCS 上的所有變體
        for variant in ml_file.variants:
            gcs.delete(variant.gcs_path)

        # 刪除 GCS 上的原檔
        gcs.delete(ml_file.gcs_path)

        # 刪除資料庫記錄
        db.session.delete(ml_file)
        db.session.commit()

        return jsonify({'message': 'File deleted'}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Delete failed: {e}')
        return jsonify({'error': 'Delete failed'}), 500


@media_lib_bp.route('/files/move', methods=['POST'])
@jwt_required()
def move_files():
    """批次移動檔案到目標資料夾。"""
    user, err = _require_editor()
    if err:
        return err

    data = request.get_json()
    file_ids = data.get('file_ids', [])
    target_folder_id = data.get('folder_id')  # None = 移到根目錄

    if not file_ids:
        return jsonify({'error': 'No files specified'}), 400

    if target_folder_id is not None:
        folder = MLFolder.query.get(target_folder_id)
        if not folder:
            return jsonify({'error': 'Target folder not found'}), 404

    try:
        MLFile.query.filter(MLFile.id.in_(file_ids)).update(
            {'folder_id': target_folder_id}, synchronize_session='fetch'
        )
        db.session.commit()
        return jsonify({'message': f'{len(file_ids)} files moved'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Move failed'}), 500


# =============================================================================
# 資料夾管理
# =============================================================================

@media_lib_bp.route('/folders', methods=['GET'])
@jwt_required()
def list_folders():
    """列出資料夾。"""
    user, err = _require_editor()
    if err:
        return err

    # ?all=true 回傳所有資料夾（前端建構樹狀結構用）
    if request.args.get('all') == 'true':
        folders = MLFolder.query.order_by(MLFolder.path).all()
        return jsonify(folders_schema.dump(folders)), 200

    parent_id = request.args.get('parent_id', type=int)
    if parent_id:
        folders = MLFolder.query.filter_by(parent_id=parent_id).all()
    else:
        # 取得所有根資料夾
        folders = MLFolder.query.filter_by(parent_id=None).all()

    return jsonify(folders_schema.dump(folders)), 200


@media_lib_bp.route('/folders', methods=['POST'])
@jwt_required()
def create_folder():
    """建立資料夾。"""
    user, err = _require_editor()
    if err:
        return err

    data = request.get_json()
    name = data.get('name', '').strip()
    parent_id = data.get('parent_id')

    if not name:
        return jsonify({'error': 'Folder name is required'}), 400

    # 計算路徑
    if parent_id:
        parent = MLFolder.query.get(parent_id)
        if not parent:
            return jsonify({'error': 'Parent folder not found'}), 404
        path = f"{parent.path.rstrip('/')}/{name}"
    else:
        path = f'/{name}'

    # 重名檢查
    if MLFolder.query.filter_by(name=name, parent_id=parent_id).first():
        return jsonify({'error': 'Folder already exists'}), 409

    description = data.get('description', '').strip() or None
    thumbnail_id = data.get('thumbnail_id')

    folder = MLFolder(name=name, parent_id=parent_id, path=path, created_by=user.id,
                      description=description, thumbnail_id=thumbnail_id)

    try:
        db.session.add(folder)
        db.session.commit()
        return jsonify(folder_schema.dump(folder)), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create folder'}), 500


@media_lib_bp.route('/folders/<int:folder_id>', methods=['PUT'])
@jwt_required()
def update_folder(folder_id):
    """更新資料夾名稱（自動更新子資料夾路徑）。"""
    user, err = _require_editor()
    if err:
        return err

    folder = MLFolder.query.get_or_404(folder_id)
    data = request.get_json()
    name = data.get('name', folder.name).strip()

    if not name:
        return jsonify({'error': 'Folder name is required'}), 400

    # 更新 description 和 thumbnail_id（若有傳入）
    if 'description' in data:
        folder.description = data['description'].strip() if data['description'] else None
    if 'thumbnail_id' in data:
        folder.thumbnail_id = data['thumbnail_id']

    # 更新 parent_id（移動資料夾）
    new_parent_id = folder.parent_id
    if 'parent_id' in data:
        target_parent_id = data['parent_id']
        # 不能把自己移到自己底下
        if target_parent_id == folder_id:
            return jsonify({'error': 'Cannot move folder into itself'}), 400
        # 驗證目標父資料夾存在
        if target_parent_id is not None:
            target_parent = MLFolder.query.get(target_parent_id)
            if not target_parent:
                return jsonify({'error': 'Target parent folder not found'}), 404
            # 不能移到自己的子孫底下（會形成循環）
            def is_descendant(ancestor_id, folder_to_check):
                for child in folder_to_check.subfolders:
                    if child.id == ancestor_id:
                        return True
                    if is_descendant(ancestor_id, child):
                        return True
                return False
            if is_descendant(target_parent_id, folder):
                return jsonify({'error': 'Cannot move folder into its own subfolder'}), 400
        new_parent_id = target_parent_id

    # 重名檢查（在目標父資料夾下）
    existing = MLFolder.query.filter(
        MLFolder.name == name,
        MLFolder.parent_id == new_parent_id,
        MLFolder.id != folder_id
    ).first()
    if existing:
        return jsonify({'error': 'A folder with this name already exists'}), 409

    try:
        folder.name = name
        folder.parent_id = new_parent_id
        if folder.parent_id is not None:
            parent = MLFolder.query.get(folder.parent_id)
            folder.path = f"{parent.path.rstrip('/')}/{name}"
        else:
            folder.path = f'/{name}'

        # 遞迴更新子資料夾路徑
        def update_children(parent_folder):
            for child in parent_folder.subfolders:
                child.path = f"{parent_folder.path.rstrip('/')}/{child.name}"
                update_children(child)
        update_children(folder)

        db.session.commit()
        return jsonify(folder_schema.dump(folder)), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Update failed'}), 500


@media_lib_bp.route('/folders/<int:folder_id>', methods=['DELETE'])
@jwt_required()
def delete_folder(folder_id):
    """刪除空資料夾。"""
    user, err = _require_editor()
    if err:
        return err

    folder = MLFolder.query.get_or_404(folder_id)

    if folder.files.count() > 0:
        return jsonify({'error': 'Folder contains files'}), 409
    if folder.subfolders.count() > 0:
        return jsonify({'error': 'Folder contains subfolders'}), 409

    try:
        db.session.delete(folder)
        db.session.commit()
        return jsonify({'message': 'Folder deleted'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Delete failed'}), 500


# =============================================================================
# 標籤管理
# =============================================================================

@media_lib_bp.route('/tags', methods=['GET'])
@jwt_required()
def list_tags():
    """列出所有標籤。"""
    user, err = _require_editor()
    if err:
        return err

    all_tags = MLTag.query.order_by(MLTag.name).all()
    return jsonify(tags_schema.dump(all_tags)), 200


@media_lib_bp.route('/tags', methods=['POST'])
@jwt_required()
def create_tag():
    """建立標籤。"""
    user, err = _require_editor()
    if err:
        return err

    data = request.get_json()
    name = data.get('name', '').strip()
    color = data.get('color', '#6366f1')

    if not name:
        return jsonify({'error': 'Tag name is required'}), 400

    slug = slugify(name)
    if MLTag.query.filter_by(slug=slug).first():
        return jsonify({'error': 'Tag already exists'}), 409

    tag = MLTag(name=name, slug=slug, color=color)

    try:
        db.session.add(tag)
        db.session.commit()
        return jsonify(tag_schema.dump(tag)), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create tag'}), 500


@media_lib_bp.route('/tags/<int:tag_id>', methods=['DELETE'])
@jwt_required()
def delete_tag(tag_id):
    """刪除標籤。"""
    user, err = _require_editor()
    if err:
        return err

    tag = MLTag.query.get_or_404(tag_id)

    try:
        db.session.delete(tag)
        db.session.commit()
        return jsonify({'message': 'Tag deleted'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Delete failed'}), 500


# =============================================================================
# GCS 掃描匯入
# =============================================================================

@media_lib_bp.route('/import/scan', methods=['GET'])
@jwt_required()
def scan_gcs():
    """
    掃描 GCS Bucket，列出尚未匯入資料庫的檔案。
    回傳未匯入的檔案清單（不做任何寫入）。
    """
    user, err = _require_editor()
    if err:
        return err

    try:
        gcs = GCSStorage.get_instance()
        prefix = request.args.get('prefix', 'media/')

        # 列出 GCS 上的所有檔案
        blobs = gcs.bucket.list_blobs(prefix=prefix)

        # 取得資料庫中已有的 gcs_path
        existing_paths = set(
            row[0] for row in db.session.query(MLFile.gcs_path).all()
        )

        new_files = []
        for blob in blobs:
            # 跳過目錄標記和 0 byte 檔案
            if blob.name.endswith('/') or blob.size == 0:
                continue

            if blob.name not in existing_paths:
                mime = blob.content_type or mimetypes.guess_type(blob.name)[0] or 'application/octet-stream'
                new_files.append({
                    'gcs_path': blob.name,
                    'public_url': f'{gcs.public_url_prefix}/{blob.name}',
                    'filename': os.path.basename(blob.name),
                    'file_size': blob.size,
                    'mime_type': mime,
                    'updated': blob.updated.isoformat() if blob.updated else None,
                })

        return jsonify({
            'total_found': len(new_files),
            'files': new_files,
        }), 200

    except Exception as e:
        current_app.logger.error(f'GCS scan failed: {e}')
        return jsonify({'error': f'Scan failed: {str(e)}'}), 500


@media_lib_bp.route('/import/execute', methods=['POST'])
@jwt_required()
def import_from_gcs():
    """
    將指定的 GCS 檔案匯入到媒體庫資料庫。
    不搬移/複製 GCS 上的檔案，只建立資料庫記錄。

    Body:
    {
        "files": [
            {"gcs_path": "media/2026/01/photo.jpg", "public_url": "https://...", ...}
        ],
        "folder_id": null,          // 可選：放入指定資料夾
        "generate_variants": false   // 可選：是否下載圖片並產生縮圖（較慢）
    }
    """
    user, err = _require_editor()
    if err:
        return err

    data = request.get_json()
    files_to_import = data.get('files', [])
    folder_id = data.get('folder_id')
    gen_variants = data.get('generate_variants', False)

    if not files_to_import:
        return jsonify({'error': 'No files specified'}), 400

    imported = 0
    skipped = 0
    errors = []

    for f in files_to_import:
        gcs_path = f.get('gcs_path', '')
        if not gcs_path:
            continue

        # 檢查是否已存在
        if MLFile.query.filter_by(gcs_path=gcs_path).first():
            skipped += 1
            continue

        try:
            gcs = GCSStorage.get_instance()
            filename = os.path.basename(gcs_path)
            public_url = f.get('public_url', f'{gcs.public_url_prefix}/{gcs_path}')
            mime_type = f.get('mime_type', mimetypes.guess_type(filename)[0] or 'application/octet-stream')
            file_size = f.get('file_size', 0)

            ml_file = MLFile(
                filename=filename,
                original_filename=filename,
                gcs_path=gcs_path,
                public_url=public_url,
                file_size=file_size,
                mime_type=mime_type,
                folder_id=folder_id,
                uploaded_by=user.id,
            )
            db.session.add(ml_file)
            db.session.flush()

            # 自動建立 metadata 記錄
            metadata = MLFileMetadata(file_id=ml_file.id)
            db.session.add(metadata)

            # 如果要求產生縮圖且為圖片類型
            if gen_variants and is_image(mime_type):
                try:
                    blob = gcs.bucket.blob(gcs_path)
                    file_data = blob.download_as_bytes()

                    width, height = get_image_dimensions(file_data)
                    ml_file.width = width
                    ml_file.height = height

                    variants = generate_variants(file_data, mime_type)
                    for v in variants:
                        base_path = os.path.dirname(gcs_path)
                        variant_gcs_path = f'{base_path}/{v["variant_type"]}_{filename}'
                        if v['ext'] != os.path.splitext(filename)[1]:
                            variant_gcs_path = os.path.splitext(variant_gcs_path)[0] + v['ext']

                        variant_url = gcs.upload_bytes(
                            v['data'], variant_gcs_path, v['content_type']
                        )

                        variant_record = MLFileVariant(
                            file_id=ml_file.id,
                            variant_type=v['variant_type'],
                            gcs_path=variant_gcs_path,
                            public_url=variant_url,
                            width=v['width'],
                            height=v['height'],
                            file_size=v['file_size'],
                        )
                        db.session.add(variant_record)
                except Exception as ve:
                    current_app.logger.warning(f'Variant generation failed for {gcs_path}: {ve}')

            imported += 1
        except Exception as e:
            errors.append({'gcs_path': gcs_path, 'error': str(e)})

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Database commit failed: {str(e)}'}), 500

    return jsonify({
        'imported': imported,
        'skipped': skipped,
        'errors': errors,
    }), 200


# =============================================================================
# Metadata 管理
# =============================================================================

@media_lib_bp.route('/files/<int:file_id>/metadata', methods=['PUT'])
@jwt_required()
def update_metadata(file_id):
    """更新檔案的結構化 metadata。"""
    user, err = _require_editor()
    if err:
        return err

    ml_file = MLFile.query.get_or_404(file_id)
    data = request.get_json()

    # 取得或建立 metadata
    meta = ml_file.file_metadata
    if not meta:
        meta = MLFileMetadata(file_id=ml_file.id)
        db.session.add(meta)

    ALLOWED_FIELDS = ('chart_id', 'location', 'rating', 'status', 'source', 'license', 'notes')
    for field in ALLOWED_FIELDS:
        if field in data:
            value = data[field]
            # 驗證 rating 範圍
            if field == 'rating' and value is not None:
                value = max(1, min(5, int(value)))
            # 驗證 status 值
            if field == 'status' and value not in ('draft', 'published', 'archived'):
                continue
            setattr(meta, field, value)

    try:
        db.session.commit()
        return jsonify(MLFileMetadataSchema().dump(meta)), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Metadata update failed'}), 500


# =============================================================================
# 公開查詢 API（不需登入）
# =============================================================================

@media_lib_bp.route('/public/lookup', methods=['GET'])
def public_lookup():
    """透過命盤ID 查詢圖片（公開端點）。"""
    chart_id = request.args.get('chart_id', '').strip()
    if not chart_id:
        return jsonify({'error': 'chart_id is required'}), 400

    meta = MLFileMetadata.query.filter_by(chart_id=chart_id).first()
    if not meta:
        return jsonify({'error': 'Not found'}), 404

    ml_file = MLFile.query.get(meta.file_id)
    if not ml_file:
        return jsonify({'error': 'File not found'}), 404

    result = file_schema.dump(ml_file)
    return jsonify(result), 200


@media_lib_bp.route('/public/search', methods=['GET'])
def public_search():
    """
    公開搜尋 API，支援 metadata 欄位篩選。
    參數: status, location, source, license, rating, page, per_page
    """
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 20, type=int), 100)

    query = MLFile.query.join(MLFileMetadata)

    status = request.args.get('status')
    if status:
        query = query.filter(MLFileMetadata.status == status)

    location = request.args.get('location')
    if location:
        query = query.filter(MLFileMetadata.location.ilike(f'%{location}%'))

    source = request.args.get('source')
    if source:
        query = query.filter(MLFileMetadata.source.ilike(f'%{source}%'))

    license_val = request.args.get('license')
    if license_val:
        query = query.filter(MLFileMetadata.license.ilike(f'%{license_val}%'))

    rating = request.args.get('rating', type=int)
    if rating:
        query = query.filter(MLFileMetadata.rating >= rating)

    chart_id = request.args.get('chart_id')
    if chart_id:
        query = query.filter(MLFileMetadata.chart_id.ilike(f'%{chart_id}%'))

    pagination = query.order_by(MLFile.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    return jsonify({
        'files': files_schema.dump(pagination.items),
        'pagination': {
            'page': pagination.page,
            'pages': pagination.pages,
            'per_page': pagination.per_page,
            'total': pagination.total,
        }
    }), 200
