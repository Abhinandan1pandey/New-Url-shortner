import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Clock, AlertTriangle, ArrowRight, Loader2, Cpu } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiUrl, apiRedirectUrl } from '../api';

export default function RedirectHandler() {
  const { shortCode } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('resolving'); // 'resolving' | 'password_required' | 'expired' | 'not_found' | 'error'
  const [urlDetails, setUrlDetails] = useState(null);
  const [dsaSteps, setDsaSteps] = useState(null);
  const [password, setPassword] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  
  // Animation state tracking for showing step-by-step resolution
  const [animationStep, setAnimationStep] = useState(0);
  const [calculatedBucket, setCalculatedBucket] = useState(null);
  const [chainNodes, setChainNodes] = useState([]);
  const [traversedIndex, setTraversedIndex] = useState(-1);

  useEffect(() => {
    let active = true;

    async function resolveCode() {
      try {
        // Fetch details from lookup endpoint
        const res = await fetch(apiUrl('/api/lookup'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ short_url: shortCode })
        });

        if (!res.ok) {
          if (res.status === 404) {
            setStatus('not_found');
          } else {
            setStatus('error');
          }
          return;
        }

        const data = await res.json();
        if (!active) return;

        setUrlDetails(data.url_details);
        setDsaSteps(data.dsa_steps);

        // Extract bucket index and chain nodes from backend steps
        const bucketIdx = data.dsa_steps?.bucket_index;
        const traversal = data.dsa_steps?.chain_traversal || [];
        setCalculatedBucket(bucketIdx);
        setChainNodes(traversal);

        // Start step-by-step visualization sequence before final redirect
        // Step 0: Hash calculation
        setTimeout(() => {
          if (!active) return;
          setAnimationStep(1);
          
          // Step 1: Bucket Targeting
          setTimeout(() => {
            if (!active) return;
            setAnimationStep(2);
            
            // Step 2: Linked List Traversal
            let i = 0;
            const interval = setInterval(() => {
              if (!active) {
                clearInterval(interval);
                return;
              }
              if (i < traversal.length) {
                setTraversedIndex(i);
                i++;
              } else {
                clearInterval(interval);
                // Traversal complete. Check conditions.
                setTimeout(() => {
                  if (!active) return;
                  
                  // Check Expiration
                  if (data.url_details.expires_at) {
                    const expiresDt = new Date(data.url_details.expires_at);
                    if (new Date() > expiresDt) {
                      setStatus('expired');
                      return;
                    }
                  }

                  // Check Password Protection
                  if (data.url_details.password_protected) {
                    setStatus('password_required');
                  } else {
                    // Perform actual Redirection on Server or direct client-side redirect
                    // Use the current origin so the app works on any host.
                    window.location.href = apiRedirectUrl(shortCode);
                  }
                }, 800);
              }
            }, 500); // Highlight each node for 500ms
          }, 1200);
        }, 1000);

      } catch (err) {
        console.error(err);
        setStatus('error');
      }
    }

    resolveCode();

    return () => {
      active = false;
    };
  }, [shortCode]);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setIsVerifying(true);
    try {
      const res = await fetch(apiUrl('/api/verify-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ short_code: shortCode, password })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Correct password! Redirecting...");
        // Direct browser redirect
        window.location.href = data.original_url;
      } else {
        toast.error(data.error || "Incorrect password.");
      }
    } catch (err) {
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-height-[80vh] flex items-center justify-center p-6 bg-gradient-mesh">
      <AnimatePresence mode="wait">
        {status === 'resolving' && (
          <motion.div
            key="resolving"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-2xl p-8 glass-panel rounded-2xl border-neon-glow text-center"
          >
            <div className="flex justify-center mb-6">
              <div className="p-4 rounded-full bg-brand-purple/10 border border-brand-purple/20 text-brand-purple animate-pulse">
                <Cpu className="w-10 h-10" />
              </div>
            </div>
            
            <h2 className="text-2xl font-bold font-display text-white mb-2">
              Resolving Link: <span className="text-brand-purple">/{shortCode}</span>
            </h2>
            <p className="text-gray-400 text-sm mb-8">
              Querying Custom In-Memory Hash Table (C++ std::unordered_map style)
            </p>

            {/* DSA Execution Visualization */}
            <div className="space-y-6 text-left max-w-lg mx-auto bg-black/30 p-6 rounded-xl border border-white/5 font-mono text-xs">
              
              {/* Step 0: SHA-256 Hashing */}
              <div className="flex items-start gap-3">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  animationStep >= 0 ? 'bg-brand-blue text-white' : 'bg-white/10 text-gray-500'
                }`}>
                  1
                </div>
                <div className="flex-1">
                  <div className="text-gray-300 font-semibold">Compute Key Hash</div>
                  <div className="text-gray-500 text-[11px] mt-0.5 break-all">
                    key: "{shortCode}" &rarr; SHA-256 &rarr; Base62
                  </div>
                  {dsaSteps && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-brand-blue mt-1 text-[11px] break-all"
                    >
                      Hash: {urlDetails?.hash_value?.substring(0, 32)}...
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Step 1: Bucket Mapping */}
              <div className="flex items-start gap-3">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  animationStep >= 1 ? 'bg-brand-purple text-white' : 'bg-white/10 text-gray-500'
                }`}>
                  2
                </div>
                <div className="flex-1">
                  <div className={`font-semibold ${animationStep >= 1 ? 'text-gray-300' : 'text-gray-600'}`}>
                    Target Bucket Index
                  </div>
                  <div className="text-gray-500 text-[11px] mt-0.5">
                    index = hash % capacity (64)
                  </div>
                  {animationStep >= 1 && calculatedBucket !== null && (
                    <motion.div 
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-brand-purple mt-1 text-[11px]"
                    >
                      Bucket Location: <span className="font-bold">Index {calculatedBucket}</span>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Step 2: Linked List Traversal */}
              <div className="flex items-start gap-3">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  animationStep >= 2 ? 'bg-brand-pink text-white' : 'bg-white/10 text-gray-500'
                }`}>
                  3
                </div>
                <div className="flex-1">
                  <div className={`font-semibold ${animationStep >= 2 ? 'text-gray-300' : 'text-gray-600'}`}>
                    Separate Chaining List Traversal
                  </div>
                  <div className="text-gray-500 text-[11px] mt-0.5">
                    Traversing linked list nodes inside bucket index {calculatedBucket}
                  </div>
                  
                  {animationStep >= 2 && chainNodes.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 p-3 bg-black/40 rounded-lg border border-white/5">
                      {chainNodes.map((nodeKey, idx) => {
                        const isMatch = nodeKey === shortCode;
                        const isTraversed = idx <= traversedIndex;
                        const isCurrent = idx === traversedIndex;
                        
                        return (
                          <React.Fragment key={nodeKey}>
                            <motion.div
                              animate={{ 
                                scale: isCurrent ? 1.05 : 1,
                                borderColor: isCurrent ? '#f43f5e' : (isTraversed ? '#10b981' : 'rgba(255,255,255,0.1)'),
                                backgroundColor: isCurrent ? 'rgba(244,63,94,0.1)' : (isTraversed ? 'rgba(16,185,129,0.1)' : 'transparent')
                              }}
                              className="px-2.5 py-1 rounded border text-[10px] flex items-center gap-1 font-mono transition-colors"
                            >
                              <span className={isMatch ? "text-brand-pink" : "text-gray-400"}>
                                {nodeKey}
                              </span>
                              {isCurrent && <Loader2 className="w-3 h-3 animate-spin text-brand-pink" />}
                              {isTraversed && !isCurrent && <span className="text-emerald-500">✓</span>}
                            </motion.div>
                            {idx < chainNodes.length - 1 && (
                              <ArrowRight className="w-3 h-3 text-gray-600" />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}
                  
                  {animationStep >= 2 && traversedIndex >= 0 && traversedIndex === chainNodes.length - 1 && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-emerald-400 mt-2 text-[11px] font-semibold"
                    >
                      ✓ Match found! Match original URL: "{urlDetails?.original_url?.substring(0, 45)}..."
                    </motion.div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-center gap-2 text-gray-500 text-xs">
              <Loader2 className="w-4 h-4 animate-spin text-brand-purple" />
              <span>Checking redirect policies...</span>
            </div>
          </motion.div>
        )}

        {status === 'password_required' && (
          <motion.div
            key="password"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="w-full max-w-md p-8 glass-panel rounded-2xl border-neon-glow"
          >
            <div className="flex justify-center mb-6">
              <div className="p-4 rounded-full bg-brand-pink/10 border border-brand-pink/20 text-brand-pink">
                <Shield className="w-8 h-8" />
              </div>
            </div>
            
            <h2 className="text-2xl font-bold font-display text-center text-white mb-2">
              Password Protected
            </h2>
            <p className="text-gray-400 text-sm text-center mb-6">
              This shortened link requires a password to access the target URL.
            </p>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <input
                  type="password"
                  placeholder="Enter Passcode"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3 rounded-lg glass-input text-center text-lg font-semibold tracking-widest placeholder:tracking-normal placeholder:font-normal"
                  required
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={isVerifying}
                className="w-full py-3 px-4 rounded-lg bg-gradient-to-r from-brand-blue to-brand-purple text-white font-semibold ripple-btn flex items-center justify-center gap-2"
              >
                {isVerifying ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>Unlock & Redirect</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </motion.div>
        )}

        {status === 'expired' && (
          <motion.div
            key="expired"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="w-full max-w-md p-8 glass-panel rounded-2xl border-red-500/20 text-center"
          >
            <div className="flex justify-center mb-6">
              <div className="p-4 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">
                <Clock className="w-10 h-10" />
              </div>
            </div>
            
            <h2 className="text-2xl font-bold font-display text-white mb-2">
              Link Expired
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              The expiration time limit for this shortened URL has been exceeded.
            </p>
            
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2.5 rounded-lg border border-white/10 hover:bg-white/5 transition-all text-sm font-semibold text-gray-300"
            >
              Back to Home
            </button>
          </motion.div>
        )}

        {status === 'not_found' && (
          <motion.div
            key="not_found"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="w-full max-w-md p-8 glass-panel rounded-2xl border-amber-500/20 text-center"
          >
            <div className="flex justify-center mb-6">
              <div className="p-4 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <AlertTriangle className="w-10 h-10" />
              </div>
            </div>
            
            <h2 className="text-2xl font-bold font-display text-white mb-2">
              404 Link Not Found
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              This short code does not correspond to any active URL in our Custom Hash Table.
            </p>
            
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-brand-blue to-brand-purple text-white font-semibold ripple-btn"
            >
              Create New Link
            </button>
          </motion.div>
        )}

        {status === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="w-full max-w-md p-8 glass-panel rounded-2xl border-red-500/20 text-center"
          >
            <div className="flex justify-center mb-6">
              <div className="p-4 rounded-full bg-red-500/10 border border-red-500/20 text-red-500">
                <AlertTriangle className="w-10 h-10" />
              </div>
            </div>
            
            <h2 className="text-2xl font-bold font-display text-white mb-2">
              Resolution Failed
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              A connection error occurred while querying the backend custom Hash Table.
            </p>
            
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-brand-blue to-brand-purple text-white font-semibold ripple-btn"
            >
              Retry
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
