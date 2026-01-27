'use client';

import { useState } from 'react';
import { Metadata } from 'next';
import Button from '@/components/ui/Button';
import { submissionApi } from '@/lib/api';

export default function ContactPage() {
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    message: ''
  });

  const [submissionForm, setSubmissionForm] = useState({
    character_name: '',
    birth_year: '',
    birth_month: '',
    birth_day: '',
    birth_time: '',
    birth_place: '',
    question: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // 這裡需要實作聯絡表單的 API 呼叫
      console.log('Contact form submitted:', contactForm);
      setSubmitMessage('感謝您的聯絡，我們會盡快回覆！');
      setContactForm({ name: '', email: '', message: '' });
    } catch (error) {
      setSubmitMessage('送出時發生錯誤，請稍後再試。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmissionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await submissionApi.create(submissionForm);
      setSubmitMessage('感謝您的匿名提問，我們收到了！');
      setSubmissionForm({
        character_name: '',
        birth_year: '',
        birth_month: '',
        birth_day: '',
        birth_time: '',
        birth_place: '',
        question: ''
      });
    } catch (error: any) {
      setSubmitMessage(error.message || '送出時發生錯誤，請稍後再試。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          聯絡我們
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          歡迎與我們聯繫，或是匿名提問讓我們一起探索孩子的奧秘
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* 一般聯絡表單 */}
        <div className="bg-white rounded-lg shadow-sm border p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            一般聯絡
          </h2>
          
          <form onSubmit={handleContactSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                姓名 *
              </label>
              <input
                type="text"
                id="name"
                required
                value={contactForm.name}
                onChange={(e) => setContactForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple-500 focus:border-transparent"
                placeholder="請輸入您的姓名"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                電子郵件 *
              </label>
              <input
                type="email"
                id="email"
                required
                value={contactForm.email}
                onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple-500 focus:border-transparent"
                placeholder="your.email@example.com"
              />
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                訊息 *
              </label>
              <textarea
                id="message"
                required
                rows={5}
                value={contactForm.message}
                onChange={(e) => setContactForm(prev => ({ ...prev, message: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple-500 focus:border-transparent"
                placeholder="請輸入您想說的話..."
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-brand-purple-600 hover:bg-brand-purple-700"
            >
              {isSubmitting ? '送出中...' : '送出訊息'}
            </Button>
          </form>
        </div>

        {/* 匿名提問表單 */}
        <div className="bg-warm-50 rounded-lg shadow-sm border p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            匿名提問，讓我們一起探索
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            此表單完全匿名，無需提供個人聯絡資訊
          </p>
          
          <form onSubmit={handleSubmissionSubmit} className="space-y-6">
            <div>
              <label htmlFor="character_name" className="block text-sm font-medium text-gray-700 mb-2">
                問題主角的稱呼
              </label>
              <input
                type="text"
                id="character_name"
                value={submissionForm.character_name}
                onChange={(e) => setSubmissionForm(prev => ({ ...prev, character_name: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-warm-500 focus:border-transparent"
                placeholder="例如：我的兒子、小侄女"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="birth_year" className="block text-sm font-medium text-gray-700 mb-2">
                  出生年
                </label>
                <input
                  type="number"
                  id="birth_year"
                  value={submissionForm.birth_year}
                  onChange={(e) => setSubmissionForm(prev => ({ ...prev, birth_year: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-warm-500 focus:border-transparent"
                  placeholder="2020"
                />
              </div>
              <div>
                <label htmlFor="birth_month" className="block text-sm font-medium text-gray-700 mb-2">
                  出生月
                </label>
                <input
                  type="number"
                  id="birth_month"
                  min="1"
                  max="12"
                  value={submissionForm.birth_month}
                  onChange={(e) => setSubmissionForm(prev => ({ ...prev, birth_month: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-warm-500 focus:border-transparent"
                  placeholder="6"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="birth_day" className="block text-sm font-medium text-gray-700 mb-2">
                  出生日
                </label>
                <input
                  type="number"
                  id="birth_day"
                  min="1"
                  max="31"
                  value={submissionForm.birth_day}
                  onChange={(e) => setSubmissionForm(prev => ({ ...prev, birth_day: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-warm-500 focus:border-transparent"
                  placeholder="15"
                />
              </div>
              <div>
                <label htmlFor="birth_time" className="block text-sm font-medium text-gray-700 mb-2">
                  出生時辰
                </label>
                <input
                  type="text"
                  id="birth_time"
                  value={submissionForm.birth_time}
                  onChange={(e) => setSubmissionForm(prev => ({ ...prev, birth_time: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-warm-500 focus:border-transparent"
                  placeholder="例如：上午10點"
                />
              </div>
            </div>

            <div>
              <label htmlFor="birth_place" className="block text-sm font-medium text-gray-700 mb-2">
                出生地
              </label>
              <input
                type="text"
                id="birth_place"
                value={submissionForm.birth_place}
                onChange={(e) => setSubmissionForm(prev => ({ ...prev, birth_place: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-warm-500 focus:border-transparent"
                placeholder="例如：台北市"
              />
            </div>

            <div>
              <label htmlFor="question" className="block text-sm font-medium text-gray-700 mb-2">
                想提問的內容
              </label>
              <textarea
                id="question"
                rows={5}
                value={submissionForm.question}
                onChange={(e) => setSubmissionForm(prev => ({ ...prev, question: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-warm-500 focus:border-transparent"
                placeholder="請描述您想了解的問題或困惑..."
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-warm-600 hover:bg-warm-700"
            >
              {isSubmitting ? '送出中...' : '匿名提問'}
            </Button>
          </form>
        </div>
      </div>

      {/* 顯示提交結果訊息 */}
      {submitMessage && (
        <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-center">
          {submitMessage}
        </div>
      )}

      {/* 社群連結區塊 */}
      <div className="mt-16 text-center">
        <h3 className="text-2xl font-bold text-gray-900 mb-6">
          追蹤我們的社群
        </h3>
        <div className="flex justify-center space-x-6">
          <a
            href="#"
            className="text-gray-600 hover:text-brand-purple-600 transition-colors"
          >
            <span className="sr-only">Facebook</span>
            <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </a>
          <a
            href="#"
            className="text-gray-600 hover:text-brand-purple-600 transition-colors"
          >
            <span className="sr-only">Instagram</span>
            <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 6.62 5.367 11.987 11.988 11.987 6.62 0 11.987-5.367 11.987-11.987C24.014 5.367 18.637.001 12.017.001zM8.449 16.988c-1.297 0-2.448-.49-3.323-1.297C4.198 14.896 3.708 13.745 3.708 12.448s.49-2.448 1.418-3.323c.875-.875 2.026-1.297 3.323-1.297s2.448.422 3.323 1.297c.928.875 1.418 2.026 1.418 3.323s-.49 2.448-1.418 3.243c-.875.807-2.026 1.297-3.323 1.297z"/>
            </svg>
          </a>
          <a
            href="#"
            className="text-gray-600 hover:text-brand-purple-600 transition-colors"
          >
            <span className="sr-only">Line</span>
            <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771z"/>
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}