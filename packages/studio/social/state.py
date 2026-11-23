"""發布請求自己的狀態機。不沿用 studio_documents.stage。

未送出：pending_review、pending_approval、approved，可以取消。
publishing 只能由條件 UPDATE（state='approved' AND approved_hash=:hash）進入。
failed / unknown 沒有出口，不會自動重試。
scheduled、published 留給之後的發文 PR；這個版本沒有轉移會進入牠們。
"""

OPEN_STATE_SQL = (
    "state IN ('pending_review', 'pending_approval', 'approved', "
    "'publishing', 'scheduled', 'unknown')"
)
EXTERNAL_ID_SQL = 'external_id IS NOT NULL'

TARGET_FACEBOOK_PAGE = 'facebook_page'
TARGETS = (TARGET_FACEBOOK_PAGE,)

STATE_PENDING_REVIEW = 'pending_review'
STATE_PENDING_APPROVAL = 'pending_approval'
STATE_APPROVED = 'approved'
STATE_PUBLISHING = 'publishing'
STATE_PUBLISHED = 'published'
STATE_FAILED = 'failed'
STATE_UNKNOWN = 'unknown'
STATE_SCHEDULED = 'scheduled'
STATE_REJECTED = 'rejected'
STATE_CANCELLED = 'cancelled'

ALL_STATES = (
    STATE_PENDING_REVIEW,
    STATE_PENDING_APPROVAL,
    STATE_APPROVED,
    STATE_PUBLISHING,
    STATE_PUBLISHED,
    STATE_FAILED,
    STATE_UNKNOWN,
    STATE_SCHEDULED,
    STATE_REJECTED,
    STATE_CANCELLED,
)

# 同一份文件同時只能有一筆這些狀態。published / failed / rejected / cancelled 不算進行中。
OPEN_STATES = frozenset({
    STATE_PENDING_REVIEW,
    STATE_PENDING_APPROVAL,
    STATE_APPROVED,
    STATE_PUBLISHING,
    STATE_SCHEDULED,
    STATE_UNKNOWN,
})

UNSENT_STATES = frozenset({
    STATE_PENDING_REVIEW,
    STATE_PENDING_APPROVAL,
    STATE_APPROVED,
})

EVENT_SUBMITTED = 'submitted'
EVENT_CHECKED = 'checked'
EVENT_APPROVED = 'approved'
EVENT_APPROVAL_VOIDED = 'approval_voided'
EVENT_REJECTED = 'rejected'
EVENT_PUBLISH_STARTED = 'publish_started'
EVENT_PUBLISHED = 'published'
EVENT_FAILED = 'failed'
EVENT_UNKNOWN = 'unknown'
EVENT_RECONCILED = 'reconciled'
EVENT_CANCELLED = 'cancelled'

EVENTS = frozenset({
    EVENT_SUBMITTED,
    EVENT_CHECKED,
    EVENT_APPROVED,
    EVENT_APPROVAL_VOIDED,
    EVENT_REJECTED,
    EVENT_PUBLISH_STARTED,
    EVENT_PUBLISHED,
    EVENT_FAILED,
    EVENT_UNKNOWN,
    EVENT_RECONCILED,
    EVENT_CANCELLED,
})

# 這個 PR 實際會走的轉移。claim 只描述合法邊；寫入 publishing 的是條件 UPDATE。
TRANSITIONS = {
    'checked_clear': {
        STATE_PENDING_REVIEW: STATE_PENDING_APPROVAL,
        STATE_PENDING_APPROVAL: STATE_PENDING_APPROVAL,
    },
    'checked_blocked': {
        STATE_PENDING_REVIEW: STATE_PENDING_REVIEW,
        STATE_PENDING_APPROVAL: STATE_PENDING_REVIEW,
    },
    'approve': {STATE_PENDING_APPROVAL: STATE_APPROVED},
    'reject': {
        STATE_PENDING_REVIEW: STATE_REJECTED,
        STATE_PENDING_APPROVAL: STATE_REJECTED,
        STATE_APPROVED: STATE_REJECTED,
    },
    'cancel': {
        STATE_PENDING_REVIEW: STATE_CANCELLED,
        STATE_PENDING_APPROVAL: STATE_CANCELLED,
        STATE_APPROVED: STATE_CANCELLED,
    },
    'void': {STATE_APPROVED: STATE_PENDING_REVIEW},
    'claim': {STATE_APPROVED: STATE_PUBLISHING},
}


class InvalidTransition(Exception):
    def __init__(self, state, event):
        super().__init__(f'{state} cannot {event}')
        self.state = state
        self.event = event


def next_state(state: str, event: str) -> str:
    table = TRANSITIONS.get(event) or {}
    if state not in table:
        raise InvalidTransition(state, event)
    return table[state]
