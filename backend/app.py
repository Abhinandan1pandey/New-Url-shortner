import re
import time
import hashlib
from datetime import datetime
from flask import Flask, request, jsonify, redirect, abort
from flask_cors import CORS

from hash_table import HashTable
import database as db

import os
import requests
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__, static_folder="../dist", static_url_path="/")
# Enable CORS for frontend integration
CORS(app)

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

# Initialize Database
db.init_db()

# Global Main Hash Table for URL redirection and reverse lookup
# Standard capacity of 1024, load factor threshold of 1.0 (doubles size on threshold)
url_hash_table = HashTable(capacity=64, max_load_factor=1.0)

# Global Simulation Hash Table for the interactive playground (can be reinitialized with custom capacities)
sim_hash_table = HashTable(capacity=8, max_load_factor=1.0)

# Accumulators for lookup timing telemetry
lookup_time_total_ns = 0
lookup_count = 0

def hydrate_hash_table():
    """
    Hydrate the in-memory Hash Table with all records from the SQLite database.
    """
    print("Hydrating in-memory Hash Table from Database...")
    urls = db.get_all_db_urls()
    for u in urls:
        # Re-construct record format stored in the Hash Table
        record = {
            "id": u["id"],
            "original_url": u["original_url"],
            "short_code": u["short_code"],
            "hash_value": u["hash_value"],
            "created_at": u["created_at"],
            "clicks": u["clicks"],
            "expires_at": u["expires_at"],
            "password_hash": u["password_hash"],
            "custom_alias": u["custom_alias"]
        }
        url_hash_table.insert(u["short_code"], record)
    print(f"Hydration complete. Loaded {len(urls)} URLs into Hash Table.")

# Base62 mapping characters
BASE62_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

def encode_base62(num: int) -> str:
    """
    Encode an integer to a Base62 string.
    """
    if num == 0:
        return BASE62_ALPHABET[0]
    arr = []
    base = len(BASE62_ALPHABET)
    while num:
        num, rem = divmod(num, base)
        arr.append(BASE62_ALPHABET[rem])
    arr.reverse()
    return ''.join(arr)

def validate_url(url: str) -> bool:
    """
    Validate if a string is a properly formatted HTTP/HTTPS URL.
    """
    regex = re.compile(
        r'^(?:http|ftp)s?://'  # http:// or https://
        r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+(?:[A-Z]{2,6}\.?|[A-Z0-9-]{2,}\.?)|'  # domain...
        r'localhost|'  # localhost...
        r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
        r'(?::\d+)?'  # optional port
        r'(?:/?|[/?]\S+)$', re.IGNORECASE)
    return re.match(regex, url) is not None


def clean_text(value, default: str = "") -> str:
    if value is None:
        return default
    return str(value).strip()


