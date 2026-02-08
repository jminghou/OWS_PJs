"""
Media Library - Marshmallow Schemas

API 回應的序列化 schemas。
"""

from marshmallow import Schema, fields


class MLTagSchema(Schema):
    id = fields.Int(dump_only=True)
    name = fields.Str(required=True)
    slug = fields.Str()
    color = fields.Str()


class MLFileVariantSchema(Schema):
    url = fields.Str(attribute='public_url')
    width = fields.Int()
    height = fields.Int()
    file_size = fields.Int()


class MLFileMetadataSchema(Schema):
    chart_id = fields.Str()
    location = fields.Str()
    rating = fields.Int()
    status = fields.Str()
    source = fields.Str()
    license = fields.Str()
    notes = fields.Str()


class MLFileSchema(Schema):
    id = fields.Int(dump_only=True)
    filename = fields.Str()
    original_filename = fields.Str()
    gcs_path = fields.Str()
    public_url = fields.Str()
    file_size = fields.Int()
    mime_type = fields.Str()
    width = fields.Int()
    height = fields.Int()
    alt_text = fields.Str()
    caption = fields.Str()
    folder_id = fields.Int()
    uploaded_by = fields.Int()
    attributes = fields.Dict()
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)
    tags = fields.List(fields.Nested(MLTagSchema))
    formats = fields.Method('get_formats')
    metadata = fields.Nested(MLFileMetadataSchema, attribute='file_metadata')

    def get_formats(self, obj):
        if hasattr(obj, 'variants'):
            return {v.variant_type: MLFileVariantSchema().dump(v) for v in obj.variants}
        return {}


class MLFolderSchema(Schema):
    id = fields.Int(dump_only=True)
    name = fields.Str(required=True)
    parent_id = fields.Int()
    path = fields.Str()
    created_by = fields.Int()
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)
    subfolders = fields.List(fields.Nested('MLFolderSchema', only=('id', 'name', 'path')))
    file_count = fields.Method('get_file_count')

    def get_file_count(self, obj):
        if hasattr(obj, 'files'):
            return obj.files.count()
        return 0
