// 隱私權政策文案。內容只描述系統實際在做的事；若功能有變（例如改用寄信服務商、新增追蹤工具）要同步更新。
export interface PrivacyContent {
  title: string;
  description: string;
  updated: string;
  intro: string;
  sections: { heading: string; paragraphs: string[] }[];
  contactLinkText: string;
}

export const PRIVACY_UPDATED_ISO = '2026-09-19';

export const privacyContent: Record<string, PrivacyContent> = {
  'zh-TW': {
    title: '隱私權政策',
    description: '親紫之間如何收集、使用與保護您的個人資料，以及您可以如何退訂與要求刪除。',
    updated: '最後更新：2026 年 9 月 19 日',
    intro: '親紫之間重視您的隱私。這份說明列出我們會收集哪些資料、為什麼收集，以及您可以怎麼做。',
    sections: [
      {
        heading: '訂閱電子報時',
        paragraphs: [
          '我們會記錄您填寫的 Email、您當時使用的頁面語言、表單所在的位置，以及送出訂閱的時間、IP 位址與瀏覽器資訊。後面這幾項是用來證明這筆訂閱確實經過您本人同意。',
          '送出後我們會寄一封確認信，您點擊信中的連結後才算完成訂閱。沒有完成確認的信箱不會收到電子報。',
          '這些資料只用來寄送電子報。我們不會出售您的 Email，也不會提供給第三方做行銷。寄送電子報時可能會使用寄信服務，屆時只會提供寄送所需的 Email。',
        ],
      },
      {
        heading: '退訂與刪除',
        paragraphs: [
          '每一封電子報與確認信都附有退訂連結，您隨時可以退訂，不需要登入，也不需要說明原因。',
          '退訂後我們會保留「已退訂」的紀錄，目的是避免日後再次寄信給您。如果您希望連這筆紀錄一併刪除，請透過聯絡頁面告訴我們，我們會永久刪除。',
        ],
      },
      {
        heading: '會員帳號與命盤',
        paragraphs: [
          '註冊會員時，我們會保存您提供的帳號資料。使用線上排盤時，您輸入的出生資料用於產生命盤；單純試排不會保存。當您從排盤頁註冊會員，或以會員身分選擇保存時，該命盤（含出生資料）才會存進您的帳號。',
          '您可以透過聯絡頁面要求查閱、更正或刪除您的帳號與已保存的命盤。',
        ],
      },
      {
        heading: 'Cookie',
        paragraphs: [
          '本站使用必要的 Cookie 來維持登入狀態與記住您選擇的語言。',
        ],
      },
      {
        heading: '聯絡我們',
        paragraphs: [
          '對這份政策或您的個人資料有任何問題，或想行使上述權利，請透過聯絡頁面與我們聯繫。',
        ],
      },
    ],
    contactLinkText: '前往聯絡頁面',
  },
  'zh-CN': {
    title: '隐私政策',
    description: '亲紫之间如何收集、使用与保护您的个人资料，以及您可以如何退订与要求删除。',
    updated: '最后更新：2026 年 9 月 19 日',
    intro: '亲紫之间重视您的隐私。这份说明列出我们会收集哪些资料、为什么收集，以及您可以怎么做。',
    sections: [
      {
        heading: '订阅电子报时',
        paragraphs: [
          '我们会记录您填写的 Email、您当时使用的页面语言、表单所在的位置，以及提交订阅的时间、IP 地址与浏览器信息。后面这几项用来证明这笔订阅确实经过您本人同意。',
          '提交后我们会发送一封确认邮件，您点击邮件中的链接后才算完成订阅。没有完成确认的邮箱不会收到电子报。',
          '这些资料只用来发送电子报。我们不会出售您的 Email，也不会提供给第三方做营销。发送电子报时可能会使用邮件发送服务，届时只会提供发送所需的 Email。',
        ],
      },
      {
        heading: '退订与删除',
        paragraphs: [
          '每一封电子报与确认邮件都附有退订链接，您随时可以退订，不需要登录，也不需要说明原因。',
          '退订后我们会保留“已退订”的记录，目的是避免日后再次给您发信。如果您希望连这笔记录一并删除，请通过联系页面告诉我们，我们会永久删除。',
        ],
      },
      {
        heading: '会员账号与命盘',
        paragraphs: [
          '注册会员时，我们会保存您提供的账号资料。使用在线排盘时，您输入的出生资料用于生成命盘；单纯试排不会保存。当您从排盘页注册会员，或以会员身份选择保存时，该命盘（含出生资料）才会存进您的账号。',
          '您可以通过联系页面要求查阅、更正或删除您的账号与已保存的命盘。',
        ],
      },
      {
        heading: 'Cookie',
        paragraphs: ['本站使用必要的 Cookie 来维持登录状态与记住您选择的语言。'],
      },
      {
        heading: '联系我们',
        paragraphs: ['对这份政策或您的个人资料有任何问题，或想行使上述权利，请通过联系页面与我们联系。'],
      },
    ],
    contactLinkText: '前往联系页面',
  },
  en: {
    title: 'Privacy Policy',
    description: 'How Qin Zi Blog collects, uses and protects your personal data, and how you can unsubscribe or ask for deletion.',
    updated: 'Last updated: 19 September 2026',
    intro: 'We take your privacy seriously. This page lists what we collect, why we collect it, and what you can do about it.',
    sections: [
      {
        heading: 'When you subscribe to the newsletter',
        paragraphs: [
          'We record the email address you enter, the page language you were using, where on the site the form was, and the time, IP address and browser information of your request. We keep the last few items as proof that you consented to the subscription.',
          'We then send a confirmation email. Your subscription is complete only after you click the link in it. Addresses that are never confirmed do not receive the newsletter.',
          'We use this data only to send the newsletter. We do not sell your email address or share it with third parties for marketing. We may use an email delivery service to send the newsletter, and in that case we share only the email address needed for delivery.',
        ],
      },
      {
        heading: 'Unsubscribing and deletion',
        paragraphs: [
          'Every newsletter and confirmation email includes an unsubscribe link. You can unsubscribe at any time without logging in and without giving a reason.',
          'After you unsubscribe we keep a record marked "unsubscribed" so that we do not email you again. If you would like that record deleted as well, tell us through the contact page and we will delete it permanently.',
        ],
      },
      {
        heading: 'Member accounts and charts',
        paragraphs: [
          'When you register, we store the account details you provide. When you use the online chart, the birth data you enter is used to generate the chart, and trying it out saves nothing. A chart (including its birth data) is saved to your account only when you register from the chart page or choose to save it as a member.',
          'You can ask to see, correct or delete your account and saved charts through the contact page.',
        ],
      },
      {
        heading: 'Cookies',
        paragraphs: ['This site uses essential cookies to keep you logged in and to remember your language choice.'],
      },
      {
        heading: 'Contact us',
        paragraphs: ['If you have questions about this policy or your personal data, or want to use any of the rights above, please reach us through the contact page.'],
      },
    ],
    contactLinkText: 'Go to the contact page',
  },
  ja: {
    title: 'プライバシーポリシー',
    description: '親紫の間が個人情報をどのように収集・利用・保護するか、また配信停止や削除の方法についてご説明します。',
    updated: '最終更新日：2026年9月19日',
    intro: '親紫の間はプライバシーを大切にしています。このページでは、収集する情報とその理由、そして皆さまができることをご説明します。',
    sections: [
      {
        heading: 'ニュースレターに登録するとき',
        paragraphs: [
          'ご入力いただいたメールアドレス、ご利用中のページの言語、フォームの設置場所、登録時刻、IPアドレス、ブラウザ情報を記録します。後半の項目は、ご本人が登録に同意したことを示す記録として保存します。',
          '送信後に確認メールをお送りします。メール内のリンクをクリックした時点で登録が完了します。確認が完了していないアドレスにニュースレターは届きません。',
          'これらの情報はニュースレターの配信にのみ利用します。メールアドレスを販売したり、マーケティング目的で第三者に提供したりすることはありません。配信にメール配信サービスを利用する場合は、配信に必要なメールアドレスのみを提供します。',
        ],
      },
      {
        heading: '配信停止と削除',
        paragraphs: [
          'すべてのニュースレターと確認メールに配信停止リンクがあります。ログインも理由の説明も不要で、いつでも配信を停止できます。',
          '配信停止後は、再びメールをお送りしないために「配信停止済み」の記録を保持します。この記録も削除したい場合は、お問い合わせページからご連絡ください。完全に削除します。',
        ],
      },
      {
        heading: '会員アカウントと命盤',
        paragraphs: [
          '会員登録の際にご提供いただいたアカウント情報を保存します。オンライン命盤作成で入力された出生情報は命盤の生成に利用し、お試しの段階では保存しません。命盤作成ページから会員登録した場合、または会員として保存を選択した場合にのみ、命盤（出生情報を含む）がアカウントに保存されます。',
          'アカウントや保存した命盤の開示・訂正・削除は、お問い合わせページからご依頼いただけます。',
        ],
      },
      {
        heading: 'Cookie',
        paragraphs: ['当サイトは、ログイン状態の維持と選択した言語の記憶のために必要な Cookie を使用します。'],
      },
      {
        heading: 'お問い合わせ',
        paragraphs: ['このポリシーや個人情報についてのご質問、上記の権利の行使をご希望の場合は、お問い合わせページからご連絡ください。'],
      },
    ],
    contactLinkText: 'お問い合わせページへ',
  },
};

export function getPrivacyContent(locale: string): PrivacyContent {
  return privacyContent[locale] ?? privacyContent['zh-TW'];
}
