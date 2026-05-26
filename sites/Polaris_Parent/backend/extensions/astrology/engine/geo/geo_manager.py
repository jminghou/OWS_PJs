import requests
from typing import Dict, List, Optional, Any

class GeographicDataManager:
    """地理資料管理器 - Web 版本"""
    
    def __init__(self):
        """初始化地理資料"""
        self.geographic_data = {
            "亞洲": {
                "中國": ["北京", "上海", "廣州", "深圳", "天津", "重慶", "成都", "武漢", "西安", "南京", "杭州", "蘇州"],
                "台灣": ["台北", "新北", "桃園", "台中", "台南", "高雄", "基隆", "新竹", "嘉義", "宜蘭", "花蓮", "台東", "南投", "金門", "澎湖", "馬祖"],
                "日本": ["東京", "大阪", "京都", "橫濱", "名古屋", "神戶", "福岡", "札幌", "廣島", "仙台", "千葉", "埼玉"],
                "韓國": ["首爾", "釜山", "大邱", "仁川", "光州", "大田", "蔚山", "水原", "高陽", "龍仁", "城南", "清州"],
                "印度": ["新德里", "孟買", "班加羅爾", "海德拉巴", "艾哈邁達巴德", "清奈", "加爾各答", "蘇拉特", "浦那", "齋浦爾"],
                "新加坡": ["新加坡"],
                "泰國": ["曼谷", "清邁", "芭達雅", "普吉", "華欣", "春武里", "合艾", "烏汶"],
                "馬來西亞": ["吉隆坡", "檳城", "新山", "馬六甲", "怡保", "古晉", "亞庇", "亞羅士打"],
                "越南": ["河內", "胡志明市", "海防", "峴港", "芽莊", "順化", "會安", "大叻", "美奈", "頭頓"],
                "柬埔寨": ["金邊", "暹粒", "馬德望", "西哈努克市", "貢布", "拜林", "上丁", "桔井"],
                "緬甸": ["仰光", "奈比多", "曼德勒", "毛淡棉", "勃生", "密支那", "實兌", "東枝"],
                "菲律賓": ["馬尼拉", "宿霧", "達沃", "怡朗", "三寶淵", "卡加延德奧羅", "巴科洛德", "安吉利斯", "奧隆阿波", "打拉"],
                "印尼": ["雅加達", "泗水", "萬隆", "棉蘭", "三寶壟", "巴淡", "北干巴魯", "巴里巴板", "馬卡薩", "巴東"],
                "汶萊": ["斯里巴加灣市", "瓜拉勿洞", "馬來奕", "都東"]
            },
            "歐洲": {
                "德國": ["柏林", "慕尼黑", "漢堡", "科隆", "法蘭克福", "斯圖加特", "杜塞道夫", "多特蒙德", "埃森", "萊比錫", "不來梅", "德勒斯登", "漢諾威", "紐倫堡", "杜伊斯堡", "Eisenach"],
                "法國": ["巴黎", "馬賽", "里昂", "圖盧茲", "尼斯", "南特", "斯特拉斯堡", "蒙彼利埃", "波爾多", "里爾", "雷恩", "勒阿弗爾", "Saint-Étienne", "土倫", "格勒諾布爾"],
                "英國": ["倫敦", "伯明翰", "利茲", "格拉斯哥", "謝菲爾德", "布拉德福德", "愛丁堡", "利物浦", "曼徹斯特", "布里斯托", "韋克菲爾德", "卡迪夫", "考文垂", "萊斯特"],
                "義大利": ["羅馬", "米蘭", "那不勒斯", "都靈", "巴勒莫", "熱那亞", "博洛尼亞", "佛羅倫斯", "巴里", "卡塔尼亞", "威尼斯", "維羅納", "墨西拿", "帕多瓦"],
                "西班牙": ["馬德里", "巴塞隆納", "瓦倫西亞", "塞維亞", "薩拉戈薩", "馬拉加", "穆爾西亞", "帕爾馬", "拉斯帕爾馬斯", "畢爾巴鄂", "阿利坎特", "科爾多瓦", "瓦拉多利德", "維哥"],
                "荷蘭": ["阿姆斯特丹", "鹿特丹", "海牙", "烏特勒支", "埃因霍芬", "蒂爾堡", "格羅寧根", "阿爾梅勒", "布雷達", "奈梅亨"],
                "瑞士": ["蘇黎世", "日內瓦", "巴塞爾", "洛桑", "伯恩", "溫特圖爾", "盧塞恩", "聖加侖", "盧加諾", "比爾"],
                "奧地利": ["維也納", "格拉茨", "林茨", "薩爾茨堡", "因斯布魯克", "克拉根福", "維爾斯", "多恩比恩", "維納紐施塔特", "斯泰爾"]
            },
            "北美洲": {
                "美國": ["紐約", "洛杉磯", "芝加哥", "休斯頓", "費城", "鳳凰城", "聖安東尼奧", "聖地亞哥", "達拉斯", "聖荷西", "奧斯汀", "傑克遜維爾", "舊金山", "印第安納波利斯", "哥倫布", "夏洛特", "西雅圖", "丹佛", "華盛頓", "波士頓"],
                "加拿大": ["多倫多", "蒙特婁", "溫哥華", "卡爾加里", "埃德蒙頓", "渥太華", "溫尼伯", "魁北克市", "哈密爾頓", "基奇納"],
                "墨西哥": ["墨西哥城", "瓜達拉哈拉", "蒙特雷", "普埃布拉", "蒂華納", "萊昂", "華雷斯城", "托雷翁", "克雷塔羅", "奇瓦瓦"]
            },
            "南美洲": {
                "巴西": ["聖保羅", "里約熱內盧", "巴西利亞", "薩爾瓦多", "福塔雷薩", "貝洛奧里藏特", "馬瑙斯", "庫里提巴", "累西費", "戈亞尼亞"],
                "阿根廷": ["布宜諾斯艾利斯", "科爾多瓦", "羅薩里奧", "門多薩", "圖庫曼", "拉普拉塔", "馬德普拉塔", "薩爾塔", "聖胡安", "雷西斯滕西亞"],
                "智利": ["聖地亞哥", "瓦爾帕萊索", "康塞普西翁", "拉塞雷納", "安托法加斯塔", "特木科", "拉金塔", "塔爾卡", "奇廉", "伊基克"],
                "哥倫比亞": ["波哥大", "麥德林", "卡利", "巴蘭基亞", "卡塔赫納", "庫庫塔", "布卡拉曼加", "佩雷拉", "伊瓦格", "聖瑪爾塔"]
            },
            "大洋洲": {
                "澳大利亞": ["雪梨", "墨爾本", "布里斯班", "珀斯", "阿德萊德", "黃金海岸", "紐卡索", "坎培拉", "沃隆貢", "吉朗"],
                "紐西蘭": ["奧克蘭", "威靈頓", "基督城", "哈密爾頓", "陶朗加", "但尼丁", "帕默斯頓北", "羅托魯瓦", "納爾遜", "新普利茅斯"]
            },
            "非洲": {
                "南非": ["約翰尼斯堡", "開普敦", "德班", "比勒陀利亞", "伊麗莎白港", "布隆方丹", "東倫敦", "內爾斯普雷特", "克萊蒙德", "波羅克瓦尼"],
                "埃及": ["開羅", "亞歷山大", "吉薩", "舒卜拉海邁", "盧克索", "阿斯旺", "伊斯梅利亞", "蘇伊士", "坦塔", "曼蘇拉"],
                "摩洛哥": ["卡薩布蘭卡", "拉巴特", "菲斯", "馬拉喀什", "阿加迪爾", "丹吉爾", "梅克內斯", "烏季達", "凱尼特拉", "泰圖安"],
                "奈及利亞": ["拉哥斯", "卡諾", "伊巴丹", "卡杜納", "哈科特港", "貝寧城", "邁杜古里", "扎里亞", "阿貝奧庫塔", "約斯"]
            }
        }
        
        # 國家名稱中英文對照
        self.country_mapping = {
            "台灣": "Taiwan", "中國": "China", "日本": "Japan", "韓國": "South Korea",
            "印度": "India", "新加坡": "Singapore", "泰國": "Thailand", "馬來西亞": "Malaysia",
            "越南": "Vietnam", "柬埔寨": "Cambodia", "緬甸": "Myanmar", "菲律賓": "Philippines",
            "印尼": "Indonesia", "汶萊": "Brunei", "德國": "Germany", "法國": "France",
            "英國": "United Kingdom", "義大利": "Italy", "西班牙": "Spain", "荷蘭": "Netherlands",
            "瑞士": "Switzerland", "奧地利": "Austria", "美國": "United States", "加拿大": "Canada",
            "墨西哥": "Mexico", "巴西": "Brazil", "阿根廷": "Argentina", "智利": "Chile",
            "哥倫比亞": "Colombia", "澳大利亞": "Australia", "紐西蘭": "New Zealand", "南非": "South Africa",
            "埃及": "Egypt", "摩洛哥": "Morocco", "奈及利亞": "Nigeria"
        }
        
        # 城市名稱中英文對照
        self.city_mapping = {
            # 台灣
            "台北": "Taipei", "新北": "New Taipei", "桃園": "Taoyuan", "台中": "Taichung",
            "台南": "Tainan", "高雄": "Kaohsiung", "基隆": "Keelung", "新竹": "Hsinchu",
            "嘉義": "Chiayi", "宜蘭": "Yilan", "花蓮": "Hualien", "台東": "Taitung",
            "南投": "Nantou", "金門": "Kinmen", "澎湖": "Penghu", "馬祖": "Matsu",
            # 中國
            "北京": "Beijing", "上海": "Shanghai", "廣州": "Guangzhou", "深圳": "Shenzhen",
            "天津": "Tianjin", "重慶": "Chongqing", "成都": "Chengdu", "武漢": "Wuhan",
            "西安": "Xi'an", "南京": "Nanjing", "杭州": "Hangzhou", "蘇州": "Suzhou",
            # 日本
            "東京": "Tokyo", "大阪": "Osaka", "京都": "Kyoto", "橫濱": "Yokohama",
            "名古屋": "Nagoya", "神戶": "Kobe", "福岡": "Fukuoka", "札幌": "Sapporo",
            # 韓國
            "首爾": "Seoul", "釜山": "Busan", "大邱": "Daegu", "仁川": "Incheon",
            # 法國
            "巴黎": "Paris", "馬賽": "Marseille", "里昂": "Lyon", "圖盧茲": "Toulouse",
            "尼斯": "Nice", "南特": "Nantes", "斯特拉斯堡": "Strasbourg", "蒙彼利埃": "Montpellier",
            # 德國
            "柏林": "Berlin", "慕尼黑": "Munich", "漢堡": "Hamburg", "科隆": "Cologne",
            "法蘭克福": "Frankfurt", "斯圖加特": "Stuttgart", "杜塞道夫": "Düsseldorf",
            # 英國
            "倫敦": "London", "伯明翰": "Birmingham", "利茲": "Leeds", "格拉斯哥": "Glasgow",
            "曼徹斯特": "Manchester", "利物浦": "Liverpool", "愛丁堡": "Edinburgh",
            # 美國
            "紐約": "New York", "洛杉磯": "Los Angeles", "芝加哥": "Chicago", "休斯頓": "Houston",
            "費城": "Philadelphia", "鳳凰城": "Phoenix", "舊金山": "San Francisco", "西雅圖": "Seattle",
            "波士頓": "Boston", "華盛頓": "Washington", "達拉斯": "Dallas",
            # 越南
            "河內": "Hanoi", "胡志明市": "Ho Chi Minh City", "海防": "Hai Phong", "峴港": "Da Nang",
            "芽莊": "Nha Trang", "順化": "Hue", "會安": "Hoi An", "大叻": "Da Lat",
            # 柬埔寨
            "金邊": "Phnom Penh", "暹粒": "Siem Reap", "馬德望": "Battambang", "西哈努克市": "Sihanoukville",
            # 緬甸
            "仰光": "Yangon", "奈比多": "Naypyidaw", "曼德勒": "Mandalay", "毛淡棉": "Mawlamyine",
            # 菲律賓
            "馬尼拉": "Manila", "宿霧": "Cebu", "達沃": "Davao", "怡朗": "Iloilo",
            # 印尼
            "雅加達": "Jakarta", "泗水": "Surabaya", "萬隆": "Bandung", "棉蘭": "Medan",
            "三寶壟": "Semarang", "巴淡": "Batam", "巴里巴板": "Balikpapan", "馬卡薩": "Makassar",
            # 汶萊
            "斯里巴加灣市": "Bandar Seri Begawan"
        }

    def get_geographic_hierarchy(self) -> Dict:
        """取得完整的地理層級資料 (洲 -> 國家 -> 城市)"""
        return self.geographic_data

    def get_english_name(self, name: str, mapping_type: str = 'city') -> str:
        """取得中對英名稱"""
        mapping = self.city_mapping if mapping_type == 'city' else self.country_mapping
        return mapping.get(name, name)

    def get_geo_info(self, city: str, country: str) -> Dict:
        """取得地理資訊 (經緯度、時區)"""
        english_city = self.get_english_name(city, 'city')
        english_country = self.get_english_name(country, 'country')
        
        # 離線常用城市資料 (比照 demo_geograph.py)
        offline_data = {
            ("Berlin", "Germany"): {'lat': 52.5200, 'lon': 13.4050, 'timezone': 'h1e'},
            ("Paris", "France"): {'lat': 48.8566, 'lon': 2.3522, 'timezone': 'h1e'},
            ("London", "United Kingdom"): {'lat': 51.5074, 'lon': -0.1278, 'timezone': 'h0e'},
            ("New York", "United States"): {'lat': 40.7128, 'lon': -74.0060, 'timezone': 'h5w'},
            ("Tokyo", "Japan"): {'lat': 35.6762, 'lon': 139.6503, 'timezone': 'h9e'},
            ("Taipei", "Taiwan"): {'lat': 25.0330, 'lon': 121.5654, 'timezone': 'h8e'},
            ("Beijing", "China"): {'lat': 39.9042, 'lon': 116.4074, 'timezone': 'h8e'},
            ("Shanghai", "China"): {'lat': 31.2304, 'lon': 121.4737, 'timezone': 'h8e'},
            ("Seoul", "South Korea"): {'lat': 37.5665, 'lon': 126.9780, 'timezone': 'h9e'},
            ("Sydney", "Australia"): {'lat': -33.8688, 'lon': 151.2093, 'timezone': 'h10e'},
            ("Singapore", "Singapore"): {'lat': 1.3521, 'lon': 103.8198, 'timezone': 'h8e'},
            ("Bangkok", "Thailand"): {'lat': 13.7563, 'lon': 100.5018, 'timezone': 'h7e'},
            ("Kuala Lumpur", "Malaysia"): {'lat': 3.1390, 'lon': 101.6869, 'timezone': 'h8e'},
            ("Hong Kong", "China"): {'lat': 22.3193, 'lon': 114.1694, 'timezone': 'h8e'},
        }

        data = offline_data.get((english_city, english_country))
        
        if not data:
            # 這裡可以實作線上查詢 (Nominatim)，但為了穩定性先提供經由經度計算時區的方法
            # 預設座標 (0,0) 如果找不到
            lat, lon = 0.0, 0.0
            timezone = "h0e"
            
            # 嘗試線上查詢
            try:
                query = f"{english_city}, {english_country}"
                url = "https://nominatim.openstreetmap.org/search"
                params = {'q': query, 'format': 'json', 'limit': 1}
                headers = {'User-Agent': 'P_Union_App/1.0'}
                response = requests.get(url, params=params, headers=headers, timeout=5)
                if response.status_code == 200 and response.json():
                    result = response.json()[0]
                    lat = float(result['lat'])
                    lon = float(result['lon'])
                    timezone = self.calculate_timezone(lon)
            except:
                pass
        else:
            lat, lon = data['lat'], data['lon']
            timezone = data['timezone']

        return {
            'place_en': f"{english_city}, {english_country}",
            'coordinates': self.convert_to_astro_format(lat, lon),
            'timezone': timezone
        }

    def calculate_timezone(self, lon: float) -> str:
        """根據經度計算時區，確保產出的格式與 demo_input_ui.py 吻合"""
        offset = round(lon / 15)
        offset = max(-12, min(14, offset))
        if offset == 0: return "h0e"
        elif offset > 0: return f"h{offset}e"
        else: return f"h{abs(offset)}w"

    def convert_to_astro_format(self, lat: float, lon: float) -> str:
        """轉換為占星格式 (例如: 25n02, 121e33)"""
        lat_dir = 'n' if lat >= 0 else 's'
        lat_abs = abs(lat)
        lat_deg = int(lat_abs)
        lat_min = int((lat_abs - lat_deg) * 60)
        
        lon_dir = 'e' if lon >= 0 else 'w'
        lon_abs = abs(lon)
        lon_deg = int(lon_abs)
        lon_min = int((lon_abs - lon_deg) * 60)
        
        return f"{lat_deg}{lat_dir}{lat_min:02d}, {lon_deg}{lon_dir}{lon_min:02d}"

