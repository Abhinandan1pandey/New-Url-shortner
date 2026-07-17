import sqlite3
import os
from datetime import datetime, date
from typing import List, Dict, Any, Optional, Tuple

DB_FILE = os.path.join(os.path.dirname(__file__), 'hashlink.db')

def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db() -> None:
    """
    Initialize SQLite database tables.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create URLs table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS urls (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            original_url TEXT NOT NULL,
            short_code TEXT NOT NULL UNIQUE,
            hash_value TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            clicks INTEGER DEFAULT 0,
            expires_at TIMESTAMP NULL,
            password_hash TEXT NULL,
            custom_alias TEXT NULL
        )
    ''')
    
    # Create Click Logs table for analytics
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS click_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url_id INTEGER NOT NULL,
            clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ip_address TEXT,
            user_agent TEXT,
            referrer TEXT,
            FOREIGN KEY (url_id) REFERENCES urls (id) ON DELETE CASCADE
        )
    ''')
    
    conn.commit()
    conn.close()

def save_url(original_url: str, short_code: str, hash_value: str, 
             expires_at: Optional[str] = None, password_hash: Optional[str] = None, 
             custom_alias: Optional[str] = None) -> Dict[str, Any]:
    """
    Save a new URL to the database.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO urls (original_url, short_code, hash_value, expires_at, password_hash, custom_alias)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (original_url, short_code, hash_value, expires_at, password_hash, custom_alias))
    
    url_id = cursor.lastrowid
    conn.commit()
    
    # Retrieve saved record
    cursor.execute('SELECT * FROM urls WHERE id = ?', (url_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row)

def get_url(short_code: str) -> Optional[Dict[str, Any]]:
    """
    Get a URL by short code.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM urls WHERE short_code = ?', (short_code,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def get_all_db_urls() -> List[Dict[str, Any]]:
    """
    Retrieve all URLs (for memory hydration at startup).
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM urls')
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def search_urls(query: Optional[str] = None, limit: int = 100, offset: int = 0) -> Tuple[List[Dict[str, Any]], int]:
    """
    Search and paginate URL records. Returns (list_of_urls, total_count).
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if query:
        search_pattern = f'%{query}%'
        cursor.execute('''
            SELECT COUNT(*) FROM urls 
            WHERE original_url LIKE ? OR short_code LIKE ? OR custom_alias LIKE ?
        ''', (search_pattern, search_pattern, search_pattern))
        total_count = cursor.fetchone()[0]
        
        cursor.execute('''
            SELECT * FROM urls 
            WHERE original_url LIKE ? OR short_code LIKE ? OR custom_alias LIKE ?
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        ''', (search_pattern, search_pattern, search_pattern, limit, offset))
    else:
        cursor.execute('SELECT COUNT(*) FROM urls')
        total_count = cursor.fetchone()[0]
        
        cursor.execute('SELECT * FROM urls ORDER BY created_at DESC LIMIT ? OFFSET ?', (limit, offset))
        
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows], total_count

def update_url(short_code: str, original_url: str, expires_at: Optional[str] = None, 
               password_hash: Optional[str] = None, custom_alias: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Update details of an existing shortened URL.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE urls 
        SET original_url = ?, expires_at = ?, password_hash = ?, custom_alias = ?
        WHERE short_code = ?
    ''', (original_url, expires_at, password_hash, custom_alias, short_code))
    conn.commit()
    
    # Retrieve updated record
    cursor.execute('SELECT * FROM urls WHERE short_code = ?', (short_code,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def delete_url_db(short_code: str) -> bool:
    """
    Delete a shortened URL and its click logs from the database.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get ID first for deleting clicks if cascading delete is not enabled
    cursor.execute('SELECT id FROM urls WHERE short_code = ?', (short_code,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return False
        
    url_id = row['id']
    cursor.execute('DELETE FROM click_logs WHERE url_id = ?', (url_id,))
    cursor.execute('DELETE FROM urls WHERE id = ?', (url_id,))
    conn.commit()
    conn.close()
    return True

def increment_clicks(short_code: str) -> int:
    """
    Increment clicks counter for a URL.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('UPDATE urls SET clicks = clicks + 1 WHERE short_code = ?', (short_code,))
    conn.commit()
    
    cursor.execute('SELECT clicks FROM urls WHERE short_code = ?', (short_code,))
    row = cursor.fetchone()
    clicks = row['clicks'] if row else 0
    conn.close()
    return clicks

def log_click(short_code: str, ip_address: Optional[str] = None, 
              user_agent: Optional[str] = None, referrer: Optional[str] = None) -> None:
    """
    Log metadata of a redirect click event.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id FROM urls WHERE short_code = ?', (short_code,))
    row = cursor.fetchone()
    if row:
        url_id = row['id']
        cursor.execute('''
            INSERT INTO click_logs (url_id, ip_address, user_agent, referrer)
            VALUES (?, ?, ?, ?)
        ''', (url_id, ip_address, user_agent, referrer))
        conn.commit()
    conn.close()

def get_dashboard_stats() -> Dict[str, Any]:
    """
    Compile analytics data for dashboard visualization.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Total URLs
    cursor.execute('SELECT COUNT(*) FROM urls')
    total_urls = cursor.fetchone()[0]
    
    # 2. Today's URLs
    today_str = date.today().strftime('%Y-%m-%d')
    cursor.execute('SELECT COUNT(*) FROM urls WHERE date(created_at) = ?', (today_str,))
    todays_urls = cursor.fetchone()[0]
    
    # 3. Total Redirects (Clicks)
    cursor.execute('SELECT SUM(clicks) FROM urls')
    sum_clicks = cursor.fetchone()[0]
    total_clicks = sum_clicks if sum_clicks is not None else 0
    
    # 4. Average Clicks per URL
    avg_clicks = round(total_clicks / total_urls, 2) if total_urls > 0 else 0.0
    
    # 5. Top 5 Most Visited URLs
    cursor.execute('''
        SELECT id, original_url, short_code, clicks, created_at, custom_alias 
        FROM urls 
        ORDER BY clicks DESC 
        LIMIT 5
    ''')
    most_visited = [dict(row) for row in cursor.fetchall()]
    
    # 6. Top 5 Recent URLs
    cursor.execute('''
        SELECT id, original_url, short_code, clicks, created_at, custom_alias 
        FROM urls 
        ORDER BY created_at DESC 
        LIMIT 5
    ''')
    recent_urls = [dict(row) for row in cursor.fetchall()]
    
    # 7. Clicks per day for the last 7 days (timeline chart)
    # We query logs grouped by date in descending order
    cursor.execute('''
        SELECT date(clicked_at) as click_date, COUNT(*) as click_count
        FROM click_logs
        WHERE clicked_at >= date('now', '-6 days')
        GROUP BY click_date
        ORDER BY click_date ASC
    ''')
    clicks_by_day = [dict(row) for row in cursor.fetchall()]
    
    # 8. Referrers split (pie chart statistics)
    cursor.execute('''
        SELECT COALESCE(referrer, 'Direct') as ref_source, COUNT(*) as count
        FROM click_logs
        GROUP BY ref_source
        ORDER BY count DESC
        LIMIT 5
    ''')
    top_referrers = [dict(row) for row in cursor.fetchall()]
    
    conn.close()
    
    return {
        "total_urls": total_urls,
        "todays_urls": todays_urls,
        "total_clicks": total_clicks,
        "average_clicks": avg_clicks,
        "most_visited": most_visited,
        "recent_urls": recent_urls,
        "clicks_by_day": clicks_by_day,
        "top_referrers": top_referrers
    }
