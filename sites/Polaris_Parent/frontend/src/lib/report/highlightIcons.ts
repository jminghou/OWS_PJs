/**
 * 商品頁「亮點」可選的圖示（lucide-react）。前台與後台的圖示表共用這一份。
 * 要加圖示就在這裡加一行；value 存進資料庫，已用的 value 不要改名。
 * 不開放整套 lucide（上千個）：前台只會打包這裡列出的圖示。
 */
import {
  Award, Baby, BadgeCheck, Bookmark, BookHeart, BookOpen, Cake, Calendar, CalendarHeart, Clock, Compass,
  CreditCard, Crown, Download, Eye, Feather, FileText, Flower2, Footprints, Gem, Gift, Globe, GraduationCap,
  Hand, Headphones, Heart, HeartHandshake, HelpCircle, Home, Hourglass, Image, Infinity, Languages, Leaf,
  Library, Lightbulb, Lock, Mail, MapPin, MessageCircle, Moon, Music, NotebookPen, Orbit, Package, Palette,
  PenLine, Phone, Printer, Puzzle, Rainbow, School, ScrollText, Search, ShieldCheck, Smile, Sparkles, Sprout,
  Star, Stars, Sun, Truck, UserRound, Users, UsersRound, Wand2, Zap, type LucideIcon,
} from 'lucide-react';

export const HIGHLIGHT_ICONS: { value: string; label: string; Icon: LucideIcon }[] = [
  // 既有的五個（value 已存在資料裡）
  { value: 'users', label: '人物', Icon: Users },
  { value: 'eye', label: '眼睛', Icon: Eye },
  { value: 'clock', label: '時鐘', Icon: Clock },
  { value: 'book', label: '書本', Icon: BookOpen },
  { value: 'pen', label: '筆', Icon: PenLine },
  // 人與家庭
  { value: 'user', label: '一個人', Icon: UserRound },
  { value: 'family', label: '家人', Icon: UsersRound },
  { value: 'baby', label: '寶寶', Icon: Baby },
  { value: 'heart', label: '愛心', Icon: Heart },
  { value: 'heart-handshake', label: '陪伴', Icon: HeartHandshake },
  { value: 'hand', label: '手', Icon: Hand },
  { value: 'smile', label: '笑臉', Icon: Smile },
  { value: 'home', label: '家', Icon: Home },
  { value: 'footprints', label: '腳印', Icon: Footprints },
  { value: 'cake', label: '生日', Icon: Cake },
  // 命理與星象
  { value: 'sparkles', label: '閃光', Icon: Sparkles },
  { value: 'star', label: '星星', Icon: Star },
  { value: 'stars', label: '星群', Icon: Stars },
  { value: 'moon', label: '月亮', Icon: Moon },
  { value: 'sun', label: '太陽', Icon: Sun },
  { value: 'orbit', label: '軌道', Icon: Orbit },
  { value: 'compass', label: '羅盤', Icon: Compass },
  { value: 'hourglass', label: '沙漏', Icon: Hourglass },
  { value: 'calendar', label: '日曆', Icon: Calendar },
  { value: 'calendar-heart', label: '紀念日', Icon: CalendarHeart },
  { value: 'wand', label: '魔法棒', Icon: Wand2 },
  { value: 'infinity', label: '無限', Icon: Infinity },
  // 成長與學習
  { value: 'lightbulb', label: '燈泡', Icon: Lightbulb },
  { value: 'graduation', label: '學士帽', Icon: GraduationCap },
  { value: 'school', label: '學校', Icon: School },
  { value: 'sprout', label: '新芽', Icon: Sprout },
  { value: 'leaf', label: '葉子', Icon: Leaf },
  { value: 'flower', label: '花', Icon: Flower2 },
  { value: 'rainbow', label: '彩虹', Icon: Rainbow },
  { value: 'puzzle', label: '拼圖', Icon: Puzzle },
  { value: 'music', label: '音樂', Icon: Music },
  { value: 'palette', label: '調色盤', Icon: Palette },
  // 書與內容
  { value: 'book-heart', label: '愛心書', Icon: BookHeart },
  { value: 'library', label: '書架', Icon: Library },
  { value: 'bookmark', label: '書籤', Icon: Bookmark },
  { value: 'notebook', label: '筆記本', Icon: NotebookPen },
  { value: 'scroll', label: '卷軸', Icon: ScrollText },
  { value: 'file', label: '文件', Icon: FileText },
  { value: 'feather', label: '羽毛筆', Icon: Feather },
  { value: 'image', label: '圖片', Icon: Image },
  { value: 'printer', label: '印刷', Icon: Printer },
  { value: 'languages', label: '多語言', Icon: Languages },
  // 購買與服務
  { value: 'gift', label: '禮物', Icon: Gift },
  { value: 'package', label: '包裹', Icon: Package },
  { value: 'truck', label: '運送', Icon: Truck },
  { value: 'download', label: '下載', Icon: Download },
  { value: 'credit-card', label: '付款', Icon: CreditCard },
  { value: 'shield', label: '安心', Icon: ShieldCheck },
  { value: 'lock', label: '隱私', Icon: Lock },
  { value: 'badge', label: '認證', Icon: BadgeCheck },
  { value: 'award', label: '獎章', Icon: Award },
  { value: 'crown', label: '皇冠', Icon: Crown },
  { value: 'gem', label: '寶石', Icon: Gem },
  { value: 'zap', label: '快速', Icon: Zap },
  { value: 'globe', label: '全球', Icon: Globe },
  { value: 'map-pin', label: '地點', Icon: MapPin },
  { value: 'search', label: '搜尋', Icon: Search },
  { value: 'help', label: '問號', Icon: HelpCircle },
  { value: 'mail', label: '信件', Icon: Mail },
  { value: 'message', label: '訊息', Icon: MessageCircle },
  { value: 'phone', label: '電話', Icon: Phone },
  { value: 'headphones', label: '客服', Icon: Headphones },
];

const BY_VALUE = new Map(HIGHLIGHT_ICONS.map((i) => [i.value, i]));

export const isHighlightIcon = (v: unknown): v is string => typeof v === 'string' && BY_VALUE.has(v);

/** 找不到（例如圖示被移除）就用書本 */
export const highlightIcon = (v: string) => (BY_VALUE.get(v) ?? BY_VALUE.get('book')!).Icon;
