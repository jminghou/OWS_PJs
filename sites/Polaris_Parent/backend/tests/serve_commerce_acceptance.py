"""Loopback-only browser acceptance fixture; no production app/.env/external services.

Run with the repository Python interpreter. Test login is deliberately available
ONLY in this standalone harness, never registered by the production application.
"""
import json
import os
from pathlib import Path
import sys
from datetime import timedelta
from unittest.mock import patch

SITE = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(SITE.parents[1]))
os.environ['PRIVATE_GCS_BUCKET_NAME'] = ''


def main():
    from flask import jsonify, request, make_response
    from flask_jwt_extended import create_access_token, set_access_cookies, jwt_required, get_jwt_identity
    from werkzeug.serving import make_server
    from core.backend_engine.factory import db
    from core.backend_engine.models import User
    from core.backend_engine.services.rbac import RBACService
    from packages.commerce.models import Order, PaymentAttempt
    from sites.Polaris_Parent.backend.models import ReportFulfillment
    from sites.Polaris_Parent.backend.commerce_models import CommerceReceiptBinding, CommerceEntitlement, CommerceTask, CommerceExternalReceipt
    from sites.Polaris_Parent.backend.tests.test_commerce_binding import BindingTests
    from tests.test_report_orders import payload

    BindingTests.setUpClass()
    fixture = BindingTests()
    fixture.setUp()
    app = fixture.app
    app.config.update(JWT_TOKEN_LOCATION=['cookies', 'headers'], JWT_COOKIE_SECURE=False,
                      JWT_COOKIE_CSRF_PROTECT=True, JWT_ACCESS_TOKEN_EXPIRES=timedelta(hours=2),
                      PRIVATE_UPLOAD_DIR=str(SITE / '.test-tmp' / 'acceptance-private'))
    admin_id, buyer_id = fixture.admin.id, fixture.user.id
    reviewer = fixture.make_user('acceptance-reviewer@example.test', verified=True)
    reviewer.role = 'editor'
    reviewer_id = reviewer.id
    permissions = ['report_orders.read', 'report_orders.confirm_payment', 'report_orders.fulfill',
                   'report_orders.intake', 'report_orders.channels', 'report_orders.contracts']
    grant = patch.object(RBACService, 'get_user_permissions', side_effect=lambda uid:
        set(permissions) if int(uid) == admin_id else {'report_orders.intake'} if int(uid) == reviewer_id else set())
    grant.start()
    actors = {'admin': admin_id, 'buyer': buyer_id, 'reviewer': reviewer_id}
    journal = []

    def user_view(uid):
        user = db.session.get(User, uid)
        return dict(id=user.id, username=user.username, email=user.email, role=user.role,
                    is_active=True, permissions=sorted(RBACService.get_user_permissions(uid)))

    @app.get('/api/v1/__acceptance')
    def home():
        summary = dict(receipts=CommerceExternalReceipt.query.count(), bindings=CommerceReceiptBinding.query.count(),
                       payment_attempts=PaymentAttempt.query.count(), entitlements=CommerceEntitlement.query.count(),
                       tasks=CommerceTask.query.count(), orders=[dict(order_no=o.order_no, status=o.status, method=o.payment_method)
                       for o in Order.query.order_by(Order.id).all()])
        return '<meta charset="utf-8"><h1>隔離驗收環境</h1><p>SQLite 記憶體資料庫；假排盤、假寄信、測試登入。會員 #' + str(buyer_id) + '</p>' + ''.join(
            f'<p><a href="/api/v1/__acceptance/login/{role}">切換 {role}</a></p>' for role in actors) + '<p>官網訂單 ACCEPTANCE-ORDER-1 / ACCEPTANCE-ORDER-2；範本品項 R-ACCEPTANCE-1；單價 TWD 1980。</p><pre>' + json.dumps(summary, ensure_ascii=False, indent=2) + '</pre>'

    @app.get('/api/v1/__acceptance/login/<role>')
    def login(role):
        if role not in actors:
            return 'not found', 404
        uid = actors[role]
        target = '/report/orders/ACCEPTANCE-ORDER-1' if role == 'buyer' else '/admin/commerce-intake'
        state = json.dumps(dict(state=dict(user=user_view(uid), isAuthenticated=True), version=0))
        response = make_response('<meta charset="utf-8"><p>切換測試身分…</p><script>localStorage.setItem("auth-storage",' + json.dumps(state) + ');location.href=' + json.dumps(target) + '</script>')
        set_access_cookies(response, create_access_token(identity=str(uid)))
        return response

    @app.get('/api/v1/auth/profile')
    @jwt_required()
    def profile():
        return jsonify(user_view(int(get_jwt_identity())))

    @app.get('/api/v1/site-settings')
    def settings():
        return jsonify(settings={})

    @app.after_request
    def record(response):
        if request.method != 'GET' or response.status_code >= 400:
            journal.append(dict(method=request.method, path=request.path, status=response.status_code))
            target = SITE / '.test-tmp' / 'commerce-acceptance-requests.json'
            target.write_text(json.dumps(journal, ensure_ascii=False, indent=2), encoding='utf-8')
        return response

    for number in (1, 2):
        response = fixture.post(payload(submission_key=f'acceptance-order-{number}'))
        assert response.status_code == 201, response.get_json()
        order = Order.query.filter_by(order_no=response.get_json()['order']['order_no']).one()
        order.order_no = f'ACCEPTANCE-ORDER-{number}'
        item = order.order_items[0]
        item.item_no = f'R-ACCEPTANCE-{number}'
        ReportFulfillment.query.filter_by(order_item_id=item.id).one().request_no = item.item_no
    db.session.commit()
    fixture.ctx.pop()

    print('Acceptance fixture: http://127.0.0.1:5187/api/v1/__acceptance', flush=True)
    print('Use frontend proxy at http://127.0.0.1:3187/api/v1/__acceptance', flush=True)
    try:
        make_server('127.0.0.1', 5187, app, threaded=False).serve_forever()
    finally:
        grant.stop()
        with app.app_context():
            db.session.remove()
            db.engine.dispose()
        fixture.doCleanups()


if __name__ == '__main__':
    main()
