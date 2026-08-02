import os
import re
import sys
import urllib.parse
import xml.etree.ElementTree as ET
import requests
import time
import json

# 1. Environment variables (configured in GitHub Secrets)
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-flash")

def resolve_google_news_link(url):
    """Resolve Google News redirection link to the actual original source URL."""
    try:
        from googlenewsdecoder import gnewsdecoder
        decoded = gnewsdecoder(url)
        if isinstance(decoded, dict) and decoded.get("status") and decoded.get("decoded_url"):
            return decoded["decoded_url"]
    except Exception:
        pass

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        res = requests.get(url, timeout=5, headers=headers, allow_redirects=True)
        return res.url
    except Exception as e:
        print(f"Failed to resolve redirection for {url}: {e}")
        return url

def fetch_latest_news_feed():
    """Fetch real estate news articles from Google News RSS feed."""
    query = '("GTX-C" OR "옥정신도시" OR "양주신도시" OR "부동산 규제" OR "부동산 핫뉴스" OR "부동산 시장") -주식 -공모 -상장 -IPO -증권 -증시 -ADR -채권 -펀드'
    encoded_query = urllib.parse.quote(query)
    rss_url = f"https://news.google.com/rss/search?q={encoded_query}&hl=ko&gl=KR&ceid=KR:ko"
    try:
        response = requests.get(rss_url, timeout=15)
        if response.status_code != 200:
            print(f"Failed to fetch RSS feed. Status code: {response.status_code}")
            return None
        
        # Parse XML RSS Feed
        root = ET.fromstring(response.content)
        items = []
        for item in root.findall(".//item")[:20]: # Check top 20 articles
            title = item.find("title").text
            link = item.find("link").text
            pub_date = item.find("pubDate").text if item.find("pubDate") is not None else ""
            
            items.append({
                "title": title,
                "link": link,
                "pub_date": pub_date
            })
        return items
    except Exception as e:
        print(f"Error fetching RSS feed: {e}")
        return None

def is_already_registered(source_url):
    """Check if the article URL already exists in Supabase."""
    url = f"{SUPABASE_URL}/rest/v1/ai_news"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    params = {
        "source_url": f"eq.{source_url}"
    }
    try:
        res = requests.get(url, headers=headers, params=params, timeout=10)
        if res.status_code == 200:
            data = res.json()
            return len(data) > 0
        return False
    except Exception as e:
        print(f"Error checking DB duplicates: {e}")
        return False

def create_fallback_summary(items):
    """Generate a reliable fallback summary if Gemini API is unreachable or rate-limited."""
    summaries = []
    for item in items:
        title = item['title']
        link = item['link']
        
        clean_t = re.sub(r'\s+-\s+[^(-]+$', '', title).strip()
        summary_text = (
            f"📌[1] **핵심 소식**: {clean_t}\n"
            f"📌[2] **시장 영향**: 부동산 최신 동향 및 시장 관련 주요 보도 내용입니다.\n"
            f"📌[3] **상세 안내**: 기사의 상세 분석 내용 및 원문은 출처 링크를 통해 확인하실 수 있습니다."
        )
        summaries.append({
            "link": link,
            "title": clean_t,
            "summary": summary_text
        })
    return summaries

def summarize_articles_batch(items):
    """Call Google Gemini API to translate and summarize multiple articles in a single batch."""
    if not GEMINI_API_KEY:
        print("GEMINI_API_KEY is not set. Using fallback summary.")
        return create_fallback_summary(items)

    models_to_try = [GEMINI_MODEL]
    for fallback in ["gemini-flash", "gemini-2.5-flash", "gemini-2.0-flash"]:
        if fallback not in models_to_try:
            models_to_try.append(fallback)
            
    articles_data = []
    for idx, item in enumerate(items):
        articles_data.append(f"[Article {idx+1}]\nTitle: {item['title']}\nLink: {item['link']}")
    articles_text = "\n\n".join(articles_data)
    
    prompt = f"""You are a professional Korean Real Estate expert and journalist.
Analyze these Korean real estate news articles, then summarize each.

{articles_text}

For each article, create a highly catching Korean headline/title that is natural and professional.
Then, summarize the news into 3 precise key points in Korean.
The summary MUST strictly follow this markdown format using '📌[1]', '📌[2]', '📌[3]' and bold text for key terms:
📌[1] **key term**: detailed explanation in Korean.
📌[2] **key term**: detailed explanation in Korean.
📌[3] **key term**: detailed explanation in Korean.

Your response MUST be a valid JSON array matching this schema:
[
  {{
    "link": "original article link",
    "title": "catchy Korean headline",
    "summary": "📌[1] **핵심키워드**: 한국어 상세 설명...\\n📌[2] **핵심키워드**: 한국어 상세 설명...\\n📌[3] **핵심키워드**: 한국어 상세 설명..."
  }}
]"""

    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }],
        "generation_config": {
            "response_mime_type": "application/json"
        }
    }
    
    for model in models_to_try:
        print(f"Attempting to generate summaries using model: {model}...")
        api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}"
        
        max_retries = 2
        for attempt in range(max_retries):
            try:
                res = requests.post(api_url, json=payload, timeout=25)
                if res.status_code == 200:
                    result = res.json()
                    text_response = result["candidates"][0]["content"]["parts"][0]["text"]
                    
                    cleaned_response = text_response.strip()
                    if cleaned_response.startswith("```"):
                        newline_idx = cleaned_response.find("\n")
                        if newline_idx != -1:
                            cleaned_response = cleaned_response[newline_idx:].strip()
                        if cleaned_response.endswith("```"):
                            cleaned_response = cleaned_response[:-3].strip()
                    
                    parsed = json.loads(cleaned_response)
                    
                    if isinstance(parsed, dict):
                        for val in parsed.values():
                            if isinstance(val, list):
                                parsed = val
                                break
                    
                    if isinstance(parsed, list):
                        return parsed
                
                if res.status_code in (500, 503, 429):
                    wait = (attempt + 1) * 3
                    print(f"[{res.status_code}] '{model}' retry in {wait}s...")
                    time.sleep(wait)
                    continue
                else:
                    print(f"Gemini API error: {res.status_code} - {res.text[:200]}")
                    break
            except Exception as e:
                print(f"Request error: {e}")
                time.sleep(2)
                
        print(f"Model '{model}' failed to generate summaries.")
        
    print("All Gemini models failed. Using automatic fallback summary...")
    return create_fallback_summary(items)

