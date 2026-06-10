'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Button from '@/components/ui/Button';
import { submissionApi } from '@/lib/api';

// 多語言內容
const localeContent: Record<string, {
  pageTitle: string;
  pageDescription: string;
  generalContact: string;
  nameLabel: string;
  namePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  messageLabel: string;
  messagePlaceholder: string;
  submitBtn: string;
  submitting: string;
  successMessage: string;
  errorMessage: string;
  anonymousTitle: string;
  anonymousSubtitle: string;
  characterNameLabel: string;
  characterNamePlaceholder: string;
  birthYearLabel: string;
  birthMonthLabel: string;
  birthDayLabel: string;
  birthTimeLabel: string;
  birthTimePlaceholder: string;
  birthPlaceLabel: string;
  birthPlacePlaceholder: string;
  questionLabel: string;
  questionPlaceholder: string;
  anonymousSubmitBtn: string;
  anonymousSuccessMessage: string;
  socialTitle: string;
}> = {
  'zh-TW': {
    pageTitle: '聯絡我們',
    pageDescription: '歡迎與我們聯繫，讓我們一起探索您的數位轉型策略',
    generalContact: '一般聯絡',
    nameLabel: '姓名 *',
    namePlaceholder: '請輸入您的姓名',
    emailLabel: '電子郵件 *',
    emailPlaceholder: 'your.email@example.com',
    messageLabel: '訊息 *',
    messagePlaceholder: '請輸入您想說的話...',
    submitBtn: '送出訊息',
    submitting: '送出中...',
    successMessage: '感謝您的聯絡，我們會盡快回覆！',
    errorMessage: '送出時發生錯誤，請稍後再試。',
    anonymousTitle: '匿名提問，讓我們一起探索',
    anonymousSubtitle: '此表單完全匿名，無需提供個人聯絡資訊',
    characterNameLabel: '問題主角的稱呼',
    characterNamePlaceholder: '例如：我的企業、我的專案',
    birthYearLabel: '出生年',
    birthMonthLabel: '出生月',
    birthDayLabel: '出生日',
    birthTimeLabel: '出生時辰',
    birthTimePlaceholder: '例如：上午10點',
    birthPlaceLabel: '出生地',
    birthPlacePlaceholder: '例如：台北市',
    questionLabel: '想提問的內容',
    questionPlaceholder: '請描述您想了解的問題或困惑...',
    anonymousSubmitBtn: '匿名提問',
    anonymousSuccessMessage: '感謝您的匿名提問，我們收到了！',
    socialTitle: '追蹤我們的社群',
  },
  'zh-CN': {
    pageTitle: '联系我们',
    pageDescription: '欢迎与我们联系，让我们一起探索您的数字化转型策略',
    generalContact: '一般联系',
    nameLabel: '姓名 *',
    namePlaceholder: '请输入您的姓名',
    emailLabel: '电子邮件 *',
    emailPlaceholder: 'your.email@example.com',
    messageLabel: '消息 *',
    messagePlaceholder: '请输入您想说的话...',
    submitBtn: '发送消息',
    submitting: '发送中...',
    successMessage: '感谢您的联系，我们会尽快回复！',
    errorMessage: '发送时发生错误，请稍后再试。',
    anonymousTitle: '匿名提问，让我们一起探索',
    anonymousSubtitle: '此表单完全匿名，无需提供个人联系信息',
    characterNameLabel: '问题主角的称呼',
    characterNamePlaceholder: '例如：我的企业、我的项目',
    birthYearLabel: '出生年',
    birthMonthLabel: '出生月',
    birthDayLabel: '出生日',
    birthTimeLabel: '出生时辰',
    birthTimePlaceholder: '例如：上午10点',
    birthPlaceLabel: '出生地',
    birthPlacePlaceholder: '例如：北京市',
    questionLabel: '想提问的内容',
    questionPlaceholder: '请描述您想了解的问题或困惑...',
    anonymousSubmitBtn: '匿名提问',
    anonymousSuccessMessage: '感谢您的匿名提问，我们收到了！',
    socialTitle: '关注我们的社交媒体',
  },
  'en': {
    pageTitle: 'Contact Us',
    pageDescription: 'Feel free to contact us to explore your digital transformation strategy',
    generalContact: 'General Contact',
    nameLabel: 'Name *',
    namePlaceholder: 'Enter your name',
    emailLabel: 'Email *',
    emailPlaceholder: 'your.email@example.com',
    messageLabel: 'Message *',
    messagePlaceholder: 'Enter your message...',
    submitBtn: 'Send Message',
    submitting: 'Sending...',
    successMessage: 'Thank you for contacting us! We will reply as soon as possible.',
    errorMessage: 'An error occurred. Please try again later.',
    anonymousTitle: 'Anonymous Questions',
    anonymousSubtitle: 'This form is completely anonymous, no personal contact information required',
    characterNameLabel: 'Name for the subject',
    characterNamePlaceholder: 'e.g., my company, my project',
    birthYearLabel: 'Birth Year',
    birthMonthLabel: 'Birth Month',
    birthDayLabel: 'Birth Day',
    birthTimeLabel: 'Birth Time',
    birthTimePlaceholder: 'e.g., 10:00 AM',
    birthPlaceLabel: 'Birth Place',
    birthPlacePlaceholder: 'e.g., Taipei',
    questionLabel: 'Your Question',
    questionPlaceholder: 'Describe your question or concern...',
    anonymousSubmitBtn: 'Submit Anonymously',
    anonymousSuccessMessage: 'Thank you for your anonymous question! We received it.',
    socialTitle: 'Follow Our Social Media',
  },
  'ja': {
    pageTitle: 'お問い合わせ',
    pageDescription: 'お気軽にお問い合わせください。デジタルトランスフォーメーション戦略についてご相談ください',
    generalContact: '一般的なお問い合わせ',
    nameLabel: 'お名前 *',
    namePlaceholder: 'お名前を入力してください',
    emailLabel: 'メールアドレス *',
    emailPlaceholder: 'your.email@example.com',
    messageLabel: 'メッセージ *',
    messagePlaceholder: 'メッセージを入力してください...',
    submitBtn: '送信',
    submitting: '送信中...',
    successMessage: 'お問い合わせありがとうございます。できるだけ早くお返事いたします。',
    errorMessage: 'エラーが発生しました。後でもう一度お試しください。',
    anonymousTitle: '匿名での質問',
    anonymousSubtitle: 'このフォームは完全に匿名です。個人情報は不要です',
    characterNameLabel: '対象者の呼び方',
    characterNamePlaceholder: '例：私の企業、私のプロジェクト',
    birthYearLabel: '生年',
    birthMonthLabel: '生月',
    birthDayLabel: '生日',
    birthTimeLabel: '生まれた時間',
    birthTimePlaceholder: '例：午前10時',
    birthPlaceLabel: '出生地',
    birthPlacePlaceholder: '例：東京都',
    questionLabel: '質問内容',
    questionPlaceholder: '質問や疑問を記述してください...',
    anonymousSubmitBtn: '匿名で送信',
    anonymousSuccessMessage: '匿名での質問をありがとうございます。受け取りました。',
    socialTitle: 'ソーシャルメディア',
  },
};

