import json
import re
import math
from pathlib import Path
from datetime import datetime, timedelta

class SolarTimeCalculator:
    """太陽時間計算器 - 專為 Astro-Databank JSON 格式設計"""
    
    MONTH_MAP = {
        'January': 1, 'February': 2, 'March': 3, 'April': 4,
        'May': 5, 'June': 6, 'July': 7, 'August': 8,
        'September': 9, 'October': 10, 'November': 11, 'December': 12
    }
    
    REV_MONTH_MAP = {v: k for k, v in MONTH_MAP.items()}

    def __init__(self, verbose=True):
        self.verbose = verbose

    def _parse_timezone(self, timezone_str):
        """解析時區字串，例如 'AWST h8e (is standard time)' 或 'EST h5w'"""
        if not timezone_str: return 0, 0
        
        # 尋找 h[數字][we] 模式
        match = re.search(r'h(\d+(?:\.\d+)?)([we])', timezone_str.lower())
        if match:
            hours = float(match.group(1))
            direction = match.group(2)
            longitude_offset = hours * 15
            if direction == 'w':
                return -longitude_offset, -hours
            return longitude_offset, hours
        return 0, 0

    def _parse_coordinates(self, place_str):
        """從 Place 字串解析經緯度，例如 'Luoyang (Henan), China,34n41, 112e27'"""
        if not place_str: return 0, 0
        
        parts = [p.strip() for p in place_str.split(',')]
        lat, lon = 0, 0
        
        for part in parts:
            # 緯度模式: 34n41
            lat_match = re.match(r'(\d+)([ns])(\d+)?', part.lower())
            if lat_match:
                deg = int(lat_match.group(1))
                direction = lat_match.group(2)
                # 處理可能的四位數字 (度度分分)
                if lat_match.group(3):
                    minutes = int(lat_match.group(3))
                else:
                    minutes = 0
                lat = deg + minutes / 60.0
                if direction == 's': lat = -lat
                continue
                
            # 經度模式: 112e27
            lon_match = re.match(r'(\d+)([we])(\d+)?', part.lower())
            if lon_match:
                deg = int(lon_match.group(1))
                direction = lon_match.group(2)
                if lon_match.group(3):
                    minutes = int(lon_match.group(3))
                else:
                    minutes = 0
                lon = deg + minutes / 60.0
                if direction == 'w': lon = -lon
                
        return lat, lon

    def _parse_born_on(self, born_on_str):
        """解析出生日期，例如 '25 December 2000 at 21:35(= 9:35 PM )'"""
        # 移除括號內容
        clean_str = re.sub(r'\(.*?\)', '', born_on_str).strip()
        # 格式: 25 December 2000 at 21:35
        # 支援 "16 January 1979 at 08:43" 格式
        match = re.match(r'(\d+)\s+(\w+)\s+(\d+)\s+at\s+(\d+):(\d+)', clean_str)
        if match:
            day = int(match.group(1))
            month_name = match.group(2)
            year = int(match.group(3))
            hour = int(match.group(4))
            minute = int(match.group(5))
            month = self.MONTH_MAP.get(month_name, 1)
            return year, month, day, hour, minute, clean_str
        return None

    def _noaa_equation_of_time(self, year, month, day, hour, minute):
        """NOAA 均時差計算算法 (移植自 dat02_solar_time.py)"""
        try:
            date_obj = datetime(year, month, day, hour, minute)
            epoch = datetime(1900, 1, 1, 12, 0)
            days_since_epoch = (date_obj - epoch).total_seconds() / 86400.0
            julian_day = days_since_epoch + 2415020.5
            julian_century = (julian_day - 2451545.0) / 36525.0
            
            geom_mean_long_sun = (280.46646 + julian_century * (36000.76983 + julian_century * 0.0003032)) % 360
            geom_mean_anom_sun = 357.52911 + julian_century * (35999.05029 - 0.0001537 * julian_century)
            eccent_earth_orbit = 0.016708634 - julian_century * (0.000042037 + 0.0000001267 * julian_century)
            
            sun_eq_of_ctr = (
                math.sin(math.radians(geom_mean_anom_sun)) * (1.914602 - julian_century * (0.004817 + 0.000014 * julian_century)) +
                math.sin(math.radians(2 * geom_mean_anom_sun)) * (0.019993 - 0.000101 * julian_century) +
                math.sin(math.radians(3 * geom_mean_anom_sun)) * 0.000289
            )
            
            sun_true_long = geom_mean_long_sun + sun_eq_of_ctr
            omega = 125.04 - 1934.136 * julian_century
            mean_obliq_ecliptic = 23 + (26 + ((21.448 - julian_century * (46.815 + julian_century * (0.00059 - julian_century * 0.001813)))) / 60) / 60
            obliq_corr = mean_obliq_ecliptic + 0.00256 * math.cos(math.radians(omega))
            vary = math.tan(math.radians(obliq_corr / 2)) ** 2
            
            eq_of_time = 4 * math.degrees(
                vary * math.sin(2 * math.radians(geom_mean_long_sun)) -
                2 * eccent_earth_orbit * math.sin(math.radians(geom_mean_anom_sun)) +
                4 * eccent_earth_orbit * vary * math.sin(math.radians(geom_mean_anom_sun)) * math.cos(2 * math.radians(geom_mean_long_sun)) -
                0.5 * vary * vary * math.sin(4 * math.radians(geom_mean_long_sun)) -
                1.25 * eccent_earth_orbit * eccent_earth_orbit * math.sin(2 * math.radians(geom_mean_anom_sun))
            )
            return eq_of_time
        except Exception as e:
            return 0.0

    def process_data(self, data):
        """處理單一 JSON 物件"""
        # 檢查欄位是否存在 (不管是 "born on" 還是已經改名過的)
        born_field = None
        if "born on" in data:
            born_field = "born on"
        elif "Clock time" in data:
            # 已經處理過一次，直接回傳或重新計算
            return data
            
        if not born_field:
            return data
            
        # 1. 解析出生資訊
        born_info = self._parse_born_on(data[born_field])
        if not born_info:
            return data
            
        year, month, day, hour, minute, clock_time = born_info
        
        # 2. 修改欄位名稱為 Clock time
        data["Clock time"] = clock_time
        if born_field == "born on":
            # 刪除舊欄位，保持 JSON 乾淨
            # 但為了保持順序，我們通常重新建立一個 dict 或者在原地修改
            # 這裡簡單處理：先新增 Clock time，再刪除 born on
            pass
        
        # 3. 計算太陽時間
        tz_lon, _ = self._parse_timezone(data.get("Timezone", ""))
        _, lon = self._parse_coordinates(data.get("Place", ""))
        
        # 經度修正: (實際經度 - 時區經度) * 4 分鐘
        lon_diff_minutes = (lon - tz_lon) * 4
        
        # 均時差修正
        eot_minutes = self._noaa_equation_of_time(year, month, day, hour, minute)
        
        # 總修正時間
        total_offset = lon_diff_minutes + eot_minutes
        
        # 套用修正
        dt_clock = datetime(year, month, day, hour, minute)
        dt_solar = dt_clock + timedelta(minutes=total_offset)
        
        # 4. 格式化 Solar time
        month_name = self.REV_MONTH_MAP.get(dt_solar.month, "Unknown")
        solar_time_str = f"{dt_solar.day} {month_name} {dt_solar.year} at {dt_solar.hour:02d}:{dt_solar.minute:02d}"
        
        # 為了滿足使用者需求，我們在 "Clock time" 之後新增 "Solar time"
        # 重新構建字典以控制順序
        new_data = {}
        for k, v in data.items():
            if k == born_field:
                new_data["Clock time"] = clock_time
                new_data["Solar time"] = solar_time_str
            else:
                new_data[k] = v
        
        # 刪除原本的 born on (如果還在的話)
        if born_field in new_data:
            del new_data[born_field]

        if self.verbose:
            print(f"  [計算成功] {data.get('Name', 'Unknown')}")
            print(f"    - Clock: {clock_time}")
            print(f"    - Solar: {solar_time_str} (總修正: {total_offset:.2f} 分鐘)")
            
        return new_data

    def process_file(self, input_path, output_path):
        """處理檔案"""
        try:
            with open(input_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            result = self.process_data(data)
            
            # 確保輸出目錄存在
            Path(output_path).parent.mkdir(parents=True, exist_ok=True)
            
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"處理檔案時出錯 {input_path}: {e}")
            import traceback
            traceback.print_exc()
            return False

