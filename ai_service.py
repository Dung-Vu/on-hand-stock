"""
AI Service Module for ORD Price Lookup
======================================
Architecture: AI is "sandwiched" - only parses intent and formats responses.
AI CANNOT return products or invent data.

Flow:
1. User Query -> Intent Parser (AI) -> Structured JSON
2. Structured JSON -> Database Query (Python/SQL)
3. DB Results -> Response Formatter (AI) -> Natural Language
"""

import os
import json
import logging
try:
    from openai import OpenAI
except ImportError:
    OpenAI = None
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# Configure OpenAI with custom base URL for GPT-4o
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://gpt1.shupremium.com/v1")

if OPENAI_API_KEY and OpenAI:
    client = OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_BASE_URL)
else:
    client = None
    logger.warning("OPENAI_API_KEY not found or OpenAI library missing.")


# =============================================================================
# PHASE 4: INTENT CACHING - Tối ưu performance
# =============================================================================
import hashlib
import time
import re
from typing import Optional

# In-memory cache with TTL
INTENT_CACHE: dict = {}
CACHE_TTL = 3600  # 1 hour in seconds
CACHE_MAX_SIZE = 500  # Maximum cache entries

# Common stopwords to normalize queries
STOPWORDS = {'tìm', 'giá', 'của', 'cho', 'tôi', 'mình', 'xem', 'muốn', 'cần', 'có', 'không', 
             'bao', 'nhiêu', 'là', 'gì', 'nào', 'find', 'search', 'price', 'of', 'the'}


def normalize_query(query: str) -> str:
    """Normalize query for cache key generation."""
    # Lowercase
    normalized = query.lower().strip()
    
    # Remove punctuation
    normalized = re.sub(r'[^\w\s]', ' ', normalized)
    
    # Remove extra spaces
    normalized = ' '.join(normalized.split())
    
    # Remove stopwords
    words = normalized.split()
    words = [w for w in words if w not in STOPWORDS and len(w) > 1]
    
    # Sort for consistency (e.g., "sofa althea" == "althea sofa")
    words.sort()
    
    return ' '.join(words)


def get_cache_key(query: str) -> str:
    """Generate cache key from normalized query."""
    normalized = normalize_query(query)
    return hashlib.md5(normalized.encode('utf-8')).hexdigest()


def get_cached_intent(query: str) -> Optional[dict]:
    """Check if intent is cached and not expired."""
    cache_key = get_cache_key(query)
    
    if cache_key in INTENT_CACHE:
        entry = INTENT_CACHE[cache_key]
        if time.time() - entry['timestamp'] < CACHE_TTL:
            logger.info(f"Cache HIT for query: {query[:30]}...")
            return entry['intent']
        else:
            # Expired, remove from cache
            del INTENT_CACHE[cache_key]
            logger.debug(f"Cache EXPIRED for: {cache_key}")
    
    return None


def cache_intent(query: str, intent: dict):
    """Cache successful intent parsing."""
    # Skip caching chat responses (they vary)
    if intent.get('action') == 'chat':
        return
    
    # Enforce max cache size (simple LRU-like: remove oldest)
    if len(INTENT_CACHE) >= CACHE_MAX_SIZE:
        oldest_key = min(INTENT_CACHE.keys(), key=lambda k: INTENT_CACHE[k]['timestamp'])
        del INTENT_CACHE[oldest_key]
        logger.debug(f"Cache evicted oldest entry: {oldest_key}")
    
    cache_key = get_cache_key(query)
    INTENT_CACHE[cache_key] = {
        'intent': intent,
        'timestamp': time.time(),
        'original_query': query[:50]  # Store for debugging
    }
    logger.info(f"Cache STORED for query: {query[:30]}...")


def get_cache_stats() -> dict:
    """Get cache statistics for monitoring."""
    now = time.time()
    valid_entries = sum(1 for e in INTENT_CACHE.values() if now - e['timestamp'] < CACHE_TTL)
    return {
        'total_entries': len(INTENT_CACHE),
        'valid_entries': valid_entries,
        'expired_entries': len(INTENT_CACHE) - valid_entries,
        'max_size': CACHE_MAX_SIZE,
        'ttl_seconds': CACHE_TTL
    }


