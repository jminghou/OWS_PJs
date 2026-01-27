# 後端 API 實作說明：產品排序功能

## API 端點

```
PUT /admin/products/sort-order
```

## 請求格式

### Headers
```
Authorization: Bearer {token}
Content-Type: application/json
```

### Body
```json
{
  "sort_orders": [
    {
      "id": 1,
      "sort_order": 1
    },
    {
      "id": 2,
      "sort_order": 2
    },
    {
      "id": 3,
      "sort_order": 3
    }
  ]
}
```

## 回應格式

### 成功回應 (200 OK)
```json
{
  "message": "產品排序更新成功"
}
```

### 錯誤回應

#### 401 Unauthorized
```json
{
  "message": "未授權"
}
```

#### 400 Bad Request
```json
{
  "message": "請求格式錯誤"
}
```

#### 500 Internal Server Error
```json
{
  "message": "伺服器錯誤"
}
```

## Python/Flask 實作範例

```python
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from models import db, Product

admin_products_bp = Blueprint('admin_products', __name__)

@admin_products_bp.route('/admin/products/sort-order', methods=['PUT'])
@jwt_required()
def update_product_sort_order():
    """
    更新產品排序順序
    """
    try:
        data = request.get_json()

        if not data or 'sort_orders' not in data:
            return jsonify({'message': '請求格式錯誤'}), 400

        sort_orders = data['sort_orders']

        if not isinstance(sort_orders, list):
            return jsonify({'message': 'sort_orders 必須是陣列'}), 400

        # 批量更新排序
        for item in sort_orders:
            product_id = item.get('id')
            sort_order = item.get('sort_order')

            if product_id is None or sort_order is None:
                continue

            product = Product.query.get(product_id)
            if product:
                product.sort_order = sort_order

        db.session.commit()

        return jsonify({'message': '產品排序更新成功'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'更新失敗: {str(e)}'}), 500
```

## 資料庫欄位

確保 `products` 表有 `sort_order` 欄位：

```sql
ALTER TABLE products ADD COLUMN sort_order INTEGER DEFAULT 0;
```

或在 SQLAlchemy 模型中：

```python
class Product(db.Model):
    __tablename__ = 'products'

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.String(50), unique=True, nullable=False)
    # ... 其他欄位 ...
    sort_order = db.Column(db.Integer, default=0)
    # ... 其他欄位 ...
```

## 測試方式

使用 curl 測試：

```bash
curl -X PUT http://localhost:5000/api/admin/products/sort-order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "sort_orders": [
      {"id": 1, "sort_order": 1},
      {"id": 2, "sort_order": 2},
      {"id": 3, "sort_order": 3}
    ]
  }'
```

## 注意事項

1. 這個 API 需要管理員權限，請確保有適當的權限檢查
2. 建議在更新前驗證所有產品 ID 是否存在
3. 使用資料庫事務確保批量更新的原子性
4. 考慮添加日誌記錄排序變更
