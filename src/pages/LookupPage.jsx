import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, Calendar, MousePointer, Shield, Tag, Link2, Copy, Download, Share2, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiUrl } from '../api';

export default function LookupPage() {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [urlDetails, setUrlDetails] = useState(null);
  const [dsaSteps, setDsaSteps] = useState(null);
  const [showPasswordHash, setShowPasswordHash] = useState(false);

  const handleLookup = async (e) => {
    e.preventDefault();
    if (!inputValue.trim()) {
      toast.error("Please enter a short URL or code.");
      return;
    }

    setIsLoading(true);
    setUrlDetails(null);

    try {
      const res = await fetch(apiUrl('/api/lookup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ short_url: inputValue.trim() })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setUrlDetails(data.url_details);
        setDsaSteps(data.dsa_steps);
        toast.success("URL found in Hash Table!");
      } else {
        toast.error(data.error || "Short URL not found.");
      }
    } catch (err) {
      toast.error("Failed to connect to backend server.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const handleDownloadQR = () => {
    // Generate QR using standard Google Chart API or QR API
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
      window.location.origin + '/' + urlDetails.short_code
    )}`;

    fetch(qrUrl)
      .then((res) => res.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `qr_${urlDetails.short_code}.png`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success("QR Code downloaded!");
      })
      .catch(() => toast.error("Failed to download QR code."));
  };

  const handleShare = () => {
    const link = `${window.location.origin}/${urlDetails.short_code}`;
    if (navigator.share) {
      navigator.share({
        title: 'Url Shortner System Short URL',
        text: 'Access this shortened link:',
        url: link
      }).catch(() => {});
    } else {
      handleCopy(link);
      toast.success("Link copied! Share it anywhere.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Page Header */}
      <div className="text-center mb-12">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-panel text-xs text-brand-purple font-mono border border-brand-purple/20 mb-4"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Reverse Lookup Utility</span>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-4xl md:text-5xl font-bold font-display text-white tracking-tight"
        >
          Query <span className="bg-gradient-to-r from-brand-blue to-brand-purple bg-clip-text text-transparent">Url Shortner System</span> Database
        </motion.h1>
        <p className="text-gray-400 mt-3 text-sm max-w-lg mx-auto">
          Paste any shortened URL or short code to retrieve its associated metadata and trace its bucket traversal path.
        </p>
      </div>

      {/* Input Section */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-panel p-6 rounded-2xl border-neon-glow mb-10 max-w-2xl mx-auto"
      >
        <form onSubmit={handleLookup} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
              <Link2 className="w-5 h-5" />
            </div>
            <input
              type="text"
              placeholder="Enter short URL or code (e.g. 7GhY3s)"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 rounded-xl glass-input text-white text-sm"
              disabled={isLoading}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-brand-blue to-brand-purple hover:opacity-90 text-white font-semibold flex items-center justify-center gap-2 ripple-btn cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Searching...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Search</span>
              </>
            )}
          </button>
        </form>
      </motion.div>

      {/* Results Section */}
      <AnimatePresence mode="wait">
        {urlDetails && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {/* Main Info Card */}
            <div className="md:col-span-2 space-y-6">
              <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-6">
                <div>
                  <h3 className="text-gray-400 text-xs font-mono uppercase tracking-wider mb-2">Original Destination URL</h3>
                  <div className="flex items-start justify-between gap-4 bg-black/30 p-3 rounded-lg border border-white/5">
                    <p className="text-white break-all text-sm font-mono">{urlDetails.original_url}</p>
                    <button
                      onClick={() => handleCopy(urlDetails.original_url)}
                      className="p-1.5 rounded-md hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
                      title="Copy URL"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                    <div className="flex items-center gap-2 text-brand-blue mb-1">
                      <MousePointer className="w-4 h-4" />
                      <span className="text-xs font-semibold">Total Redirects</span>
                    </div>
                    <p className="text-2xl font-bold font-display text-white">{urlDetails.clicks}</p>
                  </div>
                  
                  <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                    <div className="flex items-center gap-2 text-brand-purple mb-1">
                      <Calendar className="w-4 h-4" />
                      <span className="text-xs font-semibold">Created At</span>
                    </div>
                    <p className="text-sm font-semibold text-white mt-1">
                      {new Date(urlDetails.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-white/5 text-xs text-gray-400">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5" />
                      <span>Custom Alias:</span>
                    </div>
                    <span className="font-mono text-white font-semibold">
                      {urlDetails.custom_alias ? `/${urlDetails.custom_alias}` : 'None'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5" />
                      <span>Password Protection:</span>
                    </div>
                    <span className={`font-semibold px-2 py-0.5 rounded text-[10px] ${
                      urlDetails.password_protected ? 'bg-brand-pink/10 text-brand-pink' : 'bg-white/10 text-gray-400'
                    }`}>
                      {urlDetails.password_protected ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Expiration:</span>
                    </div>
                    <span className="font-semibold text-white">
                      {urlDetails.expires_at ? new Date(urlDetails.expires_at).toLocaleString() : 'Never'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Hashing Telemetry Card */}
              <div className="glass-panel p-6 rounded-2xl border border-white/5">
                <h3 className="text-white font-display font-semibold text-sm mb-4">DSA Hashing Metadata</h3>
                <div className="space-y-4 font-mono text-xs">
                  <div>
                    <span className="text-gray-500 block mb-1">SHA-256 Full Hash</span>
                    <span className="text-gray-300 break-all bg-black/40 p-2.5 rounded border border-white/5 block">
                      {urlDetails.hash_value}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-gray-500 block mb-1">Calculated Bucket</span>
                      <span className="text-brand-purple font-bold">
                        Index {dsaSteps?.bucket_index ?? 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block mb-1">Search Comparisons</span>
                      <span className="text-brand-blue font-bold">
                        {dsaSteps?.comparisons ?? 1} node(s) traversed
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* QR Code and Actions Card */}
            <div className="glass-panel p-6 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center">
              <h3 className="text-white font-display font-semibold text-sm mb-6">Short Link QR Code</h3>
              
              <div className="p-4 bg-white rounded-xl shadow-lg mb-6">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                    window.location.origin + '/' + urlDetails.short_code
                  )}`}
                  alt="Short link QR"
                  className="w-[180px] h-[180px]"
                />
              </div>

              <div className="text-sm font-semibold text-white mb-2">
                /{urlDetails.short_code}
              </div>
              <p className="text-gray-400 text-xs mb-6 break-all">
                {window.location.origin}/{urlDetails.short_code}
              </p>

              <div className="w-full space-y-2">
                <button
                  onClick={() => handleCopy(`${window.location.origin}/${urlDetails.short_code}`)}
                  className="w-full py-2.5 rounded-lg border border-white/10 hover:bg-white/5 text-xs text-white font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Short URL</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleDownloadQR}
                    className="py-2.5 rounded-lg border border-white/10 hover:bg-white/5 text-xs text-white font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download QR</span>
                  </button>
                  <button
                    onClick={handleShare}
                    className="py-2.5 rounded-lg border border-white/10 hover:bg-white/5 text-xs text-white font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share Link</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
