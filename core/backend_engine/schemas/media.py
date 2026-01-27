"""
Media Schemas

Provides serialization for Media and MediaFolder models.
"""

from marshmallow import Schema, fields


class MediaSchema(Schema):
    """Schema for Media model serialization.

    Fields:
        id: Media ID (read-only)
        filename: Stored filename
        file_path: Full file path/URL
        original_filename: Original uploaded filename
        file_type: File type category
        file_size: File size in bytes
        mime_type: MIME type
        folder_id: Parent folder ID
        uploaded_by: Uploader user ID
        created_at: Upload timestamp (read-only)
        attributes: Custom attributes (JSONB)
    """
    id = fields.Int(dump_only=True)
    filename = fields.Str()
    file_path = fields.Str()
    original_filename = fields.Str()
    file_type = fields.Str()
    file_size = fields.Int()
    mime_type = fields.Str()
    folder_id = fields.Int()
    uploaded_by = fields.Int()
    created_at = fields.DateTime(dump_only=True)
    attributes = fields.Dict()  # JSONB field


class MediaFolderSchema(Schema):
    """Schema for MediaFolder model serialization.

    Fields:
        id: Folder ID (read-only)
        name: Folder name (required)
        parent_id: Parent folder ID
        path: Full folder path
        created_by: Creator user ID
        created_at: Creation timestamp (read-only)

    Nested:
        subfolders: Child folders
        media_items: Media files in folder
    """
    id = fields.Int(dump_only=True)
    name = fields.Str(required=True)
    parent_id = fields.Int()
    path = fields.Str()
    created_by = fields.Int()
    created_at = fields.DateTime(dump_only=True)

    # Nested relationships
    subfolders = fields.List(fields.Nested("MediaFolderSchema", only=("id", "name", "path")))
    media_items = fields.List(fields.Nested(MediaSchema))