def extract_og_image(url):
    """Fetch the article page and parse the og:image meta tag with quick timeout."""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        res = requests.get(url, headers=headers, timeout=5)
        if res.status_code == 200:
            match = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']', res.text)
            if not match:
                match = re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']', res.text)
            if match:
                img_url = match.group(1).strip()
                if img_url.startswith("//"):
                    img_url = "https:" + img_url
                elif img_url.startswith("/"):
                    img_url = urllib.parse.urljoin(url, img_url)
                return img_url
    except Exception:
        pass
    return None

def get_microlink_image(url):
    """Fetch resolved image/screenshot URL from Microlink API."""
    try:
        api_url = f"https://api.microlink.io?url={urllib.parse.quote(url)}"
        res = requests.get(api_url, timeout=8)
        if res.status_code == 200:
            data = res.json()
            if data.get("status") == "success":
                img_url = data.get("data", {}).get("image", {}).get("url")
                if img_url:
                    return img_url
                screenshot_url = data.get("data", {}).get("screenshot", {}).get("url")
                if screenshot_url:
                    return screenshot_url
    except Exception:
        pass
    return None

def register_to_supabase(title, summary_points, article_url):
    """Post summarized news to Supabase."""
    url = f"{SUPABASE_URL}/rest/v1/ai_news"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    
    yt_match = re.search(r'(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})', article_url)
    if yt_match:
        capture_url = f"https://img.youtube.com/vi/{yt_match.group(1)}/mqdefault.jpg"
    else:
        capture_url = extract_og_image(article_url)
        if not capture_url:
            capture_url = get_microlink_image(article_url)
        
    payload = {
        "title": title,
        "description": summary_points[:150] + "...",
        "content": summary_points,
        "image_url": capture_url,
        "source_url": article_url
    }
    
    try:
        res = requests.post(url, json=payload, headers=headers, timeout=15)
        if res.status_code == 201:
            print(f"Successfully registered news: {title}")
            return True
        else:
            print(f"Failed to save to Supabase: {res.status_code} - {res.text}")
            return False
    except Exception as e:
        print(f"Error saving to Supabase: {e}")
        return False

def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Missing required environment variables: SUPABASE_URL, SUPABASE_KEY")
        sys.exit(1)

    print("Starting daily real estate news automated crawler...")
    news_items = fetch_latest_news_feed()
    if news_items is None:
        print("Failed to fetch RSS feed due to an error.")
        sys.exit(1)
    if not news_items:
        print("No news articles found in the feed.")
        return

    # 1. Filter unregistered news items
    new_articles = []
    for item in news_items:
        title = item["title"]
        url = item["link"]
        
        resolved_url = resolve_google_news_link(url)
        clean_title = re.sub(r'\s+-\s+[^(-]+$', '', title).strip()
        
        exclude_keywords = ["주식", "공모", "상장", "IPO", "증시", "증권", "ADR", "채권", "펀드", "코스피", "코스닥", "유상증자", "반도체", "하이닉스", "삼성전자", "k-hyni", "khyni", "청약"]
        if any(kw in clean_title.lower() for kw in exclude_keywords):
            print(f"Skip (contains stock/corporate keyword): {clean_title}")
            continue
            
        if is_already_registered(resolved_url):
            print(f"Skip (already registered): {clean_title}")
            continue
            
        new_articles.append({
            "title": clean_title,
            "link": resolved_url
        })
        
        if len(new_articles) >= 2:
            break

    if not new_articles:
        print("No new articles to process today. Finished.")
        return

    print(f"Found {len(new_articles)} new articles to process.")
    for idx, a in enumerate(new_articles):
        print(f"  [{idx+1}] {a['title']}")

    # 2. Summarize all new articles (with fail-safe fallback)
    summaries = summarize_articles_batch(new_articles)
    if not summaries:
        summaries = create_fallback_summary(new_articles)

    summary_map = {item["link"]: item for item in summaries if isinstance(item, dict) and "link" in item}

    # 3. Register to Supabase
    registered_count = 0
    for idx, a in enumerate(new_articles):
        url = a["link"]
        summary_item = summary_map.get(url)
        if not summary_item and idx < len(summaries):
            summary_item = summaries[idx]
            
        if not summary_item or not isinstance(summary_item, dict):
            continue
            
        ko_title = summary_item.get("title")
        ko_summary = summary_item.get("summary")
        
        if not ko_title or not ko_summary:
            continue
            
        success = register_to_supabase(ko_title, ko_summary, url)
        if success:
            registered_count += 1

    print(f"Automated crawler finished. Registered {registered_count} new articles.")

if __name__ == "__main__":
    main()