# =============================================================================
# STEP 1: INTENT PARSER - AI extracts structured data ONLY
# =============================================================================
def parse_user_intent(user_message: str) -> dict:
    """
    Parse user message into structured search parameters.
    AI ONLY returns JSON schema, NO product data, NO prices.
    
    Falls back to Python-based parser if AI is unavailable.
    """
    message = user_message.lower().strip()
    
    # ====================
    # CHECK SPECIAL INTENTS FIRST - Before AI model (hardcoded responses)
    # ====================
    
    # Creator/About intent - MUST respond with Bonario team info
    CREATOR_KEYWORDS = ['ai làm', 'ai thiết kế', 'ai tạo ra', 'tác giả', 'who created', 'who made', 
                        'admin', 'người thiết kế', 'boss', 'sếp', 'ai viết', 'ai phát triển',
                        'tạo ra ứng dụng', 'làm ra app', 'developer']
    if any(kw in message for kw in CREATOR_KEYWORDS):
        return {
            "action": "chat",
            "response": "Mình được thiết kế và phát triển bởi Đội ngũ Tech Team Bonario! 🚀\nNếu bạn cần hỗ trợ kỹ thuật, hãy liên hệ với Dũng Đẹp Trai - 0786915286 để được giúp đỡ nhé. 😊",
            "_hardcoded": True
        }
    
    # Greeting intent
    GREETINGS = ['xin chào', 'hello', 'hi', 'chào', 'hey', 'alo']
    if any(g in message for g in GREETINGS) and len(message) < 30:
        return {
            "action": "chat",
            "response": "Xin chào! Tôi là trợ lý tìm kiếm giá nội thất ORD. Bạn có thể nhập tên sản phẩm để tìm kiếm nhé! 🛋️",
            "_hardcoded": True
        }
    
    # ====================
    # FALLBACK - If library missing or no API key, use Python parser
    # ====================
    if client is None:
        logger.warning("OpenAI client not configured - using fallback parser")
        return fallback_intent_parser(user_message)

    # ===================
    # PHASE 4: Check cache first
    # ===================
    cached = get_cached_intent(user_message)
    if cached:
        return cached

    # ====================
    # TRY GPT-4o MODEL
    # ====================
    prompt = """Bạn là bộ phân tích ý định tìm kiếm sản phẩm nội thất.
Chỉ được trả về JSON theo schema sau. Không giải thích, không thêm text.

Schema:
{
  "action": "search" | "compare" | "chat",
  "category": string | null,  // Loại sản phẩm: "sofa", "bed", "table", "chair", etc.
  "keywords": string[] | null, // Từ khóa tên sản phẩm. Ví dụ: ["althea"] hoặc ["kyo"]
  "products_to_compare": string[] | null, // Chỉ khi action = "compare". Danh sách tên sản phẩm cần so sánh.
  "price_min": number | null,  // Giá tối thiểu (VNĐ). "30tr" = 30000000, "10 củ" = 10000000
  "price_max": number | null,  // Giá tối đa (VNĐ)
  "width": number | null,      // Chiều rộng (mm). "1m8" = 1800, "2m" = 2000, "4000" = 4000
  "fabric_group": number | null, // Nhóm vải: 0, 10, 15, 20, 25, 30, 35. "ame 10" = 10, "g15" = 15
  "response": string | null    // Chỉ khi action = "chat"
}

Quy tắc:
1. Nếu user hỏi về sản phẩm (giá, tìm, search, tra cứu): action = "search"
2. Nếu user muốn SO SÁNH (so sánh, compare, đối chiếu, khác nhau): action = "compare"
3. Nếu user chào hỏi, hỏi thăm: action = "chat"
4. Với "so sánh giá sofa Althea": action = "compare", keywords = ["althea"], category = "sofa"
5. Với "so sánh Kyo và Abbey": action = "compare", products_to_compare = ["Kyo", "Abbey"]
6. Với "tìm BED trên 30tr": action = "search", category = "bed", price_min = 30000000

User message: """ + user_message

    try:
        logger.info("Calling GPT-4o model")
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a JSON-only response bot. Only return valid JSON, no explanations."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=500
        )
        
        text_result = response.choices[0].message.content.strip()
        
        # Clean markdown if present
        if text_result.startswith("```"):
            text_result = text_result.replace("```json", "").replace("```", "").strip()
        
        parsed = json.loads(text_result)
        
        # Validate and normalize
        intent = {
            "action": parsed.get("action", "chat"),
            "category": parsed.get("category"),
            "keywords": parsed.get("keywords") or [],
            "products_to_compare": parsed.get("products_to_compare") or [],
            "price_min": parsed.get("price_min"),
            "price_max": parsed.get("price_max"),
            "width": parsed.get("width"),
            "response": parsed.get("response"),
            "_model_used": "gpt-4o"  # Track which model succeeded
        }
        
        # Cache successful parse
        cache_intent(user_message, intent)
        logger.info("Successfully parsed with GPT-4o")
        return intent
        
    except Exception as e:
        logger.error(f"GPT-4o API call failed: {e}")
        return fallback_intent_parser(user_message)


