'use client';

import { User } from '@ows/platform-api/types';
import Button from '@ows/ui/ui/Button';
import Input from '@ows/ui/ui/Input';
import { Shield, Power, BadgeCheck } from 'lucide-react';

// 作者公開檔案（E-E-A-T）。社群連結對應 schema.org Person.sameAs。
export interface AuthorProfileForm {
  avatar: string;
  display_name: string;
  title: string;
  bio: string;
  credentials: string;
  expertise: string; // UI 以逗號分隔，送出時轉陣列
  website: string;
  facebook: string;
  instagram: string;
  youtube: string;
}

interface AuthorFormProps {
  isEditing: boolean;
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'editor' | 'user';
  isActive: boolean;
  user?: User; // original user data for display
  profile: AuthorProfileForm;
  onProfileChange: (patch: Partial<AuthorProfileForm>) => void;
  onUsernameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRoleChange: (value: 'admin' | 'editor' | 'user') => void;
  onIsActiveChange: (value: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  onToggleStatus?: () => void;
}

const getRoleDisplayName = (role: string) => {
  switch (role) {
    case 'admin': return '管理員';
    case 'editor': return '編輯者';
    case 'user': return '一般用戶';
    default: return role;
  }
};

export default function AuthorForm({
  isEditing,
  username,
  email,
  password,
  role,
  isActive,
  user,
  profile,
  onProfileChange,
  onUsernameChange,
  onEmailChange,
  onPasswordChange,
  onRoleChange,
  onIsActiveChange,
  onSubmit,
  onCancel,
  onToggleStatus,
}: AuthorFormProps) {
  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">
          {isEditing ? '編輯用戶' : '新增用戶'}
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {isEditing ? '修改用戶帳戶資訊' : '建立新的用戶帳戶'}
        </p>
      </div>

      {/* User info summary (edit mode) */}
      {isEditing && user && (
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <div className="text-xs text-gray-500 space-y-0.5">
            <div>註冊：{new Date(user.created_at).toLocaleDateString()}</div>
            {user.last_login && (
              <div>最後登入：{new Date(user.last_login).toLocaleDateString()}</div>
            )}
            {user.content_count !== undefined && (
              <div>文章數：{user.content_count} 篇</div>
            )}
          </div>
          {onToggleStatus && (
            <button
              type="button"
              onClick={onToggleStatus}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                user.is_active
                  ? 'text-orange-700 bg-orange-50 hover:bg-orange-100'
                  : 'text-green-700 bg-green-50 hover:bg-green-100'
              }`}
            >
              <Power size={12} />
              {user.is_active ? '停用帳戶' : '啟用帳戶'}
            </button>
          )}
        </div>
      )}

      {/* Form */}
      <div className="flex-1 overflow-y-auto">
        <form onSubmit={onSubmit} className="p-6 space-y-5 max-w-xl">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              用戶名 *
            </label>
            <Input
              value={username}
              onChange={(e) => onUsernameChange(e.target.value)}
              placeholder="輸入用戶名"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              郵箱 *
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="輸入郵箱地址"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              密碼 {!isEditing && '*'}
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              placeholder={isEditing ? '留空表示不修改密碼' : '設置密碼'}
              required={!isEditing}
            />
            {isEditing && (
              <p className="text-xs text-gray-500 mt-1">留空則保持原密碼不變</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Shield size={14} className="inline mr-1" />
              角色
            </label>
            <select
              value={role}
              onChange={(e) => onRoleChange(e.target.value as 'admin' | 'editor' | 'user')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="editor">編輯者</option>
              <option value="admin">管理員</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={isActive}
              onChange={(e) => onIsActiveChange(e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700">
              啟用帳戶
            </label>
          </div>

          {/* 作者公開檔案 (E-E-A-T) */}
          <div className="pt-5 border-t">
            <div className="flex items-center gap-1.5 mb-1">
              <BadgeCheck size={15} className="text-amber-600" />
              <h3 className="text-sm font-semibold text-gray-900">作者公開檔案 (E-E-A-T)</h3>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              這些資訊會顯示在公開作者頁，並輸出為 schema.org Person 結構化資料，幫助 AI／搜尋引擎信任並引用內容。
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">顯示名稱</label>
                <Input
                  value={profile.display_name}
                  onChange={(e) => onProfileChange({ display_name: e.target.value })}
                  placeholder="文章署名與作者頁標題（留空則用用戶名）"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">頭銜／職稱</label>
                <Input
                  value={profile.title}
                  onChange={(e) => onProfileChange({ title: e.target.value })}
                  placeholder="例：紫微斗數研究者、親子教育講師"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">簡介</label>
                <textarea
                  value={profile.bio}
                  onChange={(e) => onProfileChange({ bio: e.target.value })}
                  placeholder="一段作者介紹，說明專業背景與經歷"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">資歷／認證</label>
                <Input
                  value={profile.credentials}
                  onChange={(e) => onProfileChange({ credentials: e.target.value })}
                  placeholder="例：執業 10 年、相關證照"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">專長領域</label>
                <Input
                  value={profile.expertise}
                  onChange={(e) => onProfileChange({ expertise: e.target.value })}
                  placeholder="以逗號分隔，例：紫微斗數, 親子教育, 性格分析"
                />
                <p className="text-xs text-gray-500 mt-1">以逗號分隔，會輸出為 Person.knowsAbout</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">頭像圖片網址</label>
                <Input
                  value={profile.avatar}
                  onChange={(e) => onProfileChange({ avatar: e.target.value })}
                  placeholder="頭像圖片的完整網址"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">官方網站</label>
                  <Input
                    value={profile.website}
                    onChange={(e) => onProfileChange({ website: e.target.value })}
                    placeholder="https://"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Facebook</label>
                  <Input
                    value={profile.facebook}
                    onChange={(e) => onProfileChange({ facebook: e.target.value })}
                    placeholder="https://facebook.com/..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Instagram</label>
                  <Input
                    value={profile.instagram}
                    onChange={(e) => onProfileChange({ instagram: e.target.value })}
                    placeholder="https://instagram.com/..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">YouTube</label>
                  <Input
                    value={profile.youtube}
                    onChange={(e) => onProfileChange({ youtube: e.target.value })}
                    placeholder="https://youtube.com/@..."
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                社群連結會輸出為 Person.sameAs，是 AI 驗證作者身分的重要訊號。
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-2 pt-4 border-t">
            <Button type="submit" className="flex-1">
              {isEditing ? '更新用戶' : '創建用戶'}
            </Button>
            {isEditing && (
              <Button type="button" variant="outline" onClick={onCancel}>
                取消
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
