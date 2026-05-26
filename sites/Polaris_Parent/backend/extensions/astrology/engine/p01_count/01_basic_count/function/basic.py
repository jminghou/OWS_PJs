def get_basic_info(basic_data):
    # 将数据分为三个主要部分
    chart_source = {
        '類別': basic_data.get('類別') or basic_data.get('Level', ''),
        '資料來源': basic_data.get('資料來源', ''),
        '收集者': basic_data.get('收集者', ''),
        '羅登評級': basic_data.get('羅登評級', ''),
        '關係': basic_data.get('關係', '')
    }
    
    basic_info = {
        '命盤主': basic_data.get('命盤主', ''),
        '原名': basic_data.get('原名', ''),
        '中文名': basic_data.get('中文名', ''),
        '出生名': basic_data.get('出生名', ''),
        '性別': basic_data.get('性別', ''),
        '出生地': basic_data.get('出生地', ''),
        '經緯度': basic_data.get('經緯度', ''),
        '時區': basic_data.get('時區', ''),
        '時間類型': basic_data.get('時間類型', '')
    }
    
    person_intro = {
        '職業': basic_data.get('職業', ''),
        '亮點': basic_data.get('亮點', ''),
        '簡介': basic_data.get('簡介', '')
    }
    
    return {
        '命盤來源': chart_source,
        '基本資料': basic_info,
        '命主介紹': person_intro
    }
