"""Phase 0 commerce contracts. Additive, Polaris-owned tables; no shared-table changes."""
from sqlalchemy.dialects.postgresql import JSONB

from core.backend_engine.factory import db
from core.backend_engine.models import SHOP_SCHEMA, qualify


class CommerceChannel(db.Model):
    """Operator-reviewed technical intake permission, never a platform endorsement."""
    __tablename__ = 'commerce_channels'
    __table_args__ = (
        db.UniqueConstraint('channel', 'store_key', name='uq_commerce_channel_store'),
        db.CheckConstraint('revision > 0', name='ck_commerce_channel_revision'),
        {'schema': 'shop'},
    )
    id = db.Column(db.BigInteger, primary_key=True)
    channel = db.Column(db.String(40), nullable=False)
    store_key = db.Column(db.String(100), nullable=False)
    revision = db.Column(db.Integer, nullable=False)
    manual_import = db.Column(db.Boolean, nullable=False, default=False)
    policy_reference = db.Column(db.String(1000), nullable=False)
    review_note = db.Column(db.String(1000), nullable=False)
    reviewed_by = db.Column(db.BigInteger, db.ForeignKey('account.app_users.id'), nullable=False)
    valid_until = db.Column(db.DateTime(timezone=True), nullable=False)


class CommerceExternalReceipt(db.Model):
    __tablename__ = 'commerce_external_receipts'
    __table_args__ = (
        db.UniqueConstraint('channel_id', 'external_order_id', name='uq_commerce_external_receipt'),
        db.CheckConstraint("status IN ('pending','verified','rejected','voided')", name='ck_commerce_receipt_status'),
        db.CheckConstraint('amount > 0', name='ck_commerce_receipt_amount'),
        {'schema': 'shop'},
    )
    id = db.Column(db.BigInteger, primary_key=True)
    channel_id = db.Column(db.BigInteger, db.ForeignKey('shop.commerce_channels.id'), nullable=False)
    external_order_id = db.Column(db.String(200), nullable=False)
    member_id = db.Column(db.BigInteger, db.ForeignKey('account.app_users.id'), nullable=False)
    amount = db.Column(db.Integer, nullable=False)
    currency = db.Column(db.String(10), nullable=False)
    lines = db.Column(JSONB, nullable=False)
    fingerprint = db.Column(db.String(64), nullable=False)
    status = db.Column(db.String(20), nullable=False)
    channel_revision = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())


class CommerceIntakeEvent(db.Model):
    __tablename__ = 'commerce_intake_events'
    __table_args__ = {'schema': 'shop'}
    id = db.Column(db.BigInteger, primary_key=True)
    channel_id = db.Column(db.BigInteger, db.ForeignKey('shop.commerce_channels.id'), nullable=False)
    receipt_id = db.Column(db.BigInteger, db.ForeignKey('shop.commerce_external_receipts.id'))
    actor_id = db.Column(db.BigInteger, db.ForeignKey('account.app_users.id'), nullable=False)
    event_type = db.Column(db.String(40), nullable=False)
    detail = db.Column(JSONB, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())

ITEM_FK = qualify('order_items.id', SHOP_SCHEMA)
ORDER_FK = qualify('orders.id', SHOP_SCHEMA)


class CommerceProductMapping(db.Model):
    """Reviewed, versioned external SKU -> frozen internal sale terms."""
    __tablename__ = 'commerce_product_mappings'
    __table_args__ = (
        db.UniqueConstraint('channel_id', 'external_sku', name='uq_commerce_product_mapping'),
        db.CheckConstraint('revision > 0', name='ck_commerce_mapping_revision'),
        {'schema': 'shop'},
    )
    id = db.Column(db.BigInteger, primary_key=True)
    channel_id = db.Column(db.BigInteger, db.ForeignKey('shop.commerce_channels.id'), nullable=False)
    external_sku = db.Column(db.String(200), nullable=False)
    revision = db.Column(db.Integer, nullable=False)
    active = db.Column(db.Boolean, nullable=False)
    profile = db.Column(JSONB, nullable=False)
    policy_reference = db.Column(db.String(1000), nullable=False)
    review_note = db.Column(db.String(1000), nullable=False)
    reviewed_by = db.Column(db.BigInteger, db.ForeignKey('account.app_users.id'), nullable=False)
    valid_until = db.Column(db.DateTime(timezone=True), nullable=False)


class CommerceReceiptBinding(db.Model):
    __tablename__ = 'commerce_receipt_bindings'
    __table_args__ = {'schema': 'shop'}
    id = db.Column(db.BigInteger, primary_key=True)
    receipt_id = db.Column(db.BigInteger, db.ForeignKey('shop.commerce_external_receipts.id'), nullable=False, unique=True)
    order_id = db.Column(db.Integer, db.ForeignKey(ORDER_FK), nullable=False, unique=True)
    actor_id = db.Column(db.BigInteger, db.ForeignKey('account.app_users.id'), nullable=False)
    fingerprint = db.Column(db.String(64), nullable=False)
    snapshot = db.Column(JSONB, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())