@app.route('/api/shorten', methods=['POST'])
def api_shorten():
    """
    Endpoint to shorten a long URL.
    Handles SHA-256 Hashing, Base62 conversion, Short-code collision checks, and DB/Hash Table insertions.
    Returns complete step-by-step logs for frontend animation.
    """
    data = request.get_json() or {}
    original_url = clean_text(data.get('original_url', ''))
    custom_alias = clean_text(data.get('custom_alias', ''))
    expires_at = data.get('expires_at') or None
    password = clean_text(data.get('password', ''))

    if not original_url:
        return jsonify({"error": "Original URL is required."}), 400

    if not validate_url(original_url):
        return jsonify({"error": "Invalid URL format. Please include http:// or https://."}), 400

    password_hash = None
    if password:
        password_hash = hashlib.sha256(password.encode('utf-8')).hexdigest()

    hashing_steps = []
    short_code = ""
    hash_value = ""

    # 1. Handling Custom Alias
    if custom_alias:
        # Validate custom alias characters (alphanumeric, dashes, underscores)
        if not re.match(r'^[a-zA-Z0-9_-]+$', custom_alias):
            return jsonify({"error": "Custom alias can only contain letters, numbers, dashes, and underscores."}), 400
        
        # Check if custom alias already exists
        val, _ = url_hash_table.search(custom_alias)
        if val is not None:
            return jsonify({"error": f"The alias '{custom_alias}' is already in use."}), 400
            
        short_code = custom_alias
        hash_value = hashlib.sha256(original_url.encode('utf-8')).hexdigest()
        hashing_steps.append({
            "step": 1,
            "title": "Custom Alias Specified",
            "description": f"Using user-defined alias '{custom_alias}' instead of random hash generation.",
            "data": {"alias": custom_alias}
        })
    else:
        # 2. Hashing Flow using SHA-256 and Base62 conversion with collision checking
        collision_counter = 0
        current_hash_input = original_url
        
        while True:
            # Step A: SHA-256 Hashing
            sha256_hash = hashlib.sha256(current_hash_input.encode('utf-8')).hexdigest()
            hash_value = sha256_hash
            
            # Step B: Base62 Conversion
            hash_int = int(sha256_hash, 16)
            base62_str = encode_base62(hash_int)
            
            # Step C: Take first 7 characters
            candidate_code = base62_str[:7]
            
            hashing_steps.append({
                "step": len(hashing_steps) + 1,
                "title": f"Generate Short Code (Attempt {collision_counter + 1})",
                "description": f"Hash input -> SHA-256 -> Base62 -> Code: '{candidate_code}'",
                "data": {
                    "input": current_hash_input,
                    "sha256": sha256_hash,
                    "base62": base62_str,
                    "candidate": candidate_code
                }
            })
            
            # Check for short-code collision in the main Hash Table
            existing_record, _ = url_hash_table.search(candidate_code)
            
            if existing_record is None:
                # No collision! We can use this code
                short_code = candidate_code
                break
            else:
                # Collision detected! Check if it's the exact same original URL (we can reuse it)
                if existing_record["original_url"] == original_url:
                    short_code = candidate_code
                    hashing_steps.append({
                        "step": len(hashing_steps) + 1,
                        "title": "Existing URL Reused",
                        "description": f"The URL already has short code '{short_code}'. Reusing it.",
                        "data": {"short_code": short_code}
                    })
                    break
                
                # Different URL! Resolve collision by salting the input and generating a new hash
                collision_counter += 1
                current_hash_input = f"{original_url}_collision_{collision_counter}"
                hashing_steps.append({
                    "step": len(hashing_steps) + 1,
                    "title": "Short Code Collision",
                    "description": f"Code '{candidate_code}' is already taken by a different URL. Salting input to resolve.",
                    "data": {"collision_code": candidate_code, "new_input": current_hash_input}
                })

    # 3. Check if we are inserting a new record or reusing an existing one
    existing_record, _ = url_hash_table.search(short_code)
    
    if existing_record and existing_record["original_url"] == original_url:
        # Just return the existing record
        db_record = db.get_url(short_code)
    else:
        # Insert new record into Database
        db_record = db.save_url(
            original_url=original_url,
            short_code=short_code,
            hash_value=hash_value,
            expires_at=expires_at,
            password_hash=password_hash,
            custom_alias=custom_alias if custom_alias else None
        )
        
        # Insert new record into custom in-memory Hash Table
        dsa_insert_stats = url_hash_table.insert(short_code, db_record)
        hashing_steps.append({
            "step": len(hashing_steps) + 1,
            "title": "Insert into Custom Hash Table (Separate Chaining)",
            "description": f"Stored in bucket {dsa_insert_stats['bucket_index']}. "
                           f"Collision: {dsa_insert_stats['collision_detected']}. Rehashed: {dsa_insert_stats['rehashed']}.",
            "data": dsa_insert_stats
        })

    return jsonify({
        "success": True,
        "short_code": short_code,
        "url_details": {
            "id": db_record["id"],
            "original_url": db_record["original_url"],
            "short_code": db_record["short_code"],
            "created_at": db_record["created_at"],
            "expires_at": db_record["expires_at"],
            "clicks": db_record["clicks"],
            "password_protected": db_record["password_hash"] is not None,
            "custom_alias": db_record["custom_alias"]
        },
        "hashing_steps": hashing_steps
    }), 201