def fallback_intent_parser(user_message: str) -> dict:
    """
    Simple Python-based intent parser - NO AI required.
    Used when Gemini API is rate limited or unavailable.
    """
    message = user_message.lower().strip()
    
    # Handle very short or meaningless messages
    if len(message) < 3:
        return {
            "action": "chat",
            "response": "Bạn muốn tìm sản phẩm gì? Hãy nhập tên sản phẩm như 'sofa althea', 'giường ngủ', 'bàn ăn'..."
        }
    
    # Handle conversational responses that aren't product searches
    CONVERSATIONAL_WORDS = ['ok', 'okay', 'vâng', 'ừ', 'ờ', 'được', 'không', 'có', 'yes', 'no', 
                           'láo', 'haha', 'lol', 'good', 'tốt', 'hay', 'thanks', 'cảm ơn', 'tks']
    if message in CONVERSATIONAL_WORDS or (len(message) < 5 and not any(c.isdigit() for c in message)):
        return {
            "action": "chat",
            "response": "Bạn có muốn tìm kiếm thêm sản phẩm nào không? Hãy nhập tên sản phẩm để mình hỗ trợ nhé! 😊"
        }
    
    # Detect chat intent (greetings)
    CHAT_KEYWORDS = ['xin chào', 'hello', 'hi', 'chào', 'bạn là ai', 'help', 'giúp']
    if any(kw in message for kw in CHAT_KEYWORDS):
        return {
            "action": "chat",
            "response": "Xin chào! Tôi là trợ lý tìm kiếm giá nội thất. Bạn có thể nhập tên sản phẩm để tìm kiếm."
        }

    # Detect creator intent
    CREATOR_KEYWORDS = ['ai làm', 'ai thiết kế', 'ai tạo ra', 'tác giả', 'who created', 'who made', 'admin', 'người thiết kế', 'boss', 'sếp']
    if any(kw in message for kw in CREATOR_KEYWORDS):
        return {
            "action": "chat",
            "response": "MÌnh được thiết kế và phát triển bởi Đội ngũ Tech Team Bonario ! 🚀\nNếu bạn cần hỗ trợ kỹ thuật, hãy liên hệ với Dũng Đẹp Trai - 0786915286 để được giúp đỡ nhé. 😊"
        }
    
    # Detect compare intent
    COMPARE_KEYWORDS = ['so sánh', 'compare', 'khác nhau', 'đối chiếu']
    is_compare = any(kw in message for kw in COMPARE_KEYWORDS)
    
    # Extract category
    CATEGORIES = {
        'sofa': ['sofa', 'ghế sofa'],
        'bed': ['bed', 'giường', 'giuong'],
        'table': ['table', 'bàn', 'ban'],
        'chair': ['chair', 'ghế', 'ghe'],
        'ottoman': ['ottoman'],
        'armchair': ['armchair'],
    }
    
    detected_category = None
    for cat, keywords in CATEGORIES.items():
        if any(kw in message for kw in keywords):
            detected_category = cat
            break
    
    # Extract price filters
    price_min = None
    price_max = None
    
    # Pattern: "dưới X triệu" or "under X tr"
    import re
    under_match = re.search(r'(dưới|under|<)\s*(\d+)\s*(tr|triệu|củ|m)?', message)
    if under_match:
        amount = int(under_match.group(2))
        price_max = amount * 1000000
    
    # Pattern: "trên X triệu" or "above X tr"
    over_match = re.search(r'(trên|over|>|từ)\s*(\d+)\s*(tr|triệu|củ|m)?', message)
    if over_match:
        amount = int(over_match.group(2))
        price_min = amount * 1000000
    
    # Extract width - match patterns like: "1m8", "2m", "1800mm", "4000", etc.
    width = None
    # Pattern 1: Xm or XmY (e.g., "1m", "1m8", "2m5") 
    width_match_m = re.search(r'(\d+)\s*m\s*(\d)?(?!\w)', message)
    # Pattern 2: 3-4 digit number optionally followed by "mm" (e.g., "1800", "4000", "2000mm")
    width_match_num = re.search(r'\b(\d{3,4})\s*(mm)?\b', message)
    
    if width_match_m and width_match_m.group(1):
        # e.g., "1m8" or "2m"
        meters = int(width_match_m.group(1))
        decimals = int(width_match_m.group(2)) if width_match_m.group(2) else 0
        width = meters * 1000 + decimals * 100
        message = message.replace(width_match_m.group(0), "")
        logger.info(f"Extracted width from Xm pattern: {width}mm")
    elif width_match_num and width_match_num.group(1):
        # e.g., "1800" or "4000" or "2000mm"
        potential_width = int(width_match_num.group(1))
        # Only consider as width if in reasonable range (500-9000mm)
        if 500 <= potential_width <= 9000:
            width = potential_width
            message = message.replace(width_match_num.group(0), "")
            message = message.replace(width_match_num.group(0), "")
            logger.info(f"Extracted width from numeric pattern: {width}mm")
    
    # Extract fabric_group - patterns like: "G10", "g15", "ame 10", "ames 15", or standalone "10", "15", etc.
    fabric_group = None
    # Valid fabric groups
    VALID_FABRIC_GROUPS = [0, 10, 15, 20, 25, 30, 35]
    # Pattern 1: "G" followed by number (e.g., "G10", "g15")
    fabric_match_g = re.search(r'\b[gG](\d+)\b', message)
    # Pattern 2: "ame" or "ames" followed by space and number (case insensitive)
    fabric_match_ame = re.search(r'\bames?\s*(\d+)\b', message, re.IGNORECASE)
    # Pattern 3: Standalone fabric group numbers (0, 10, 15, 20, 25, 30, 35) - only if width already extracted
    fabric_match_standalone = re.search(r'\b(0|10|15|20|25|30|35)\b', message) if width else None
    
    if fabric_match_g:
        potential_fg = int(fabric_match_g.group(1))
        if potential_fg in VALID_FABRIC_GROUPS:
            fabric_group = potential_fg
            message = message.replace(fabric_match_g.group(0), "")
            logger.info(f"Extracted fabric_group from G pattern: {fabric_group}")
    elif fabric_match_ame:
        potential_fg = int(fabric_match_ame.group(1))
        if potential_fg in VALID_FABRIC_GROUPS:
            fabric_group = potential_fg
            message = message.replace(fabric_match_ame.group(0), "")
            logger.info(f"Extracted fabric_group from ame pattern: {fabric_group}")
    elif fabric_match_standalone:
        potential_fg = int(fabric_match_standalone.group(1))
        fabric_group = potential_fg
        message = message.replace(fabric_match_standalone.group(0), "")
        logger.info(f"Extracted fabric_group from standalone: {fabric_group}")
    
    # Extract keywords (remove common words)
    REMOVE_WORDS = {'tìm', 'giá', 'của', 'cho', 'xem', 'muốn', 'cần', 'bao', 'nhiêu', 
                    'find', 'search', 'price', 'dưới', 'trên', 'triệu', 'tr', 'củ',
                    'so', 'sánh', 'compare', 'm', 'mm', 'và', 'and', 'màu', 'mau', 'color',
                    'ame', 'ames', 'sofa'}  # Added sofa and ame to remove from keywords
    words = re.findall(r'\b[a-zA-Z0-9àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]+\b', message.lower())
    
    # Filter keywords: remove common words AND category keywords (to avoid "sofa bold" failing)
    category_keywords = []
    if detected_category:
        category_keywords = CATEGORIES.get(detected_category, [])
        
    keywords = [w for w in words if w not in REMOVE_WORDS and w not in category_keywords and len(w) > 2]
    
    # Deduplicate and limit
    keywords = list(dict.fromkeys(keywords))[:5]
    
    return {
        "action": "compare" if is_compare else "search",
        "category": detected_category,
        "keywords": keywords,
        "products_to_compare": [],
        "price_min": price_min,
        "price_max": price_max,
        "width": width,
        "fabric_group": fabric_group,  # Added fabric_group
        "response": None,
        "_fallback": True  # Flag to indicate this was parsed without AI
    }


