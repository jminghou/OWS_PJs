// 電子報相關的站台文案（訂閱表單、確認頁、退訂頁）。@ows/newsletter 套件本身不含文案，由這裡注入。
import type { SubscribeFormLabels, TokenActionLabels } from '@ows/newsletter';

export interface NewsletterContent {
  form: SubscribeFormLabels;
  /** 表單下方小字；{privacy} 會換成隱私權政策連結 */
  formNote: string;
  privacyLinkText: string;
  /** 「電子報」頁面（導覽列入口） */
  page: { title: string; description: string; intro: string };
  confirm: TokenActionLabels;
  unsubscribe: TokenActionLabels;
  backHome: string;
}

export const newsletterContent: Record<string, NewsletterContent> = {
  'zh-TW': {
    form: {
      emailLabel: 'Email',
      placeholder: '你的 Email',
      button: '免費訂閱',
      submitting: '送出中…',
      success: '就差一步：請到信箱點擊確認信裡的連結，完成訂閱。（沒收到的話看一下垃圾信件匣）',
      invalid: '這個 Email 格式不太對，請再確認一次。',
      error: '目前無法送出，請稍後再試。',
    },
    formNote: '不寄垃圾信，隨時可以退訂。詳見{privacy}。',
    privacyLinkText: '隱私權政策',
    page: { title: '電子報', description: '訂閱親紫之間電子報，第一時間收到新的親子紫微文章與觀察。', intro: '訂閱電子報，第一時間收到新的親子紫微文章與觀察。' },
    confirm: {
      title: '確認訂閱',
      working: '正在確認您的訂閱…',
      success: '訂閱完成，謝謝您！之後的電子報會寄到這個信箱。',
      expired: '這個確認連結已經過期，請回首頁重新訂閱一次。',
      invalid: '這個連結無效，可能已經被截斷。請從信件中重新點擊，或回首頁重新訂閱。',
      error: '目前無法完成確認，請稍後再試。',
    },
    unsubscribe: {
      title: '取消訂閱',
      prompt: '確定要取消訂閱親紫之間電子報嗎？',
      button: '確認取消訂閱',
      working: '處理中…',
      success: '已為您取消訂閱，之後不會再收到電子報。想回來隨時歡迎。',
      expired: '這個連結已經失效。',
      invalid: '這個連結無效，可能已經被截斷。請從信件中重新點擊。',
      error: '目前無法處理，請稍後再試。',
    },
    backHome: '回到首頁',
  },
  'zh-CN': {
    form: {
      emailLabel: 'Email',
      placeholder: '你的 Email',
      button: '免费订阅',
      submitting: '提交中…',
      success: '就差一步：请到邮箱点击确认邮件里的链接，完成订阅。（没收到的话看一下垃圾邮件箱）',
      invalid: '这个 Email 格式不太对，请再确认一次。',
      error: '目前无法提交，请稍后再试。',
    },
    formNote: '不发垃圾邮件，随时可以退订。详见{privacy}。',
    privacyLinkText: '隐私政策',
    page: { title: '电子报', description: '订阅亲紫之间电子报，第一时间收到新的亲子紫微文章与观察。', intro: '订阅电子报，第一时间收到新的亲子紫微文章与观察。' },
    confirm: {
      title: '确认订阅',
      working: '正在确认您的订阅…',
      success: '订阅完成，谢谢您！之后的电子报会发送到这个邮箱。',
      expired: '这个确认链接已经过期，请回首页重新订阅一次。',
      invalid: '这个链接无效，可能已经被截断。请从邮件中重新点击，或回首页重新订阅。',
      error: '目前无法完成确认，请稍后再试。',
    },
    unsubscribe: {
      title: '取消订阅',
      prompt: '确定要取消订阅亲紫之间电子报吗？',
      button: '确认取消订阅',
      working: '处理中…',
      success: '已为您取消订阅，之后不会再收到电子报。想回来随时欢迎。',
      expired: '这个链接已经失效。',
      invalid: '这个链接无效，可能已经被截断。请从邮件中重新点击。',
      error: '目前无法处理，请稍后再试。',
    },
    backHome: '回到首页',
  },
  en: {
    form: {
      emailLabel: 'Email',
      placeholder: 'Your email',
      button: 'Subscribe',
      submitting: 'Sending…',
      success: 'One more step: open the confirmation email we just sent and click the link. (Check your spam folder if it is not there.)',
      invalid: "That email address doesn't look right. Please check it.",
      error: "We couldn't send that right now. Please try again later.",
    },
    formNote: 'No spam. Unsubscribe any time. See our {privacy}.',
    privacyLinkText: 'privacy policy',
    page: { title: 'Newsletter', description: 'Subscribe to get new articles and observations on parenting with Zi Wei Dou Shu.', intro: 'Subscribe to get new articles and observations on parenting with Zi Wei Dou Shu.' },
    confirm: {
      title: 'Confirm subscription',
      working: 'Confirming your subscription…',
      success: "You're subscribed. Thank you! Future issues will arrive at this address.",
      expired: 'This confirmation link has expired. Please subscribe again from the home page.',
      invalid: 'This link is not valid. It may have been cut off. Please click it again from the email, or subscribe again.',
      error: "We couldn't confirm right now. Please try again later.",
    },
    unsubscribe: {
      title: 'Unsubscribe',
      prompt: 'Do you want to unsubscribe from the newsletter?',
      button: 'Yes, unsubscribe',
      working: 'Working…',
      success: "You've been unsubscribed and won't receive further issues. You're welcome back any time.",
      expired: 'This link is no longer valid.',
      invalid: 'This link is not valid. It may have been cut off. Please click it again from the email.',
      error: "We couldn't process that right now. Please try again later.",
    },
    backHome: 'Back to home',
  },
  ja: {
    form: {
      emailLabel: 'メールアドレス',
      placeholder: 'メールアドレス',
      button: '無料で登録',
      submitting: '送信中…',
      success: 'あと一歩です。確認メールのリンクをクリックして登録を完了してください。（届かない場合は迷惑メールフォルダもご確認ください）',
      invalid: 'メールアドレスの形式が正しくないようです。もう一度ご確認ください。',
      error: 'ただいま送信できません。しばらくしてからもう一度お試しください。',
    },
    formNote: '迷惑メールは送りません。いつでも配信停止できます。詳しくは{privacy}をご覧ください。',
    privacyLinkText: 'プライバシーポリシー',
    page: { title: 'ニュースレター', description: 'ニュースレターに登録すると、紫微斗数と子育ての新しい記事や気づきが届きます。', intro: 'ニュースレターに登録すると、紫微斗数と子育ての新しい記事や気づきが届きます。' },
    confirm: {
      title: '登録の確認',
      working: '登録を確認しています…',
      success: '登録が完了しました。ありがとうございます。今後のニュースレターはこのアドレスに届きます。',
      expired: 'この確認リンクは期限切れです。トップページからもう一度ご登録ください。',
      invalid: 'このリンクは無効です。途中で切れている可能性があります。メールからもう一度クリックするか、再度ご登録ください。',
      error: 'ただいま確認できません。しばらくしてからもう一度お試しください。',
    },
    unsubscribe: {
      title: '配信停止',
      prompt: 'ニュースレターの配信を停止しますか？',
      button: '配信を停止する',
      working: '処理中…',
      success: '配信を停止しました。今後ニュースレターは届きません。またいつでもお戻りください。',
      expired: 'このリンクは無効になりました。',
      invalid: 'このリンクは無効です。途中で切れている可能性があります。メールからもう一度クリックしてください。',
      error: 'ただいま処理できません。しばらくしてからもう一度お試しください。',
    },
    backHome: 'トップページへ',
  },
};

export function getNewsletterContent(locale: string): NewsletterContent {
  return newsletterContent[locale] ?? newsletterContent['zh-TW'];
}

/** 語系首頁／站內路徑：預設語系不帶前綴 */
export function localePath(locale: string, path = ''): string {
  const prefix = locale === 'zh-TW' ? '' : `/${locale}`;
  return `${prefix}${path}` || '/';
}