@app.route('/api/generate', methods=['POST'])
def api_generate():
    api_key = OPENAI_API_KEY
    if not api_key:
        return jsonify({"error": "OPENAI_API_KEY is not configured."}), 500

    data = request.get_json() or {}
    prompt = clean_text(data.get('prompt', ''))
    if not prompt:
        return jsonify({"error": "Prompt is required."}), 400

    model = os.getenv('OPENAI_MODEL', 'gpt-3.5-turbo')
    response = requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        },
        json={
            'model': model,
            'messages': [
                {'role': 'system', 'content': 'You are a helpful assistant that generates concise URL shortening suggestions and explanations.'},
                {'role': 'user', 'content': prompt}
            ],
            'max_tokens': 300,
            'temperature': 0.7
        },
        timeout=30
    )

    try:
        response.raise_for_status()
        result = response.json()
        content = None
        if isinstance(result, dict):
            choices = result.get('choices') or []
            if choices and isinstance(choices, list) and isinstance(choices[0], dict):
                message = choices[0].get('message')
                if isinstance(message, dict):
                    content = message.get('content')
        if content:
            return jsonify({
                'success': True,
                'model': model,
                'content': content.strip(),
                'raw': result
            }), response.status_code
        return jsonify({
            'success': True,
            'model': model,
            'raw': result
        }), response.status_code
    except requests.exceptions.HTTPError:
        return jsonify({
            'error': 'OpenAI request failed.',
            'details': response.text
        }), response.status_code
    except requests.exceptions.RequestException as err:
        return jsonify({
            'error': 'OpenAI request could not be completed.',
            'details': str(err)
        }), 502
    except ValueError:
        return jsonify({
            'error': 'Invalid JSON response from OpenAI.',
            'details': response.text
        }), response.status_code

@app.route('/')
def serve_index():
    return app.send_static_file('index.html')

@app.route('/<short_code>', methods=['GET'])
def redirect_url(short_code):
    """
    Handle shortened URL redirection.
    Looks up in the custom Hash Table first, performs security checks, and redirects.
    Logs clicks and redirects.
    """
    # Allow frontend routes to pass through to React
    if short_code in ['dashboard', 'simulator', 'analytics', 'settings', 'lookup', 'playground']:
        return app.send_static_file('index.html')

    # Serve built static assets directly when requests include a file extension
    if '.' in short_code:
        return app.send_static_file(short_code)

    global lookup_time_total_ns, lookup_count
    
    t_start = time.perf_counter_ns()
    record, _ = url_hash_table.search(short_code)
    t_end = time.perf_counter_ns()
    
    lookup_time_total_ns += (t_end - t_start)
    lookup_count += 1

    if record is None:
        abort(404)

    # 1. Check Expiration
    if record["expires_at"]:
        expires_dt = datetime.fromisoformat(record["expires_at"].replace("Z", "+00:00"))
        if datetime.now() > expires_dt.replace(tzinfo=None):
            return "<h1>This link has expired</h1><p>The shortened URL has reached its expiration time limit.</p>", 410

    # 2. Check Password Protection
    if record["password_hash"]:
        # If redirecting from a direct browser query, we must return a gateway prompt page or JSON
        # Since this is an API backend, we'll return a special status indicating password is required.
        # The frontend router handles this, but if hit directly, we render a basic password unlock screen.
        if request.headers.get('Accept') == 'application/json' or 'api' in request.path:
            return jsonify({
                "password_required": True,
                "short_code": short_code
            }), 403
        else:
            # Simple server-rendered form if visited directly in browser without API client
            return f'''
            <!DOCTYPE html>
            <html>
            <head>
                <title>Password Protected Link - Url Shortner System</title>
                <style>
                    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0f19; color: #f3f4f6; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }}
                    .card {{ background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 32px; width: 360px; backdrop-filter: blur(12px); text-align: center; box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37); }}
                    input {{ width: 100%; padding: 12px; margin: 16px 0; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; color: white; box-sizing: border-box; font-size: 16px; }}
                    button {{ background: linear-gradient(135deg, #3b82f6, #8b5cf6); border: none; color: white; padding: 12px; width: 100%; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; }}
                    button:hover {{ filter: brightness(1.1); }}
                    .error {{ color: #ef4444; margin-top: 8px; }}
                </style>
            </head>
            <body>
                <div class="card">
                    <h2>🔒 Password Required</h2>
                    <p>This link is protected. Enter the password to access the destination URL.</p>
                    <form method="POST" action="/api/verify-password-direct/{short_code}">
                        <input type="password" name="password" placeholder="Enter Password" required autofocus />
                        <button type="submit">Unlock & Redirect</button>
                    </form>
                </div>
            </body>
            </html>
            '''

    # 3. Log Analytics & Increment Click Counts
    db.increment_clicks(short_code)
    db.log_click(
        short_code=short_code,
        ip_address=request.remote_addr,
        user_agent=request.user_agent.string,
        referrer=request.referrer
    )
    
    # Update count in-memory as well
    record["clicks"] += 1

    return redirect(record["original_url"])