# =============================================================================
# STEP 2: RESPONSE FORMATTER - AI formats DB results into natural language
# =============================================================================
def format_search_response(products: list, user_question: str, parsed_intent: dict) -> str:
    """
    Format database search results into a natural language response.
    Updated to use strictly Python-based formatting to avoid API rate limits and improve speed.
    """
    if client is None:
        if products:
            return "Dưới đây là các sản phẩm tìm thấy:"
        return "Không tìm thấy sản phẩm phù hợp."

    # =========================================================================
    # STEP 4: HANDLE EMPTY DB RESULTS
    # =========================================================================
    if not products:
        category = parsed_intent.get("category") or "sản phẩm"
        keywords = ", ".join(parsed_intent.get("keywords", [])) or "này"
        price_min = parsed_intent.get("price_min")
        price_max = parsed_intent.get("price_max")
        
        # Build main message
        message = f"Hiện tại hệ thống chưa có {category}"
        if keywords != "này":
            message += f" '{keywords}'"
        
        # Add price context
        if price_min and price_max:
            message += f" trong khoảng {price_min//1000000}-{price_max//1000000} triệu."
        elif price_min:
            message += f" trên {price_min//1000000} triệu."
        elif price_max:
            message += f" dưới {price_max//1000000} triệu."
        else:
            message += " phù hợp."
        
        # Smart suggestion based on filters
        suggestion = ""
        if price_min:
            # Suggest lower price range
            lower_range = max(price_min // 2, 5000000)
            upper_range = price_min
            suggestion = f"Bạn có muốn xem các mẫu từ {lower_range//1000000}-{upper_range//1000000} triệu không?"
        elif price_max:
            # Suggest slightly higher range
            suggestion = f"Bạn có muốn nâng ngân sách lên {int(price_max * 1.5)//1000000} triệu không?"
        else:
            suggestion = "Bạn thử tìm với từ khóa khác hoặc bỏ bớt điều kiện lọc nhé!"
        
        return f"{message}\n👉 {suggestion}"

    # =========================================================================
    # FAST PATH: Products found - return simple message
    # =========================================================================
    count = len(products)
    if count == 1:
        return "Đây là sản phẩm phù hợp với yêu cầu của bạn:"
    
    return f"Dưới đây là danh sách {count} sản phẩm phù hợp với yêu cầu của bạn:"


# =============================================================================
# LEGACY COMPATIBILITY - Keep old function names working
# =============================================================================
def chat_with_ai(user_message, chat_history=[]):
    """Legacy wrapper for parse_user_intent."""
    result = parse_user_intent(user_message)
    
    # Map new schema to old schema for backward compatibility
    if result["action"] == "search":
        # Build query from keywords
        query = " ".join(result.get("keywords", []))
        if result.get("category"):
            query = f"{result['category']} {query}".strip()
        
        return {
            "action": "search",
            "query": query or user_message,
            "filters": {
                "price_min": result.get("price_min"),
                "price_max": result.get("price_max"),
                "width": result.get("width")
            }
        }
    else:
        return {
            "action": "chat",
            "response": result.get("response", "Xin chào! Tôi có thể giúp gì cho bạn?")
        }


def generate_product_answer(products, user_question):
    """Legacy wrapper for format_search_response."""
    # Get intent for context (could be cached in production)
    intent = parse_user_intent(user_question)
    return format_search_response(products, user_question, intent)
