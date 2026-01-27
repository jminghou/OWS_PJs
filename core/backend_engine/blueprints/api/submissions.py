"""
Submissions API Routes

Provides endpoints for anonymous submission forms:
- POST /submissions - Create anonymous submission
- GET /admin/submissions - List submissions (admin)
- PUT /admin/submissions/<id> - Update submission status (admin)
"""

from flask import jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import fields

from core.backend_engine.factory import db, limiter
from core.backend_engine.blueprints.api import bp
from core.backend_engine.models import User, Submission
from core.backend_engine.schemas.base import BaseSchema


class SubmissionSchema(BaseSchema):
    """Schema for Submission model serialization"""
    class Meta(BaseSchema.Meta):
        model = Submission

    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)


submission_schema = SubmissionSchema()
submissions_schema = SubmissionSchema(many=True)


@bp.route('/submissions', methods=['POST'])
@limiter.limit("5/minute")
def api_create_submission():
    """Receive anonymous submission form"""
    data = request.get_json()
    client_ip = request.environ.get('HTTP_X_FORWARDED_FOR', request.environ.get('REMOTE_ADDR', ''))

    submission = Submission(
        character_name=data.get('character_name', ''),
        birth_year=data.get('birth_year', ''),
        birth_month=data.get('birth_month', ''),
        birth_day=data.get('birth_day', ''),
        birth_time=data.get('birth_time', ''),
        birth_place=data.get('birth_place', ''),
        question=data.get('question', ''),
        ip_address=client_ip[:45]
    )

    try:
        db.session.add(submission)
        db.session.commit()
        return jsonify({'message': 'Submission successful', 'id': submission.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': 'Submission failed, please try again later'}), 500


@bp.route('/admin/submissions', methods=['GET'])
@jwt_required()
def api_admin_submissions():
    """Admin view submission list"""
    user = User.query.get(int(get_jwt_identity()))
    if not user.is_admin():
        return jsonify({'message': 'Insufficient permissions'}), 403

    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 20, type=int), 100)
    status = request.args.get('status')

    query = Submission.query
    if status:
        query = query.filter_by(status=status)

    pagination = query.order_by(Submission.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'submissions': submissions_schema.dump(pagination.items),
        'pagination': {
            'page': pagination.page,
            'pages': pagination.pages,
            'total': pagination.total
        }
    }), 200


@bp.route('/admin/submissions/<int:submission_id>', methods=['PUT'])
@jwt_required()
def api_admin_update_submission(submission_id):
    """Admin update submission status and notes"""
    user = User.query.get(int(get_jwt_identity()))
    if not user.is_admin():
        return jsonify({'message': 'Insufficient permissions'}), 403

    submission = Submission.query.get_or_404(submission_id)
    data = request.get_json()
    submission.status = data.get('status', submission.status)
    submission.admin_notes = data.get('admin_notes', submission.admin_notes)

    try:
        db.session.commit()
        return jsonify({'message': 'Submission updated successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': 'Update failed'}), 500