@app.route('/api/verify-password', methods=['POST'])
def api_verify_password():
    """
    Endpoint for frontend AJAX password verification.
    """
    data = request.get_json() or {}
    short_code = data.get('short_code', '')
    password = data.get('password', '')

    record, _ = url_hash_table.search(short_code)
    if not record:
        return jsonify({"error": "Short link not found."}), 404

    password_hash = hashlib.sha256(password.encode('utf-8')).hexdigest()
    if record["password_hash"] == password_hash:
        # Increment Clicks
        db.increment_clicks(short_code)
        db.log_click(
            short_code=short_code,
            ip_address=request.remote_addr,
            user_agent=request.user_agent.string,
            referrer=request.referrer
        )
        record["clicks"] += 1
        
        return jsonify({
            "success": True,
            "original_url": record["original_url"]
        })
    else:
        return jsonify({"error": "Incorrect password. Access denied."}), 401

@app.route('/api/verify-password-direct/<short_code>', methods=['POST'])
def api_verify_password_direct(short_code):
    """
    Endpoint for the direct HTML form POST redirection.
    """
    password = request.form.get('password', '')
    record, _ = url_hash_table.search(short_code)
    if not record:
        abort(404)

    password_hash = hashlib.sha256(password.encode('utf-8')).hexdigest()
    if record["password_hash"] == password_hash:
        db.increment_clicks(short_code)
        db.log_click(
            short_code=short_code,
            ip_address=request.remote_addr,
            user_agent=request.user_agent.string,
            referrer=request.referrer
        )
        record["clicks"] += 1
        return redirect(record["original_url"])
    else:
        return '''
        <script>
            alert("Incorrect password!");
            window.history.back();
        </script>
        ''', 401

