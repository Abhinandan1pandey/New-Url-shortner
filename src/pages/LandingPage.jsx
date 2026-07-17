import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Link2, Shield, Calendar, Tag, ArrowRight, Copy, Share2, 
  Download, Cpu, CheckCircle2, ChevronRight, Zap, RefreshCw, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { apiUrl, apiRedirectUrl } from '../api';
import { generateShortenerResponse } from '../apiIntegration';

export default function LandingPage() {
  const [originalUrl, setOriginalUrl] = useState('');
  const [customAlias, setCustomAlias] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [password, setPassword] = useState('');
  
  const [showOptions, setShowOptions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [shortenedResult, setShortenedResult] = useState(null);
  
  // Hashing flow steps visual tracer state
  const [traceSteps, setTraceSteps] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [showTracer, setShowTracer] = useState(false);

  // Auto-typing text demo effect
  const [typedPlaceholder, setTypedPlaceholder] = useState('');
  const demoUrls = [
    'https://github.com/google/antigravity',
    'https://react.dev/reference/react',
    'https://en.wikipedia.org/wiki/Hash_table'
  ];

  useEffect(() => {
    let urlIdx = 0;
    let charIdx = 0;
    let isDeleting = false;
    let timer;

    const typeEffect = () => {
      const currentUrl = demoUrls[urlIdx];
      if (!isDeleting) {
        setTypedPlaceholder(currentUrl.substring(0, charIdx + 1));
        charIdx++;
        if (charIdx === currentUrl.length) {
          isDeleting = true;
          timer = setTimeout(typeEffect, 2000); // pause at full text
        } else {
          timer = setTimeout(typeEffect, 70);
        }
      } else {
        setTypedPlaceholder(currentUrl.substring(0, charIdx - 1));
        charIdx--;
        if (charIdx === 0) {
          isDeleting = false;
          urlIdx = (urlIdx + 1) % demoUrls.length;
          timer = setTimeout(typeEffect, 500); // pause before typing next
        } else {
          timer = setTimeout(typeEffect, 40);
        }
      }
    };

    timer = setTimeout(typeEffect, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleShorten = async (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    if (!originalUrl.trim()) {
      toast.error('Please enter a destination URL.');
      return;
    }

    setIsLoading(true);
    setShortenedResult(null);
    setShowTracer(true);
    setTraceSteps([]);
    setCurrentStepIndex(-1);

    try {
      const payload = {
        original_url: originalUrl.trim(),
        custom_alias: customAlias.trim() || null,
        expires_at: expiresAt || null,
        password: password.trim() || null
      };

      // Generate the shortened URL
      const res = await fetch(apiUrl('/api/shorten'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to shorten URL.');
        setShowTracer(false);
        setIsLoading(false);
        return;
      }

      // Start the optional AI description fetch in the background.
      const prompt = `Shorten the URL ${payload.original_url} and provide a concise short link description.`;
      generateShortenerResponse(prompt)
        .then((aiData) => {
          const aiResponse = typeof aiData === 'string' ? aiData : aiData?.content ?? JSON.stringify(aiData);
          setShortenedResult((prev) => prev ? { ...prev, ai_response: aiResponse } : { ...data, ai_response: aiResponse });
        })
        .catch((aiErr) => {
          console.warn('AI helper failed', aiErr);
        });

      // Load steps and trigger sequential animation
      const steps = data.hashing_steps || [];
      setTraceSteps(steps);
      
      // Step-by-step animation sequence
      for (let i = 0; i < steps.length; i++) {
        setCurrentStepIndex(i);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Success complete!
      setShortenedResult(data);
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 }
      });
      toast.success('Link generated successfully!');

    } catch (err) {
      toast.error('Network connection error. Could not reach server.');
      setShowTracer(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (shortCode) => {
    const link = `${window.location.origin}/${shortCode}`;
    navigator.clipboard.writeText(link);
    toast.success('Short link copied!');
  };

  const handleDownloadQR = (shortCode) => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
      window.location.origin + '/' + shortCode
    )}`;
    fetch(qrUrl)
      .then((res) => res.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `qr_${shortCode}.png`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success('QR Code downloaded!');
      })
      .catch(() => toast.error('Failed to download QR code.'));
  };

  const handleShare = (shortCode) => {
    const link = `${window.location.origin}/${shortCode}`;
    if (navigator.share) {
      navigator.share({
        title: 'Url Shortner System Short URL',
        text: 'Access this shortened link:',
        url: link
      }).catch(() => {});
    } else {
      handleCopy(shortCode);
      toast.success('Link copied to clipboard for sharing!');
    }
  };

  const resetForm = () => {
    setOriginalUrl('');
    setCustomAlias('');
    setExpiresAt('');
    setPassword('');
    setShortenedResult(null);
    setShowTracer(false);
    setTraceSteps([]);
    setCurrentStepIndex(-1);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 md:py-20 bg-gradient-mesh">
      
      {/* Hero Header */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-panel text-xs text-brand-purple font-mono border border-brand-purple/20 mb-6"
        >
          <Zap className="w-3.5 h-3.5 text-brand-pink" />
          <span>Vibrant Hashing & Custom Redirections</span>
        </motion.div>
        
        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-4xl sm:text-6xl font-bold font-display text-white tracking-tight leading-tight"
        >
          Smart URL Shortening
        </motion.h1>
      </div>

      {/* Main Generator Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-20">
        
        {/* URL Input Form Card */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="lg:col-span-7 glass-panel p-6 sm:p-8 rounded-2xl border-neon-glow"
        >
          <h2 className="text-xl font-bold font-display text-white mb-6 flex items-center gap-2">
            <Link2 className="text-brand-blue w-5 h-5" />
            <span>Generate Short Link</span>
          </h2>

          <form onSubmit={handleShorten} className="space-y-5">
            {/* Input URL */}
            <div>
              <label className="block text-gray-400 text-[10px] uppercase font-mono tracking-wider mb-2">
                Destination URL
              </label>
              <div className="relative">
                <input
                  type="url"
                  placeholder={`e.g., ${typedPlaceholder}`}
                  value={originalUrl}
                  onChange={(e) => setOriginalUrl(e.target.value)}
                  className="w-full pl-4 pr-12 py-3.5 rounded-xl glass-input text-white text-sm"
                  required
                  disabled={isLoading || shortenedResult !== null}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 font-mono select-none cursor-blink">
                  |
                </span>
              </div>
            </div>

            {/* Advanced Options Toggle */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowOptions(!showOptions)}
                className="text-xs text-brand-purple font-semibold hover:text-brand-pink transition-colors flex items-center gap-1 cursor-pointer"
                disabled={isLoading || shortenedResult !== null}
              >
                <span>{showOptions ? 'Hide' : 'Show'} Advanced Settings</span>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showOptions ? 'rotate-90' : ''}`} />
              </button>
            </div>

            {/* Advanced Options */}
            <AnimatePresence>
              {showOptions && !shortenedResult && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 pt-3 overflow-hidden"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Custom Alias */}
                    <div>
                      <label className="block text-gray-400 text-[10px] uppercase font-mono tracking-wider mb-1.5">
                        Custom Alias (Optional)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-mono text-xs">/</span>
                        <input
                          type="text"
                          placeholder="my-alias"
                          value={customAlias}
                          onChange={(e) => setCustomAlias(e.target.value)}
                          className="w-full pl-7 pr-3 py-2.5 rounded-lg glass-input text-xs"
                          pattern="^[a-zA-Z0-9_-]+$"
                          title="Alphanumeric, dashes, and underscores only"
                        />
                      </div>
                    </div>

                    {/* Expiration Date */}
                    <div>
                      <label className="block text-gray-400 text-[10px] uppercase font-mono tracking-wider mb-1.5">
                        Expiration Limit (Optional)
                      </label>
                      <input
                        type="datetime-local"
                        value={expiresAt}
                        onChange={(e) => setExpiresAt(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg glass-input text-xs text-gray-300"
                      />
                    </div>
                  </div>

                  {/* Password Protection */}
                  <div>
                    <label className="block text-gray-400 text-[10px] uppercase font-mono tracking-wider mb-1.5">
                      Password Protection (Optional)
                    </label>
                    <input
                      type="password"
                      placeholder="Define access passcode"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg glass-input text-xs"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submission Button */}
            {!shortenedResult ? (
              <button
                type="button"
                onClick={handleShorten}
                disabled={isLoading}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-brand-blue via-brand-purple to-brand-pink text-white font-semibold flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer border border-white/10 shadow-lg"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Processing Hashing Steps...</span>
                  </>
                ) : (
                  <>
                    <span>Shorten Link</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={resetForm}
                className="w-full py-4 rounded-xl border border-white/10 hover:bg-white/5 text-white font-semibold transition-all cursor-pointer"
              >
                Shorten Another URL
              </button>
            )}
          </form>
        </motion.div>

        {/* Dynamic Trace Visualizer Panel */}
        <div className="lg:col-span-5 flex flex-col h-full">
          <AnimatePresence mode="wait">
            {/* 1. Hashing Pipeline Trace Log */}
            {showTracer && !shortenedResult && (
              <motion.div
                key="hashing_trace"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="glass-panel p-6 rounded-2xl border border-white/5 flex-1 flex flex-col justify-between"
              >
                <div>
                  <h3 className="text-sm font-semibold text-white font-display mb-4 flex items-center gap-2">
                    <Cpu className="text-brand-purple w-4.5 h-4.5 animate-spin" />
                    <span>Hashing Pipeline execution Trace</span>
                  </h3>

                  <div className="space-y-4">
                    {traceSteps.map((step, idx) => {
                      const isCompleted = idx < currentStepIndex;
                      const isActive = idx === currentStepIndex;
                      const isPending = idx > currentStepIndex;

                      return (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`p-3.5 rounded-xl border transition-all duration-300 ${
                            isActive 
                              ? 'bg-brand-purple/10 border-brand-purple/40 shadow-inner'
                              : isCompleted
                                ? 'bg-black/20 border-white/5 opacity-60'
                                : 'border-dashed border-white/5 opacity-25'
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-mono mt-0.5 ${
                              isCompleted 
                                ? 'bg-emerald-500 text-white' 
                                : isActive 
                                  ? 'bg-brand-purple text-white animate-pulse' 
                                  : 'bg-white/5 text-gray-500'
                            }`}>
                              {isCompleted ? '✓' : idx + 1}
                            </div>
                            
                            <div className="flex-1 font-mono text-[10px]">
                              <div className={`font-semibold ${isActive ? 'text-brand-purple' : 'text-gray-300'}`}>
                                {step.title}
                              </div>
                              <div className="text-gray-400 mt-1 text-[9px] leading-relaxed">
                                {step.description}
                              </div>

                              {/* Nested step specific data rendering */}
                              {isActive && step.data && (
                                <motion.div 
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  className="mt-2 p-2 bg-black/40 rounded border border-white/5 text-[9px] text-gray-500 break-all space-y-1"
                                >
                                  {step.data.sha256 && (
                                    <div><span className="text-brand-blue">SHA-256:</span> {step.data.sha256}</div>
                                  )}
                                  {step.data.base62 && (
                                    <div><span className="text-brand-pink">Base62:</span> {step.data.base62}</div>
                                  )}
                                  {step.data.bucket_index !== undefined && (
                                    <div><span className="text-brand-purple">Bucket Index:</span> {step.data.bucket_index}</div>
                                  )}
                                  {step.data.collision_detected !== undefined && (
                                    <div><span className="text-amber-500">Collision:</span> {step.data.collision_detected ? 'Yes' : 'No'}</div>
                                  )}
                                </motion.div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
                
                <div className="text-[10px] text-gray-500 font-mono text-center mt-6">
                  Analyzing collisions & storing node in separate chain...
                </div>
              </motion.div>
            )}

            {/* 2. Shortening Result Card */}
            {shortenedResult && (
              <motion.div
                key="result_card"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass-panel p-6 rounded-2xl border-brand-purple/20 border flex-1 flex flex-col justify-between items-center text-center"
              >
                <div>
                  <div className="inline-flex p-3 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-4 animate-bounce">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold font-display text-white mb-1">Link Shortened Successfully!</h3>
                  <p className="text-gray-400 text-xs font-mono">Bucket Location: Index {traceSteps[traceSteps.length - 1]?.data?.bucket_index ?? 'N/A'}</p>
                </div>

                {/* QR Code Container */}
                <div className="my-6 p-3 bg-white rounded-xl shadow-lg border border-white/10">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                      window.location.origin + '/' + shortenedResult.short_code
                    )}`}
                    alt="Short URL QR Code"
                    className="w-[140px] h-[140px]"
                  />
                </div>

                {/* Short URL link & Actions */}
                {shortenedResult.ai_response && (
                  <div className="mb-4 p-4 rounded-2xl bg-white/5 border border-white/10 text-left text-sm text-gray-200">
                    <p className="text-xs uppercase tracking-[0.2em] text-brand-purple font-semibold mb-2">
                      AI-generated summary
                    </p>
                    <p className="leading-relaxed">{shortenedResult.ai_response}</p>
                  </div>
                )}

                <div className="w-full space-y-3">
                  <div className="flex items-center justify-between bg-black/40 px-3.5 py-3 rounded-xl border border-white/5">
                    <span className="text-brand-purple font-mono font-semibold text-sm truncate max-w-[200px]">
                      /{shortenedResult.short_code}
                    </span>
                    <button
                      onClick={() => handleCopy(shortenedResult.short_code)}
                      className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white cursor-pointer"
                      title="Copy Short URL"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleDownloadQR(shortenedResult.short_code)}
                      className="py-2.5 rounded-lg border border-white/10 hover:bg-white/5 text-xs text-white font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Save QR</span>
                    </button>
                    <button
                      onClick={() => handleShare(shortenedResult.short_code)}
                      className="py-2.5 rounded-lg border border-white/10 hover:bg-white/5 text-xs text-white font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 3. Static Info / Awaiting Form */}
            {!showTracer && !shortenedResult && (
              <motion.div
                key="welcome_info"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-panel p-6 rounded-2xl border border-white/5 flex-1 flex flex-col justify-center items-center text-center text-gray-500 font-mono text-xs space-y-3 min-h-[300px]"
              >
                <div className="w-12 h-12 rounded-full border border-dashed border-gray-700 flex items-center justify-center mb-2">
                  <Link2 className="w-5 h-5 text-gray-600" />
                </div>
                <p>Waiting for destination URL input...</p>
                <p className="text-[10px] text-gray-600 max-w-xs leading-relaxed">
                  Submit a URL to see the hashing steps trace in real-time.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* How it Works / Architecture Flowchart */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="glass-panel p-8 rounded-2xl border border-white/5"
      >
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold font-display text-white">How It Works: Hashing & Collision Pipeline</h2>
          <p className="text-gray-400 mt-2 text-sm max-w-xl mx-auto">
            A look under the hood at the mathematical transformation applied to convert a long URL into an index in our custom Hash Table.
          </p>
        </div>

        {/* Animated Flowchart SVG */}
        <div className="flex justify-center overflow-x-auto py-4">
          <svg className="min-w-[650px] h-[160px]" viewBox="0 0 750 160">
            {/* Definitions for Glow gradients */}
            <defs>
              <linearGradient id="glow-blue" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>

            {/* Arrows with dashes */}
            <path d="M 125 80 L 195 80" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeDasharray="5 3" />
            <path d="M 315 80 L 385 80" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeDasharray="5 3" />
            <path d="M 505 80 L 575 80" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeDasharray="5 3" />

            {/* Step 1: Input */}
            <g className="group">
              <rect x="10" y="45" width="115" height="70" rx="12" fill="rgba(13, 18, 36, 0.6)" stroke="#3b82f6" strokeWidth="1.5" />
              <text x="67" y="78" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">Input URL</text>
              <text x="67" y="96" fill="rgba(255,255,255,0.4)" fontSize="9" textAnchor="middle" fontFamily="monospace">google.com</text>
            </g>

            {/* Step 2: Hashing Engine */}
            <g className="group">
              <rect x="195" y="45" width="120" height="70" rx="12" fill="rgba(13, 18, 36, 0.6)" stroke="#8b5cf6" strokeWidth="1.5" />
              <text x="255" y="75" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">SHA-256 Hashing</text>
              <text x="255" y="93" fill="rgba(255,255,255,0.4)" fontSize="9" textAnchor="middle" fontFamily="monospace">Hex digest (64 chars)</text>
            </g>

            {/* Step 3: Base62 Conversion */}
            <g className="group">
              <rect x="385" y="45" width="120" height="70" rx="12" fill="rgba(13, 18, 36, 0.6)" stroke="#ec4899" strokeWidth="1.5" />
              <text x="445" y="72" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">Base62 Conversion</text>
              <text x="445" y="88" fill="rgba(255,255,255,0.4)" fontSize="8.5" textAnchor="middle" fontFamily="monospace">Take first 7 chars</text>
              <text x="445" y="101" fill="rgba(255,255,255,0.4)" fontSize="8.5" textAnchor="middle" fontFamily="monospace">Alphanumeric Code</text>
            </g>

            {/* Step 4: Storage */}
            <g className="group">
              <rect x="575" y="45" width="165" height="70" rx="12" fill="rgba(13, 18, 36, 0.6)" stroke="#10b981" strokeWidth="1.5" />
              <text x="657" y="72" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">Hash Table Collision Check</text>
              <text x="657" y="88" fill="rgba(255,255,255,0.4)" fontSize="8.5" textAnchor="middle" fontFamily="monospace">Separate Chaining</text>
              <text x="657" y="101" fill="rgba(255,255,255,0.4)" fontSize="8.5" textAnchor="middle" fontFamily="monospace">Stores in sqlite & memory</text>
            </g>
          </svg>
        </div>

        {/* Dynamic description list */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 pt-8 border-t border-white/5 text-xs">
          <div className="space-y-1 leading-relaxed">
            <h4 className="font-bold text-white font-display">1. SHA-256 Secure Signatures</h4>
            <p className="text-gray-400">
              We apply SHA-256 hashing to make sure that even a tiny alteration in the source URL completely changes the outputs, minimizing mapping overlaps.
            </p>
          </div>
          <div className="space-y-1 leading-relaxed">
            <h4 className="font-bold text-white font-display">2. Base62 Alphanumeric Encoding</h4>
            <p className="text-gray-400">
              Standard Base64 contains symbols like <code className="text-brand-pink">+</code> or <code className="text-brand-pink">/</code> which break in URLs. Base62 uses only alphanumeric characters <code className="text-brand-blue">[0-9][a-z][A-Z]</code>.
            </p>
          </div>
          <div className="space-y-1 leading-relaxed">
            <h4 className="font-bold text-white font-display">3. Separate Chaining Resolution</h4>
            <p className="text-gray-400">
              When two shortened URLs map to the same bucket index, we avoid overwriting data by chaining them as a linked list (Separate Chaining). Lookups traverse this list.
            </p>
          </div>
        </div>
      </motion.div>

    </div>
  );
}