class CommerceSource(db.Model):
    __tablename__ = 'commerce_sources'
    __table_args__ = (
        db.UniqueConstraint('channel', 'store_key', 'external_order_id', name='uq_commerce_source_external'),
        {'schema': 'shop'},
    )
    order_id = db.Column(db.Integer, db.ForeignKey(ORDER_FK), primary_key=True)
    channel = db.Column(db.String(40), nullable=False)
    store_key = db.Column(db.String(100), nullable=False)
    external_order_id = db.Column(db.String(200))
    contract_version = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())


class CommerceLine(db.Model):
    """Immutable sale terms. quantity counts priced packages, print_copies counts identical copies."""
    __tablename__ = 'commerce_lines'
    __table_args__ = (
        db.CheckConstraint('unit_amount >= 0 AND quantity > 0 AND print_copies >= 0', name='ck_commerce_line_amounts'),
        db.CheckConstraint('line_total = unit_amount * quantity', name='ck_commerce_line_total'),
        {'schema': 'shop'},
    )
    order_item_id = db.Column(db.Integer, db.ForeignKey(ITEM_FK), primary_key=True)
    unit_amount = db.Column(db.Integer, nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    line_total = db.Column(db.Integer, nullable=False)
    currency = db.Column(db.String(10), nullable=False)
    currency_exponent = db.Column(db.Integer, nullable=False)
    print_copies = db.Column(db.Integer, nullable=False)
    components = db.Column(JSONB, nullable=False)
    rights = db.Column(JSONB, nullable=False)


class CommerceEntitlement(db.Model):
    __tablename__ = 'commerce_entitlements'
    __table_args__ = (
        db.UniqueConstraint('order_item_id', 'kind', 'unit_index', name='uq_commerce_entitlement_unit'),
        db.CheckConstraint("status IN ('available','in_use','completed','revoked')", name='ck_commerce_entitlement_status'),
        db.CheckConstraint('unit_index > 0', name='ck_commerce_entitlement_unit'),
        {'schema': 'shop'},
    )
    id = db.Column(db.BigInteger, primary_key=True)
    order_item_id = db.Column(db.Integer, db.ForeignKey(ITEM_FK), nullable=False, index=True)
    kind = db.Column(db.String(40), nullable=False)
    unit_index = db.Column(db.Integer, nullable=False)
    holder_id = db.Column(db.BigInteger, db.ForeignKey('account.app_users.id'), nullable=False)
    operator_id = db.Column(db.BigInteger, db.ForeignKey('account.app_users.id'), nullable=False)
    status = db.Column(db.String(20), nullable=False)
    rights = db.Column(JSONB, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())
    revoked_at = db.Column(db.DateTime(timezone=True))
    revoke_reason = db.Column(db.Text)


class CommerceTask(db.Model):
    """One durable task per entitlement; retries reuse it instead of making another production."""
    __tablename__ = 'commerce_tasks'
    __table_args__ = (
        db.CheckConstraint("status IN ('started','completed','cancelled')", name='ck_commerce_task_status'),
        {'schema': 'shop'},
    )
    id = db.Column(db.BigInteger, primary_key=True)
    entitlement_id = db.Column(db.BigInteger, db.ForeignKey('shop.commerce_entitlements.id'), nullable=False, unique=True)
    target_kind = db.Column(db.String(40), nullable=False)
    target_id = db.Column(db.BigInteger, nullable=False)
    status = db.Column(db.String(20), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())


class CommerceEvent(db.Model):
    __tablename__ = 'commerce_events'
    __table_args__ = {'schema': 'shop'}
    id = db.Column(db.BigInteger, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey(ORDER_FK), nullable=False, index=True)
    entitlement_id = db.Column(db.BigInteger, db.ForeignKey('shop.commerce_entitlements.id'))
    event_key = db.Column(db.String(160), nullable=False, unique=True)
    event_type = db.Column(db.String(40), nullable=False)
    actor_id = db.Column(db.BigInteger, db.ForeignKey('account.app_users.id'))
    detail = db.Column(JSONB, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())


class CommerceActivation(db.Model):
    """An account-bound claim token, not payment evidence or an additional entitlement."""
    __tablename__ = 'commerce_activations'
    __table_args__ = (
        db.CheckConstraint("status IN ('issued','redeemed','revoked')", name='ck_commerce_activation_status'),
        db.Index('uq_commerce_activation_open', 'entitlement_id', unique=True,
                 postgresql_where=db.text("status = 'issued'"), sqlite_where=db.text("status = 'issued'")),
        {'schema': 'shop'},
    )
    id = db.Column(db.BigInteger, primary_key=True)
    entitlement_id = db.Column(db.BigInteger, db.ForeignKey('shop.commerce_entitlements.id'), nullable=False, index=True)
    code_digest = db.Column(db.String(64), nullable=False, unique=True)
    recipient_id = db.Column(db.BigInteger, db.ForeignKey('account.app_users.id'), nullable=False)
    issued_by = db.Column(db.BigInteger, db.ForeignKey('account.app_users.id'), nullable=False)
    status = db.Column(db.String(20), nullable=False)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    redeemed_at = db.Column(db.DateTime(timezone=True))
    revoked_at = db.Column(db.DateTime(timezone=True))
    revoke_reason = db.Column(db.Text)
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())