@app.route('/api/lookup', methods=['POST'])
def api_lookup():
    """
    Lookup URL details by short code or full shortened URL (Reverse Lookup).
    """
    global lookup_time_total_ns, lookup_count
    
    data = request.get_json() or {}
    input_value = clean_text(data.get('short_url', ''))
    
    if not input_value:
        return jsonify({"error": "Short URL or short code is required."}), 400
        
    # Extract short code from input (in case full URL was pasted, e.g. http://localhost:5000/xyz -> xyz)
    short_code = input_value.split('/')[-1].strip()
    
    t_start = time.perf_counter_ns()
    record, dsa_steps = url_hash_table.search(short_code)
    t_end = time.perf_counter_ns()
    
    lookup_time_total_ns += (t_end - t_start)
    lookup_count += 1
    
    if not record:
        return jsonify({"error": "Short link not found in system."}), 404
        
    # Build complete return payload
    return jsonify({
        "success": True,
        "url_details": {
            "id": record["id"],
            "original_url": record["original_url"],
            "short_code": record["short_code"],
            "created_at": record["created_at"],
            "expires_at": record["expires_at"],
            "clicks": record["clicks"],
            "password_protected": record["password_hash"] is not None,
            "custom_alias": record["custom_alias"],
            "hash_value": record["hash_value"]
        },
        "dsa_steps": dsa_steps,
        "lookup_time_ns": t_end - t_start
    })

@app.route('/api/dashboard', methods=['GET'])
def api_dashboard():
    """
    Retrieve statistics for dashboard.
    Combines SQLite database aggregates and Custom Hash Table telemetry.
    """
    db_stats = db.get_dashboard_stats()
    dsa_stats = url_hash_table.get_stats()
    
    avg_lookup_ns = round(lookup_time_total_ns / lookup_count, 1) if lookup_count > 0 else 0.0
    
    # Combine stats
    return jsonify({
        "total_urls": db_stats["total_urls"],
        "todays_urls": db_stats["todays_urls"],
        "total_clicks": db_stats["total_clicks"],
        "average_clicks": db_stats["average_clicks"],
        "most_visited": db_stats["most_visited"],
        "recent_urls": db_stats["recent_urls"],
        "clicks_by_day": db_stats["clicks_by_day"],
        "top_referrers": db_stats["top_referrers"],
        "dsa_stats": {
            "capacity": dsa_stats["capacity"],
            "size": dsa_stats["size"],
            "load_factor": dsa_stats["load_factor"],
            "collision_count": dsa_stats["collision_count"],
            "max_chain_length": dsa_stats["max_chain_length"],
            "average_chain_length": dsa_stats["average_chain_length"],
            "rehash_count": dsa_stats["rehash_count"],
            "average_lookup_time_ns": avg_lookup_ns
        }
    })

@app.route('/api/urls', methods=['GET'])
def api_list_urls():
    """
    Search and paginate shortened URLs.
    """
    query = request.args.get('q', '').strip()
    limit = int(request.args.get('limit', 10))
    offset = int(request.args.get('offset', 0))
    
    results, total_count = db.search_urls(query, limit, offset)
    
    # Map password hashes to boolean status
    for item in results:
        item["password_protected"] = item["password_hash"] is not None
        del item["password_hash"]
        
    return jsonify({
        "urls": results,
        "total_count": total_count
    })

@app.route('/api/urls/<short_code>', methods=['PUT'])
def api_edit_url(short_code):
    """
    Modify an existing shortened URL.
    Updates Database and memory Hash Table.
    """
    data = request.get_json() or {}
    original_url = clean_text(data.get('original_url', ''))
    expires_at = data.get('expires_at') or None
    password = clean_text(data.get('password', ''))
    
    if not original_url:
        return jsonify({"error": "Original URL is required."}), 400
        
    if not validate_url(original_url):
        return jsonify({"error": "Invalid URL format."}), 400

    # Retrieve existing record
    existing_record, _ = url_hash_table.search(short_code)
    if not existing_record:
        return jsonify({"error": "Short link not found."}), 404

    # Retain old password if not updated
    password_hash = existing_record["password_hash"]
    if password == "__NO_CHANGE__":
        # Sentinel indicating no password change requested
        pass
    elif password == "":
        # Password removed
        password_hash = None
    else:
        # Password updated
        password_hash = hashlib.sha256(password.encode('utf-8')).hexdigest()

    # Update in Database
    updated_db_row = db.update_url(
        short_code=short_code,
        original_url=original_url,
        expires_at=expires_at,
        password_hash=password_hash,
        custom_alias=existing_record["custom_alias"]
    )
    
    if not updated_db_row:
        return jsonify({"error": "Database update failed."}), 500
        
    # Update in memory Hash Table
    url_hash_table.insert(short_code, updated_db_row)
    
    return jsonify({
        "success": True,
        "url_details": {
            "id": updated_db_row["id"],
            "original_url": updated_db_row["original_url"],
            "short_code": updated_db_row["short_code"],
            "expires_at": updated_db_row["expires_at"],
            "password_protected": updated_db_row["password_hash"] is not None
        }
    })

