'use client';

import { useState } from 'react';
import { Metadata } from 'next';
import Alert from '@/components/ui/Alert';
import BrandButton from '@/components/ui/BrandButton';
import { submissionApi } from '@/lib/api';

// 表單（docs/BRAND_GUIDELINES.md §6.3）
const inputCls =
  'w-full rounded-2xl border-[1.5px] border-line-strong bg-white px-[18px] py-[13px] text-base text-ink placeholder:text-muted ' +
  'focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100';
const labelCls = 'mb-1.5 block text-sm font-medium text-ink';
const cardTitleCls = 'font-heading text-[22px] font-normal text-ink md:text-h3';
const socialLinkCls =
  'rounded-full p-2 text-text transition-colors duration-150 ease-out hover:text-pink-600 ' +
  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100';

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
  // 只決定提示框的語意色（成功 / 錯誤），不影響送出流程
  const [submitTone, setSubmitTone] = useState<'success' | 'error'>('success');

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // 這裡需要實作聯絡表單的 API 呼叫
      console.log('Contact form submitted:', contactForm);
      setSubmitTone('success');
      setSubmitMessage('感謝您的聯絡，我們會盡快回覆！');
      setContactForm({ name: '', email: '', message: '' });
    } catch (error) {
      setSubmitTone('error');
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
      setSubmitTone('success');
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
      setSubmitTone('error');
      setSubmitMessage(error.message || '送出時發生錯誤，請稍後再試。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-content px-4 py-16 md:px-6 md:py-24">
      <div className="mb-12 text-center">
        <h1 className="mb-4 font-heading text-[32px] font-normal text-ink md:text-h1">
          聯絡我們
        </h1>
        <p className="mx-auto max-w-2xl text-[17px] text-text md:text-lead">
          歡迎與我們聯繫，或是匿名提問讓我們一起探索孩子的奧秘
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
        {/* 一般聯絡表單 */}
        <div className="rounded-card bg-white p-6 md:p-8">
          <h2 className={`mb-6 ${cardTitleCls}`}>
            一般聯絡
          </h2>

          <form onSubmit={handleContactSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className={labelCls}>
                姓名 *
              </label>
              <input
                type="text"
                id="name"
                required
                value={contactForm.name}
                onChange={(e) => setContactForm(prev => ({ ...prev, name: e.target.value }))}
                className={inputCls}
                placeholder="請輸入您的姓名"
              />
            </div>

            <div>
              <label htmlFor="email" className={labelCls}>
                電子郵件 *
              </label>
              <input
                type="email"
                id="email"
                required
                value={contactForm.email}
                onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                className={inputCls}
                placeholder="your.email@example.com"
              />
            </div>

            <div>
              <label htmlFor="message" className={labelCls}>
                訊息 *
              </label>
              <textarea
                id="message"
                required
                rows={5}
                value={contactForm.message}
                onChange={(e) => setContactForm(prev => ({ ...prev, message: e.target.value }))}
                className={inputCls}
                placeholder="請輸入您想說的話..."
              />
            </div>

            <BrandButton
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? '送出中...' : '送出訊息'}
            </BrandButton>
          </form>
        </div>

        {/* 匿名提問表單 */}
        <div className="rounded-card bg-white p-6 md:p-8">
          <h2 className={`mb-2 ${cardTitleCls}`}>
            匿名提問，讓我們一起探索
          </h2>
          <p className="mb-6 text-sm text-text">
            此表單完全匿名，無需提供個人聯絡資訊
          </p>

          <form onSubmit={handleSubmissionSubmit} className="space-y-6">
            <div>
              <label htmlFor="character_name" className={labelCls}>
                問題主角的稱呼
              </label>
              <input
                type="text"
                id="character_name"
                value={submissionForm.character_name}
                onChange={(e) => setSubmissionForm(prev => ({ ...prev, character_name: e.target.value }))}
                className={inputCls}
                placeholder="例如：我的兒子、小侄女"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="birth_year" className={labelCls}>
                  出生年
                </label>
                <input
                  type="number"
                  id="birth_year"
                  value={submissionForm.birth_year}
                  onChange={(e) => setSubmissionForm(prev => ({ ...prev, birth_year: e.target.value }))}
                  className={`${inputCls} font-latin`}
                  placeholder="2020"
                />
              </div>
              <div>
                <label htmlFor="birth_month" className={labelCls}>
                  出生月
                </label>
                <input
                  type="number"
                  id="birth_month"
                  min="1"
                  max="12"
                  value={submissionForm.birth_month}
                  onChange={(e) => setSubmissionForm(prev => ({ ...prev, birth_month: e.target.value }))}
                  className={`${inputCls} font-latin`}
                  placeholder="6"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="birth_day" className={labelCls}>
                  出生日
                </label>
                <input
                  type="number"
                  id="birth_day"
                  min="1"
                  max="31"
                  value={submissionForm.birth_day}
                  onChange={(e) => setSubmissionForm(prev => ({ ...prev, birth_day: e.target.value }))}
                  className={`${inputCls} font-latin`}
                  placeholder="15"
                />
              </div>
              <div>
                <label htmlFor="birth_time" className={labelCls}>
                  出生時辰
                </label>
                <input
                  type="text"
                  id="birth_time"
                  value={submissionForm.birth_time}
                  onChange={(e) => setSubmissionForm(prev => ({ ...prev, birth_time: e.target.value }))}
                  className={inputCls}
                  placeholder="例如：上午10點"
                />
              </div>
            </div>

            <div>
              <label htmlFor="birth_place" className={labelCls}>
                出生地
              </label>
              <input
                type="text"
                id="birth_place"
                value={submissionForm.birth_place}
                onChange={(e) => setSubmissionForm(prev => ({ ...prev, birth_place: e.target.value }))}
                className={inputCls}
                placeholder="例如：台北市"
              />
            </div>

            <div>
              <label htmlFor="question" className={labelCls}>
                想提問的內容
              </label>
              <textarea
                id="question"
                rows={5}
                value={submissionForm.question}
                onChange={(e) => setSubmissionForm(prev => ({ ...prev, question: e.target.value }))}
                className={inputCls}
                placeholder="請描述您想了解的問題或困惑..."
              />
            </div>

            {/* 同一屏已有「送出訊息」primary，這裡用 secondary */}
            <BrandButton
              type="submit"
              variant="secondary"
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? '送出中...' : '匿名提問'}
            </BrandButton>
          </form>
        </div>
      </div>

      {/* 顯示提交結果訊息 */}
      {submitMessage && (
        <Alert tone={submitTone} className="mx-auto mt-8 max-w-2xl">
          {submitMessage}
        </Alert>
      )}

      {/* 社群連結區塊 */}
      <div className="mt-16 text-center">
        <h3 className="mb-6 font-heading text-[22px] font-normal text-ink md:text-h3">
          追蹤我們的社群
        </h3>
        <div className="flex justify-center gap-4">
          <a
            href="#"
            className={socialLinkCls}
          >
            <span className="sr-only">Facebook</span>
            <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </a>
          <a
            href="#"
            className={socialLinkCls}
          >
            <span className="sr-only">Instagram</span>
            <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 6.62 5.367 11.987 11.988 11.987 6.62 0 11.987-5.367 11.987-11.987C24.014 5.367 18.637.001 12.017.001zM8.449 16.988c-1.297 0-2.448-.49-3.323-1.297C4.198 14.896 3.708 13.745 3.708 12.448s.49-2.448 1.418-3.323c.875-.875 2.026-1.297 3.323-1.297s2.448.422 3.323 1.297c.928.875 1.418 2.026 1.418 3.323s-.49 2.448-1.418 3.243c-.875.807-2.026 1.297-3.323 1.297z"/>
            </svg>
          </a>
          <a
            href="#"
            className={socialLinkCls}
          >
            <span className="sr-only">Line</span>
            <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771z"/>
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