export default function LocaleContactPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'zh-TW';
  const content = localeContent[locale] || localeContent['zh-TW'];

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFieldErrors({});

    try {
      console.log('Contact form submitted:', contactForm);
      setSubmitMessage(content.successMessage);
      setContactForm({ name: '', email: '', message: '' });
    } catch (error: any) {
      if (error.errors) {
        const formattedErrors: Record<string, string> = {};
        Object.entries(error.errors).forEach(([key, value]) => {
          formattedErrors[key] = Array.isArray(value) ? value[0] : String(value);
        });
        setFieldErrors(formattedErrors);
      }
      setSubmitMessage(error.message || content.errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmissionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFieldErrors({});

    try {
      await submissionApi.create(submissionForm);
      setSubmitMessage(content.anonymousSuccessMessage);
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
      if (error.errors) {
        const formattedErrors: Record<string, string> = {};
        Object.entries(error.errors).forEach(([key, value]) => {
          formattedErrors[key] = Array.isArray(value) ? value[0] : String(value);
        });
        setFieldErrors(formattedErrors);
      }
      setSubmitMessage(error.message || content.errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          {content.pageTitle}
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          {content.pageDescription}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* 一般聯絡表單 */}
        <div className="bg-white rounded-lg shadow-sm border p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {content.generalContact}
          </h2>

          <form onSubmit={handleContactSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                {content.nameLabel}
              </label>
              <input
                type="text"
                id="name"
                required
                value={contactForm.name}
                onChange={(e) => setContactForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy-400 focus:border-transparent"
                placeholder={content.namePlaceholder}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                {content.emailLabel}
              </label>
              <input
                type="email"
                id="email"
                required
                value={contactForm.email}
                onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy-400 focus:border-transparent"
                placeholder={content.emailPlaceholder}
              />
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                {content.messageLabel}
              </label>
              <textarea
                id="message"
                required
                rows={5}
                value={contactForm.message}
                onChange={(e) => setContactForm(prev => ({ ...prev, message: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy-400 focus:border-transparent"
                placeholder={content.messagePlaceholder}
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-brand-navy-700 hover:bg-brand-navy-800"
            >
              {isSubmitting ? content.submitting : content.submitBtn}
            </Button>
          </form>
        </div>

        {/* 匿名提問表單 */}
        <div className="bg-cream-50 rounded-lg shadow-sm border p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {content.anonymousTitle}
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            {content.anonymousSubtitle}
          </p>

          <form onSubmit={handleSubmissionSubmit} className="space-y-6">
            <div>
              <label htmlFor="character_name" className="block text-sm font-medium text-gray-700 mb-2">
                {content.characterNameLabel}
              </label>
              <input
                type="text"
                id="character_name"
                value={submissionForm.character_name}
                onChange={(e) => setSubmissionForm(prev => ({ ...prev, character_name: e.target.value }))}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-cream-500 focus:border-transparent ${fieldErrors.character_name ? 'border-red-500' : 'border-gray-300'}`}
                placeholder={content.characterNamePlaceholder}
              />
              {fieldErrors.character_name && (
                <p className="mt-1 text-xs text-red-500">{fieldErrors.character_name}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="birth_year" className="block text-sm font-medium text-gray-700 mb-2">
                  {content.birthYearLabel}
                </label>
                <input
                  type="number"
                  id="birth_year"
                  value={submissionForm.birth_year}
                  onChange={(e) => setSubmissionForm(prev => ({ ...prev, birth_year: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cream-500 focus:border-transparent"
                  placeholder="2020"
                />
              </div>
              <div>
                <label htmlFor="birth_month" className="block text-sm font-medium text-gray-700 mb-2">
                  {content.birthMonthLabel}
                </label>
                <input
                  type="number"
                  id="birth_month"
                  min="1"
                  max="12"
                  value={submissionForm.birth_month}
                  onChange={(e) => setSubmissionForm(prev => ({ ...prev, birth_month: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cream-500 focus:border-transparent"
                  placeholder="6"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="birth_day" className="block text-sm font-medium text-gray-700 mb-2">
                  {content.birthDayLabel}
                </label>
                <input
                  type="number"
                  id="birth_day"
                  min="1"
                  max="31"
                  value={submissionForm.birth_day}
                  onChange={(e) => setSubmissionForm(prev => ({ ...prev, birth_day: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cream-500 focus:border-transparent"
                  placeholder="15"
                />
              </div>
              <div>
                <label htmlFor="birth_time" className="block text-sm font-medium text-gray-700 mb-2">
                  {content.birthTimeLabel}
                </label>
                <input
                  type="text"
                  id="birth_time"
                  value={submissionForm.birth_time}
                  onChange={(e) => setSubmissionForm(prev => ({ ...prev, birth_time: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cream-500 focus:border-transparent"
                  placeholder={content.birthTimePlaceholder}
                />
              </div>
            </div>

            <div>
              <label htmlFor="birth_place" className="block text-sm font-medium text-gray-700 mb-2">
                {content.birthPlaceLabel}
              </label>
              <input
                type="text"
                id="birth_place"
                value={submissionForm.birth_place}
                onChange={(e) => setSubmissionForm(prev => ({ ...prev, birth_place: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cream-500 focus:border-transparent"
                placeholder={content.birthPlacePlaceholder}
              />
            </div>

            <div>
              <label htmlFor="question" className="block text-sm font-medium text-gray-700 mb-2">
                {content.questionLabel}
              </label>
              <textarea
                id="question"
                rows={5}
                value={submissionForm.question}
                onChange={(e) => setSubmissionForm(prev => ({ ...prev, question: e.target.value }))}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-cream-500 focus:border-transparent ${fieldErrors.question ? 'border-red-500' : 'border-gray-300'}`}
                placeholder={content.questionPlaceholder}
              />
              {fieldErrors.question && (
                <p className="mt-1 text-xs text-red-500">{fieldErrors.question}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-cream-700 hover:bg-cream-800"
            >
              {isSubmitting ? content.submitting : content.anonymousSubmitBtn}
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
          {content.socialTitle}
        </h3>
        <div className="flex justify-center space-x-6">
          <a
            href="https://www.facebook.com/profile.php?id=61578088371786"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-brand-navy-700 transition-colors"
          >
            <span className="sr-only">Facebook</span>
            <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </a>
          <a
            href="https://www.instagram.com/cldigitalgrowth/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-brand-navy-700 transition-colors"
          >
            <span className="sr-only">Instagram</span>
            <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/>
            </svg>
          </a>
          <a
            href="https://line.me/R/ti/p/@096sxfec"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-brand-navy-700 transition-colors"
          >
            <span className="sr-only">Line</span>
            <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