@app.route('/api/urls/<short_code>', methods=['DELETE'])
def api_delete_url(short_code):
    """
    Delete a shortened URL.
    Removes from database and custom Hash Table.
    """
    success = db.delete_url_db(short_code)
    if not success:
        return jsonify({"error": "Short link not found in database."}), 404
        
    # Delete from in-memory Hash Table
    url_hash_table.delete(short_code)
    
    return jsonify({"success": True, "message": "Link deleted successfully."})

# ----------------- SIMULATOR API ROUTES -----------------

@app.route('/api/simulator/reset', methods=['POST'])
def api_sim_reset():
    """
    Reset or re-initialize the simulation hash table with a custom capacity.
    """
    global sim_hash_table
    data = request.get_json() or {}
    capacity = int(data.get('capacity', 8))
    max_load_factor = float(data.get('max_load_factor', 1.0))
    
    if capacity < 2 or capacity > 128:
        return jsonify({"error": "Capacity must be between 2 and 128."}), 400
        
    sim_hash_table = HashTable(capacity=capacity, max_load_factor=max_load_factor)
    return jsonify({
        "success": True,
        "message": f"Simulator Hash Table reset with capacity {capacity} and max load factor {max_load_factor}.",
        "stats": sim_hash_table.get_stats()
    })

@app.route('/api/simulator/insert', methods=['POST'])
def api_sim_insert():
    """
    Insert a key-value pair into the simulation hash table.
    """
    data = request.get_json() or {}
    key = data.get('key', '').strip()
    val = data.get('value', '').strip()
    
    if not key or not val:
        return jsonify({"error": "Key and Value are required."}), 400
        
    dsa_insert_stats = sim_hash_table.insert(key, val)
    return jsonify({
        "success": True,
        "steps": dsa_insert_stats,
        "stats": sim_hash_table.get_stats()
    })

@app.route('/api/simulator/search', methods=['POST'])
def api_sim_search():
    """
    Search for a key in the simulation hash table.
    """
    data = request.get_json() or {}
    key = data.get('key', '').strip()
    
    if not key:
        return jsonify({"error": "Key is required."}), 400
        
    val, dsa_steps = sim_hash_table.search(key)
    return jsonify({
        "success": True,
        "found": val is not None,
        "value": val,
        "steps": dsa_steps,
        "stats": sim_hash_table.get_stats()
    })

@app.route('/api/simulator/delete', methods=['POST'])
def api_sim_delete():
    """
    Delete a key from the simulation hash table.
    """
    data = request.get_json() or {}
    key = data.get('key', '').strip()
    
    if not key:
        return jsonify({"error": "Key is required."}), 400
        
    success, dsa_steps = sim_hash_table.delete(key)
    return jsonify({
        "success": success,
        "steps": dsa_steps,
        "stats": sim_hash_table.get_stats()
    })

@app.route('/api/simulator/stats', methods=['GET'])
def api_sim_stats():
    """
    Get current state and stats of the simulator hash table.
    """
    return jsonify(sim_hash_table.get_stats())


# Hydrate the memory table at launch
hydrate_hash_table()

if __name__ == '__main__':
    # Flask port 5000
    app.run(host='127.0.0.1', port=5000, debug=True)
