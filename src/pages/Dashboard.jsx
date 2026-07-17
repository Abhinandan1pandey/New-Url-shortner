import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Database, MousePointer, Calendar, AlertTriangle, Clock, Search, 
  Trash2, Edit, Copy, ExternalLink, Shield, Key, Eye, EyeOff, Loader2,
  ChevronLeft, ChevronRight, BarChart3, TrendingUp
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiUrl } from '../api';

// Simple Counting Animator Component
function AnimatedCounter({ value, duration = 1 }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = parseInt(value, 10) || 0;
    if (end === 0) {
      setCount(0);
      return;
    }
    const totalMiliseconds = duration * 1000;
    const stepTime = Math.max(Math.floor(totalMiliseconds / end), 15);
    
    const timer = setInterval(() => {
      start += Math.ceil(end / 40); // increment steps
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [value, duration]);

  return <span>{count.toLocaleString()}</span>;
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [urlList, setUrlList] = useState([]);
  const [totalUrls, setTotalUrls] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  
  // Edit Modal State
  const [editingUrl, setEditingUrl] = useState(null);
  const [editOriginalUrl, setEditOriginalUrl] = useState('');
  const [editPassword, setEditPassword] = useState(''); // __NO_CHANGE__ sentinel used on backend
  const [editExpiresAt, setEditExpiresAt] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showPasswordInput, setShowPasswordInput] = useState(false);

  const limit = 6;

  // Fetch stats and url list
  const fetchStats = async () => {
    try {
      const res = await fetch(apiUrl('/api/dashboard'));
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Failed to load dashboard stats", err);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const fetchUrlList = async (page = 1, query = '') => {
    setIsLoadingList(true);
    try {
      const offset = (page - 1) * limit;
      const res = await fetch(apiUrl(`/api/urls?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`));
      if (res.ok) {
        const data = await res.json();
        setUrlList(data.urls);
        setTotalUrls(data.total_count);
      }
    } catch (err) {
      console.error("Failed to load URL list", err);
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchUrlList(1, '');
  }, []);

  const handleSearch = (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    setCurrentPage(1);
    fetchUrlList(1, q);
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    fetchUrlList(newPage, searchQuery);
  };

  const handleDelete = async (shortCode) => {
    if (!window.confirm(`Are you sure you want to delete /${shortCode}?`)) return;
    try {
      const res = await fetch(`/api/urls/${shortCode}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success("Link deleted successfully.");
        // Refresh data
        fetchStats();
        fetchUrlList(currentPage, searchQuery);
      } else {
        toast.error("Failed to delete link.");
      }
    } catch (err) {
      toast.error("Network error. Could not delete link.");
    }
  };

  const handleCopy = (shortCode) => {
    const link = `${window.location.origin}/${shortCode}`;
    navigator.clipboard.writeText(link);
    toast.success("Short link copied!");
  };

  // Open Edit Modal
  const openEditModal = (url) => {
    setEditingUrl(url);
    setEditOriginalUrl(url.original_url);
    setEditExpiresAt(url.expires_at ? url.expires_at.substring(0, 16) : '');
    setEditPassword('__NO_CHANGE__'); // Sentinel to represent no change
    setShowPasswordInput(url.password_protected);
  };

  const handleUpdateUrl = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      const payload = {
        original_url: editOriginalUrl,
        expires_at: editExpiresAt || null,
        password: showPasswordInput ? editPassword : '' // empty string removes password
      };

      const res = await fetch(`/api/urls/${editingUrl.short_code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("URL details updated!");
        setEditingUrl(null);
        fetchStats();
        fetchUrlList(currentPage, searchQuery);
      } else {
        toast.error(data.error || "Failed to update URL.");
      }
    } catch (err) {
      toast.error("Network error. Could not update URL.");
    } finally {
      setIsUpdating(false);
    }
  };

  // Renders Clicks Per Day Line Chart using custom SVGs
  const renderLineChart = () => {
    if (!stats || !stats.clicks_by_day || stats.clicks_by_day.length === 0) {
      return (
        <div className="h-48 flex items-center justify-center text-gray-500 font-mono text-xs">
          No click traffic logs captured yet.
        </div>
      );
    }

    const data = stats.clicks_by_day;
    const maxVal = Math.max(...data.map(d => d.click_count), 5); // min ceiling of 5
    
    // Chart sizing
    const width = 500;
    const height = 150;
    const padding = 25;
    
    // Map points to SVG coordinates
    const points = data.map((d, index) => {
      const x = padding + (index * (width - padding * 2)) / (data.length - 1 || 1);
      const y = height - padding - (d.click_count * (height - padding * 2)) / maxVal;
      return { x, y, label: d.click_date, val: d.click_count };
    });

    // Create path string
    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathD += ` L ${points[i].x} ${points[i].y}`;
    }

    // Create gradient fill path
    const fillD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48">
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        
        {/* Gridlines */}
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="rgba(255,255,255,0.05)" strokeDasharray="3" />
        <line x1={padding} y1={(height) / 2} x2={width - padding} y2={(height) / 2} stroke="rgba(255,255,255,0.05)" strokeDasharray="3" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.1)" />

        {/* Shaded Area */}
        <path d={fillD} fill="url(#chartGrad)" />

        {/* Glow Line */}
        <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="2.5" />

        {/* Data Points */}
        {points.map((p, idx) => (
          <g key={idx} className="group cursor-pointer">
            <circle cx={p.x} cy={p.y} r="4" fill="#8b5cf6" stroke="#ffffff" strokeWidth="1.5" />
            <circle cx={p.x} cy={p.y} r="8" fill="#8b5cf6" opacity="0" className="hover:opacity-30 transition-opacity" />
            <title>{`${p.label}: ${p.val} clicks`}</title>
          </g>
        ))}

        {/* Labels */}
        <text x={padding} y={height - 8} fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="monospace">
          {data[0].click_date.substring(5)}
        </text>
        <text x={width - padding - 30} y={height - 8} fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="monospace">
          {data[data.length - 1].click_date.substring(5)}
        </text>
      </svg>
    );
  };

  const totalPages = Math.ceil(totalUrls / limit);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-bold font-display text-white">SaaS Analytics Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">
            Real-time insights from database and custom in-memory C++ std::unordered_map
          </p>
        </div>
        <button
          onClick={fetchStats}
          className="px-4 py-2 text-xs font-semibold glass-panel rounded-lg hover:bg-white/5 border border-white/10 text-white cursor-pointer transition-colors"
        >
          Refresh Statistics
        </button>
      </div>

      {/* Analytics Counter Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        
        {/* Card 1: Total URLs */}
        <div className="glass-panel p-5 rounded-2xl border border-white/5">
          <div className="flex items-center gap-2 text-brand-blue mb-2">
            <Database className="w-4 h-4" />
            <span className="text-xs font-semibold text-gray-400">Total Links</span>
          </div>
          <div className="text-3xl font-bold font-display text-white">
            {isLoadingStats ? <Loader2 className="w-6 h-6 animate-spin" /> : <AnimatedCounter value={stats?.total_urls} />}
          </div>
        </div>

        {/* Card 2: Total Clicks */}
        <div className="glass-panel p-5 rounded-2xl border border-white/5">
          <div className="flex items-center gap-2 text-brand-purple mb-2">
            <MousePointer className="w-4 h-4" />
            <span className="text-xs font-semibold text-gray-400">Total Redirects</span>
          </div>
          <div className="text-3xl font-bold font-display text-white">
            {isLoadingStats ? <Loader2 className="w-6 h-6 animate-spin" /> : <AnimatedCounter value={stats?.total_clicks} />}
          </div>
        </div>

        {/* Card 3: Today's Additions */}
        <div className="glass-panel p-5 rounded-2xl border border-white/5">
          <div className="flex items-center gap-2 text-brand-pink mb-2">
            <Calendar className="w-4 h-4" />
            <span className="text-xs font-semibold text-gray-400">Today's URLs</span>
          </div>
          <div className="text-3xl font-bold font-display text-white">
            {isLoadingStats ? <Loader2 className="w-6 h-6 animate-spin" /> : <AnimatedCounter value={stats?.todays_urls} />}
          </div>
        </div>

        {/* Card 4: Collisions */}
        <div className="glass-panel p-5 rounded-2xl border border-white/5">
          <div className="flex items-center gap-2 text-amber-500 mb-2">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs font-semibold text-gray-400">Hash Collisions</span>
          </div>
          <div className="text-3xl font-bold font-display text-white">
            {isLoadingStats ? <Loader2 className="w-6 h-6 animate-spin" /> : <AnimatedCounter value={stats?.dsa_stats?.collision_count} />}
          </div>
        </div>

        {/* Card 5: Avg Lookup */}
        <div className="glass-panel p-5 rounded-2xl border border-white/5 col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 text-emerald-500 mb-2">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-semibold text-gray-400">Memory Lookup</span>
          </div>
          <div className="text-xl font-bold font-display text-white mt-1">
            {isLoadingStats ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <span>{(stats?.dsa_stats?.average_lookup_time_ns / 1000).toFixed(2)} µs</span>
            )}
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        
        {/* Traffic Line Chart */}
        <div className="md:col-span-2 glass-panel p-6 rounded-2xl border border-white/5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-brand-blue" />
            <h3 className="font-semibold text-sm text-white font-display">Redirect Traffic Timeline (Last 7 Days)</h3>
          </div>
          {renderLineChart()}
        </div>

        {/* Hash Table Telemetry Card */}
        <div className="glass-panel p-6 rounded-2xl border border-white/5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-4 h-4 text-brand-purple" />
              <h3 className="font-semibold text-sm text-white font-display">Hash Table Metrics</h3>
            </div>
            
            <div className="space-y-3 font-mono text-xs text-gray-400">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span>Memory Capacity:</span>
                <span className="text-white font-bold">{stats?.dsa_stats?.capacity || 64} buckets</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span>Unique Elements:</span>
                <span className="text-white font-bold">{stats?.dsa_stats?.size || 0} nodes</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span>Load Factor:</span>
                <span className={`font-bold ${stats?.dsa_stats?.load_factor > 0.8 ? 'text-amber-500' : 'text-emerald-500'}`}>
                  {stats?.dsa_stats?.load_factor || '0.000'} / {stats?.dsa_stats?.max_load_factor || '1.0'}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span>Max Chain Length:</span>
                <span className="text-white font-bold">{stats?.dsa_stats?.max_chain_length || 0}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span>Rehash Triggers:</span>
                <span className="text-brand-purple font-bold">{stats?.dsa_stats?.rehash_count || 0} times</span>
              </div>
            </div>
          </div>
          
          <div className="bg-brand-purple/10 border border-brand-purple/20 p-3.5 rounded-xl text-[11px] text-gray-300 mt-4 leading-relaxed">
            💡 <strong>C++ Hashing Rule:</strong> When load factor exceeds 1.0, the memory table dynamically doubles capacity (rehashing elements) to preserve O(1) time complexity.
          </div>
        </div>
      </div>

      {/* URL Management Table */}
      <div className="glass-panel p-6 rounded-2xl border border-white/5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h3 className="font-semibold text-sm text-white font-display">Manage Shortened Links</h3>
          
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Search links..."
              value={searchQuery}
              onChange={handleSearch}
              className="w-full pl-9 pr-4 py-2 rounded-lg glass-input text-xs"
            />
          </div>
        </div>

        {/* Table layout */}
        <div className="overflow-x-auto">
          {isLoadingList ? (
            <div className="h-48 flex items-center justify-center gap-2 text-gray-400 font-mono text-xs">
              <Loader2 className="w-5 h-5 animate-spin text-brand-purple" />
              <span>Fetching links...</span>
            </div>
          ) : urlList.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-500 font-mono text-xs">
              No shortened links found.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-gray-400 font-mono font-normal">
                  <th className="py-3 px-2">Short Link</th>
                  <th className="py-3 px-2">Original Destination</th>
                  <th className="py-3 px-2">Created</th>
                  <th className="py-3 px-2 text-center">Redirects</th>
                  <th className="py-3 px-2 text-center">Security</th>
                  <th className="py-3 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {urlList.map((url) => (
                  <tr key={url.short_code} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-2 font-semibold text-brand-purple whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span>/{url.short_code}</span>
                        <button
                          onClick={() => handleCopy(url.short_code)}
                          className="p-1 rounded hover:bg-white/5 text-gray-400 hover:text-white cursor-pointer"
                          title="Copy Link"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-2 max-w-[200px] truncate text-gray-300 font-mono" title={url.original_url}>
                      {url.original_url}
                    </td>
                    <td className="py-3 px-2 text-gray-400 whitespace-nowrap">
                      {new Date(url.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-2 text-center text-white font-bold font-mono">
                      {url.clicks}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <div className="flex justify-center gap-1.5">
                        {url.password_protected && (
                          <span className="p-1 rounded bg-brand-pink/10 text-brand-pink" title="Password Protected">
                            <Shield className="w-3.5 h-3.5" />
                          </span>
                        )}
                        {url.expires_at && (
                          <span className="p-1 rounded bg-amber-500/10 text-amber-400" title={`Expires: ${new Date(url.expires_at).toLocaleDateString()}`}>
                            <Clock className="w-3.5 h-3.5" />
                          </span>
                        )}
                        {!url.password_protected && !url.expires_at && (
                          <span className="text-gray-600 text-[10px]">Open</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <a
                          href={`/${url.short_code}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-white cursor-pointer"
                          title="Test Redirect"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => openEditModal(url)}
                          className="p-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-white cursor-pointer"
                          title="Edit Details"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(url.short_code)}
                          className="p-1.5 rounded hover:bg-white/5 text-red-400 hover:text-red-300 cursor-pointer"
                          title="Delete Link"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination buttons */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-white/5 pt-4 mt-4">
            <span className="text-[10px] text-gray-500">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-1.5">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit URL Modal */}
      <AnimatePresence>
        {editingUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md p-6 glass-panel rounded-2xl border-neon-glow"
            >
              <h3 className="text-lg font-bold font-display text-white mb-2">Edit URL: /{editingUrl.short_code}</h3>
              <p className="text-gray-400 text-xs mb-6 font-mono">ID Reference: {editingUrl.id}</p>

              <form onSubmit={handleUpdateUrl} className="space-y-4">
                {/* Destination Input */}
                <div>
                  <label className="block text-gray-400 text-[10px] uppercase font-mono mb-1">Destination URL</label>
                  <input
                    type="url"
                    value={editOriginalUrl}
                    onChange={(e) => setEditOriginalUrl(e.target.value)}
                    className="w-full p-2.5 rounded-lg glass-input text-xs"
                    required
                  />
                </div>

                {/* Expiration Input */}
                <div>
                  <label className="block text-gray-400 text-[10px] uppercase font-mono mb-1">Expiration Limit</label>
                  <input
                    type="datetime-local"
                    value={editExpiresAt}
                    onChange={(e) => setEditExpiresAt(e.target.value)}
                    className="w-full p-2.5 rounded-lg glass-input text-xs"
                  />
                  <span className="text-[10px] text-gray-500 mt-1 block">Leave empty for infinite validity.</span>
                </div>

                {/* Password Toggle */}
                <div className="pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-300 font-semibold flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-brand-pink" />
                      <span>Password Protection</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPasswordInput(!showPasswordInput)}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                        showPasswordInput ? 'bg-brand-pink' : 'bg-white/10'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        showPasswordInput ? 'translate-x-4' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  {showPasswordInput && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-3 space-y-1.5"
                    >
                      <label className="block text-gray-400 text-[10px] uppercase font-mono">Password / Passcode</label>
                      <input
                        type="text"
                        placeholder="Enter password (retains old if unchanged)"
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        className="w-full p-2.5 rounded-lg glass-input text-xs"
                      />
                    </motion.div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2.5 pt-4">
                  <button
                    type="button"
                    onClick={() => setEditingUrl(null)}
                    className="flex-1 py-2.5 border border-white/10 hover:bg-white/5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-brand-blue to-brand-purple text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isUpdating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <span>Save Changes</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
