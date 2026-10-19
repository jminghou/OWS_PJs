'use client';

import { getAdminConfig, getHomePath } from '../config';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@ows/platform-api';
import { LoginCredentials } from '@ows/platform-api/types';
import Button from '@ows/ui/ui/Button';
import Input from '@ows/ui/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@ows/ui/ui/Card';

export default function LoginPage() {
  const router = useRouter();
  const { login, logout, error, isLoading, clearError, isAuthenticated, user } = useAuthStore();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isStaff = (u: typeof user) => !!u && (u.role === 'admin' || u.role === 'editor');
  // 已用一般會員帳號登入：留在這頁，提示改用管理員帳號登入（登入成功會換掉目前的身分）
  const signedInAsMember = isAuthenticated && !!user && !isStaff(user);

  // 已經是後台人員，直接導向後台
  useEffect(() => {
    if (isAuthenticated && isStaff(user)) {
      router.replace(getHomePath());
    }
  }, [isAuthenticated, user, router]);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginCredentials>();

  const onSubmit = async (data: LoginCredentials) => {
    try {
      clearError();
      setSubmitError(null);
      await login(data);
      // 帳密正確但沒有後台權限：明確告知並登出，不要讓人以為登入成功卻被彈到會員中心
      if (!isStaff(useAuthStore.getState().user)) {
        await logout();
        setSubmitError('這個帳號沒有後台權限，請改用管理員帳號登入');
      }
    } catch (err: any) {
      setSubmitError(err.message || '登入失敗，請檢查您的帳號密碼');
    }
  };

  const displayError = error || submitError;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Link href="/" className="text-3xl font-bold text-gray-900 hover:text-gray-700">
            {getAdminConfig().siteName}
          </Link>
          <h2 className="mt-6 text-2xl font-semibold text-gray-900">
            管理員登入
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            使用您的管理員帳號登入後台系統
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center text-lg">登入帳戶</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
              {signedInAsMember && !displayError && (
                <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
                  <p className="text-sm text-amber-800">
                    你目前以會員帳號（{user?.username}）登入，這個帳號沒有後台權限。請在下方改用管理員帳號登入。
                  </p>
                </div>
              )}
              {displayError && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <p className="text-sm text-red-600">{displayError}</p>
                </div>
              )}

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                  用戶名
                </label>
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder="請輸入用戶名"
                  {...register('username', {
                    required: '請輸入用戶名',
                    minLength: {
                      value: 3,
                      message: '用戶名至少需要3個字符',
                    },
                  })}
                  className={errors.username ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}
                />
                {errors.username && (
                  <p className="mt-1 text-sm text-red-600">{errors.username.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  密碼
                </label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="請輸入密碼"
                  {...register('password', {
                    required: '請輸入密碼',
                    minLength: {
                      value: 6,
                      message: '密碼至少需要6個字符',
                    },
                  })}
                  className={errors.password ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                loading={isLoading}
                className="w-full"
                size="lg"
              >
                {isLoading ? '登入中...' : '登入'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center">
          <Link
            href="/"
            className="text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            ← 返回首頁
          </Link>
        </div>
      </div>
    </div>
  );
}