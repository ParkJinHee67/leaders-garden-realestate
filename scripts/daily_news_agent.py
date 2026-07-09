import os
import re
import urllib.parse
import xml.etree.ElementTree as ET
import requests

# 1. Environment variables (configured in GitHub Secrets)
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash")

def fetch_latest_news_feed():
    """Fetch AI news articles from Google News RSS feed."""
    rss_url = "https://news.google.com/rss/search?q=Artificial+Intelligence&hl=en-US&gl=US&ceid=US:en"
    try:
        response = requests.get(rss_url, timeout=15)
        if response.status_code != 200:
            return []
        
        # Parse XML RSS Feed
        root = ET.fromstring(response.content)
        items = []
        for item in root.findall(".//item")[:10]: # Check top 10 articles
            title = item.find("title").text
            link = item.find("link").text
            pub_date = item.find("pubDate").text
            
            # Resolve Google News redirection if possible, or just use the link
            items.append({
                "title": title,
                "link": link,
                "pub_date": pub_date
            })
        return items
    except Exception as e:
        print(f"Error fetching RSS feed: {e}")
        return []

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

def summarize_articles_batch(items):
    """Call Google Gemini API to translate and summarize multiple articles in a single batch."""
    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    
    articles_data = []
    for idx, item in enumerate(items):
        articles_data.append(f"[Article {idx+1}]\nTitle: {item['title']}\nLink: {item['link']}")
    articles_text = "\n\n".join(articles_data)
    
    prompt = f"""You are a professional Korean AI Tech journalist and expert researcher.
Translate and analyze these English AI news articles, then summarize each in Korean.

{articles_text}

For each article, create a highly catching Korean headline/title.
Then, summarize the news into 3 precise key points using the Korean language.
The summary MUST strictly follow this markdown format using '📌[1]', '📌[2]', '📌[3]' and bold text for key terms:
📌[1] **key term**: detailed explanation in Korean.
📌[2] **key term**: detailed explanation in Korean.
📌[3] **key term**: detailed explanation in Korean.

Your response MUST be a valid JSON array matching this schema (do NOT wrap it in markdown codeblocks like ```json):
[
  {{
    "link": "original article link",
    "title": "catchy Korean headline",
    "summary": "📌[1] **핵심키워드**: 한국어 상세 설명...\\n📌[2] **핵심키워드**: 한국어 상세 설명...\\n📌[3] **핵심키워드**: 한국어 상세 설명..."
  }},
  ...
]"""

    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }],
        "generation_config": {
            "response_mime_type": "application/json"
        }
    }
    
    import time
    import json
    max_retries = 5
    for attempt in range(max_retries):
        try:
            res = requests.post(api_url, json=payload, timeout=40)
            if res.status_code == 200:
                result = res.json()
                text_response = result["candidates"][0]["content"]["parts"][0]["text"]
                
                # Parse JSON response robustly
                cleaned_response = text_response.strip()
                if cleaned_response.startswith("```"):
                    newline_idx = cleaned_response.find("\n")
                    if newline_idx != -1:
                        cleaned_response = cleaned_response[newline_idx:].strip()
                    if cleaned_response.endswith("```"):
                        cleaned_response = cleaned_response[:-3].strip()
                
                parsed = json.loads(cleaned_response)
                
                # Ensure parsed result is a list. If it is wrapped in an object, extract the list.
                if isinstance(parsed, dict):
                    for val in parsed.values():
                        if isinstance(val, list):
                            parsed = val
                            break
                
                if isinstance(parsed, list):
                    return parsed
                else:
                    print(f"Warning: parsed response is not a list/array: {parsed}")
                    return None
            
            if res.status_code in (500, 503, 429):
                if res.status_code == 429:
                    print(f"429 상세 오류: {res.text[:500]}")
                wait = 2 ** attempt * 5
                print(f"[{res.status_code}] {wait}초 후 재시도 ({attempt+1}/{max_retries})...")
                time.sleep(wait)
                continue
            else:
                print(f"Gemini API returned error: {res.status_code} - {res.text}")
                return None
        except Exception as e:
            wait = 2 ** attempt * 5
            print(f"요청/파싱 실패: {e} — {wait}초 후 재시도 ({attempt+1}/{max_retries})...")
            time.sleep(wait)
            
    print("최대 재시도 횟수 초과, 배치 요약을 건너뜁니다.")
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
    
    # Check for youtube link or fallback to website screenshot API
    yt_match = re.search(r'(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})', article_url)
    if yt_match:
        capture_url = f"https://img.youtube.com/vi/{yt_match.group(1)}/mqdefault.jpg"
    else:
        capture_url = f"https://api.microlink.io?url={urllib.parse.quote(article_url)}&embed=image.url"
        
    payload = {
        "title": title,
        "description": summary_points[:150] + "...", # Card summary
        "content": summary_points,                  # Full markdown
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
    if not SUPABASE_URL or not SUPABASE_KEY or not GEMINI_API_KEY:
        print("Missing required environment variables: SUPABASE_URL, SUPABASE_KEY, GEMINI_API_KEY")
        return

    print("Starting daily AI news automated crawler...")
    news_items = fetch_latest_news_feed()
    if not news_items:
        print("No news articles found.")
        return

    # 1. Filter unregistered news items
    new_articles = []
    for item in news_items:
        title = item["title"]
        url = item["link"]
        clean_title = re.sub(r'\s+-\s+[^(-]+$', '', title).strip()
        
        if is_already_registered(url):
            print(f"Skip (already registered): {clean_title}")
            continue
            
        new_articles.append({
            "title": clean_title,
            "link": url
        })
        
        # We only need up to 2 new articles
        if len(new_articles) >= 2:
            break

    if not new_articles:
        print("No new articles to process today. Finished.")
        return

    print(f"Found {len(new_articles)} new articles to process.")
    for idx, a in enumerate(new_articles):
        print(f"  [{idx+1}] {a['title']}")

    # 2. Summarize all new articles in a single batch call
    summaries = summarize_articles_batch(new_articles)
    if not summaries:
        print("Failed to generate batch summaries.")
        return

    # Create mapping by link for easy lookup
    summary_map = {item["link"]: item for item in summaries if isinstance(item, dict) and "link" in item}

    # 3. Register to Supabase
    registered_count = 0
    for idx, a in enumerate(new_articles):
        url = a["link"]
        # Try link mapping first, fallback to sequential matching
        summary_item = summary_map.get(url)
        if not summary_item and idx < len(summaries):
            summary_item = summaries[idx]
            
        if not summary_item:
            continue
            
        if not isinstance(summary_item, dict):
            print(f"Skipping registration for {a['title']} because summary item is not a dictionary: {summary_item}")
            continue
            
        ko_title = summary_item.get("title")
        ko_summary = summary_item.get("summary")
        
        if not ko_title or not ko_summary:
            print(f"Skipping registration for {a['title']} due to missing batch data fields: {summary_item}")
            continue
            
        success = register_to_supabase(ko_title, ko_summary, url)
        if success:
            registered_count += 1

    print(f"Automated crawler finished. Registered {registered_count} new articles.")

if __name__ == "__main__":
    main()
