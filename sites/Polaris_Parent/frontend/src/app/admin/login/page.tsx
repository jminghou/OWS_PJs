'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { LoginCredentials } from '@/types';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

export default function LoginPage() {
  const router = useRouter();
  const { login, error, isLoading, clearError, isAuthenticated } = useAuthStore();
  const [submitError, setSubmitError] = useState<string | null>(null);

  // 如果已經登入，直接導向後台
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/admin/dashboard');
    }
  }, [isAuthenticated, router]);
  
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
            Orion Blog
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