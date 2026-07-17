import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Database, Layers, Settings, Plus, Search, Trash2, RefreshCw, 
  HelpCircle, AlertTriangle, ArrowRight, Activity, ChevronRight, Check, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiUrl } from '../api';

export default function VisualizationPage() {
  // Config States
  const [capacity, setCapacity] = useState(8);
  const [maxLoadFactor, setMaxLoadFactor] = useState(1.0);
  
  // Operation States
  const [insertKey, setInsertKey] = useState('');
  const [insertVal, setInsertVal] = useState('');
  const [searchKey, setSearchKey] = useState('');
  const [deleteKey, setDeleteKey] = useState('');
  
  // Table Stats & Buckets (Retrieved from API)
  const [tableStats, setTableStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Animation State for Visualization
  const [animationState, setAnimationState] = useState({
    activeBucket: null,
    activeChainKeys: [],
    traversedIndex: -1,
    operation: null, // 'insert' | 'search' | 'delete' | 'rehash'
    status: 'idle', // 'idle' | 'traversing' | 'complete'
    targetKey: '',
    found: false,
    rehashInfo: null
  });

  // Fetch current stats of the Simulator Table
  const fetchSimStats = async () => {
    try {
      const res = await fetch(apiUrl('/api/simulator/stats'));
      if (res.ok) {
        const data = await res.json();
        setTableStats(data);
      }
    } catch (err) {
      console.error("Failed to load simulator stats", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSimStats();
  }, []);

  // Reset Table Handler
  const handleResetTable = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch(apiUrl('/api/simulator/reset'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capacity: parseInt(capacity), max_load_factor: parseFloat(maxLoadFactor) })
      });
      const data = await res.json();
      if (res.ok) {
        setTableStats(data.stats);
        toast.success(data.message);
        resetAnimation();
      } else {
        toast.error(data.error || 'Failed to reset table.');
      }
    } catch (err) {
      toast.error('Network error resetting table.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetAnimation = () => {
    setAnimationState({
      activeBucket: null,
      activeChainKeys: [],
      traversedIndex: -1,
      operation: null,
      status: 'idle',
      targetKey: '',
      found: false,
      rehashInfo: null
    });
  };

  // Helper function to animate traversal step-by-step
  const animateOperation = async (operation, key, stepsData, finalStats) => {
    resetAnimation();
    
    const bucketIdx = stepsData.bucket_index;
    const traversal = stepsData.chain_traversal || [];
    
    // Step 1: Target the bucket index
    setAnimationState(prev => ({
      ...prev,
      operation,
      targetKey: key,
      activeBucket: bucketIdx,
      activeChainKeys: traversal,
      status: 'traversing',
      traversedIndex: -1
    }));

    await new Promise(resolve => setTimeout(resolve, 800)); // wait for bucket focus

    // Step 2: Traverse separate chain nodes one-by-one
    for (let i = 0; i < traversal.length; i++) {
      setAnimationState(prev => ({
        ...prev,
        traversedIndex: i
      }));
      await new Promise(resolve => setTimeout(resolve, 600)); // node traversal speed
    }

    // Step 3: Complete operation
    const found = operation === 'search' ? stepsData.found : stepsData.deleted || stepsData.operation === 'update' || true;
    
    setAnimationState(prev => ({
      ...prev,
      status: 'complete',
      found
    }));

    // If rehashed during insert, trigger special rehash animation
    if (stepsData.rehashed) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setAnimationState(prev => ({
        ...prev,
        operation: 'rehash',
        rehashInfo: stepsData.rehash_details
      }));
      toast.success("🚨 Threshold exceeded! Dynamic rehashing triggered: Capacity doubled!");
      await new Promise(resolve => setTimeout(resolve, 3000)); // display rehash screen
    } else {
      await new Promise(resolve => setTimeout(resolve, 1200));
    }

    // Update real frontend stats state
    setTableStats(finalStats);
    resetAnimation();
  };

  // Insert Handler
  const handleInsert = async (e) => {
    e.preventDefault();
    if (!insertKey.trim() || !insertVal.trim()) {
      toast.error("Please fill in both key and value.");
      return;
    }
    
    try {
      const res = await fetch(apiUrl('/api/simulator/insert'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: insertKey.trim(), value: insertVal.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setInsertKey('');
        setInsertVal('');
        await animateOperation('insert', insertKey.trim(), data.steps, data.stats);
      } else {
        toast.error(data.error || "Insertion failed.");
      }
    } catch (err) {
      toast.error("Network error during insertion.");
    }
  };

  // Search Handler
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchKey.trim()) {
      toast.error("Please enter a key to search.");
      return;
    }

    try {
      const res = await fetch(apiUrl('/api/simulator/search'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: searchKey.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSearchKey('');
        await animateOperation('search', searchKey.trim(), data.steps, data.stats);
        if (data.found) {
          toast.success(`Key "${searchKey}" found! Value: "${data.value}"`);
        } else {
          toast.error(`Key "${searchKey}" not found in table.`);
        }
      } else {
        toast.error(data.error || "Search failed.");
      }
    } catch (err) {
      toast.error("Network error during search.");
    }
  };

  // Delete Handler
  const handleDelete = async (e) => {
    e.preventDefault();
    if (!deleteKey.trim()) {
      toast.error("Please enter a key to delete.");
      return;
    }

    try {
      const res = await fetch(apiUrl('/api/simulator/delete'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: deleteKey.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDeleteKey('');
        await animateOperation('delete', deleteKey.trim(), data.steps, data.stats);
        toast.success(`Key "${deleteKey}" deleted successfully.`);
      } else {
        toast.error(data.error || `Key "${deleteKey}" not found, deletion skipped.`);
      }
    } catch (err) {
      toast.error("Network error during deletion.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold font-display text-white">Custom Hash Table Visualizer</h1>
          <p className="text-gray-400 text-sm mt-1 font-mono">
            Interactive simulator demonstrating C++ std::unordered_map hashing & separate chaining collision resolution.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-purple opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-purple"></span>
          </span>
          <span className="text-xs text-gray-400 font-mono">Simulating Active State</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Controls & Operations Panel (lg:col-span-4) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Section 1: Hash Table Configuration */}
          <div className="glass-panel p-5 rounded-2xl border border-white/5">
            <h3 className="text-xs font-bold text-white font-display uppercase tracking-wider mb-4 flex items-center gap-2">
              <Settings className="w-4 h-4 text-brand-blue" />
              <span>Table Initialization</span>
            </h3>
            
            <form onSubmit={handleResetTable} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-500 text-[10px] font-mono mb-1">Buckets Capacity</label>
                  <input
                    type="number"
                    min="2"
                    max="128"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg glass-input text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-500 text-[10px] font-mono mb-1">Max Load Factor</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="2.0"
                    value={maxLoadFactor}
                    onChange={(e) => setMaxLoadFactor(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg glass-input text-xs"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-white/5 hover:bg-white/10 text-white font-semibold text-xs rounded-xl border border-white/10 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Re-Initialize Table</span>
              </button>
            </form>
          </div>

          {/* Section 2: Operations Playground */}
          <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-5">
            <h3 className="text-xs font-bold text-white font-display uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-brand-purple" />
              <span>DSA Simulator Operations</span>
            </h3>

            {/* A. INSERT */}
            <div className="p-4 bg-black/20 rounded-xl border border-white/5 space-y-3">
              <div className="text-[10px] font-bold text-brand-blue uppercase tracking-wider font-mono">Insert Node</div>
              <form onSubmit={handleInsert} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Key"
                  value={insertKey}
                  onChange={(e) => setInsertKey(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg glass-input text-xs"
                  disabled={animationState.status !== 'idle'}
                />
                <input
                  type="text"
                  placeholder="Value"
                  value={insertVal}
                  onChange={(e) => setInsertVal(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg glass-input text-xs"
                  disabled={animationState.status !== 'idle'}
                />
                <button
                  type="submit"
                  disabled={animationState.status !== 'idle'}
                  className="px-3.5 py-2 bg-brand-blue hover:opacity-90 rounded-lg text-white font-semibold text-xs flex items-center justify-center cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </form>
            </div>

            {/* B. SEARCH */}
            <div className="p-4 bg-black/20 rounded-xl border border-white/5 space-y-3">
              <div className="text-[10px] font-bold text-brand-pink uppercase tracking-wider font-mono">Search Key</div>
              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter target key..."
                  value={searchKey}
                  onChange={(e) => setSearchKey(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg glass-input text-xs"
                  disabled={animationState.status !== 'idle'}
                />
                <button
                  type="submit"
                  disabled={animationState.status !== 'idle'}
                  className="px-4 py-2 bg-brand-pink hover:opacity-90 rounded-lg text-white font-semibold text-xs flex items-center justify-center cursor-pointer disabled:opacity-50"
                >
                  <Search className="w-4 h-4" />
                </button>
              </form>
            </div>

            {/* C. DELETE */}
            <div className="p-4 bg-black/20 rounded-xl border border-white/5 space-y-3">
              <div className="text-[10px] font-bold text-red-400 uppercase tracking-wider font-mono">Delete Key</div>
              <form onSubmit={handleDelete} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter key to delete..."
                  value={deleteKey}
                  onChange={(e) => setDeleteKey(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg glass-input text-xs"
                  disabled={animationState.status !== 'idle'}
                />
                <button
                  type="submit"
                  disabled={animationState.status !== 'idle'}
                  className="px-4 py-2 bg-red-500 hover:opacity-90 rounded-lg text-white font-semibold text-xs flex items-center justify-center cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </form>
            </div>

          </div>

          {/* Section 3: Hash Table Metrics */}
          <div className="glass-panel p-5 rounded-2xl border border-white/5">
            <h3 className="text-xs font-bold text-white font-display uppercase tracking-wider mb-4 flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-500" />
              <span>Real-Time DSA Metrics</span>
            </h3>

            <div className="space-y-4">
              {/* Load Factor Bar */}
              <div>
                <div className="flex justify-between text-[10px] font-mono mb-1.5">
                  <span className="text-gray-400">Load Factor Status</span>
                  <span className="text-white font-bold">
                    {tableStats?.load_factor ?? '0.00'} / {tableStats?.max_load_factor ?? '1.0'}
                  </span>
                </div>
                <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      (tableStats?.load_factor || 0) > (tableStats?.max_load_factor || 1.0)
                        ? 'bg-amber-500 shadow-lg shadow-amber-500/50' 
                        : 'bg-gradient-to-r from-brand-blue to-brand-purple'
                    }`}
                    style={{ width: `${Math.min(((tableStats?.load_factor || 0) / (tableStats?.max_load_factor || 1.0)) * 100, 100)}%` }}
                  />
                </div>
              </div>

              {/* Grid Statistics details */}
              <div className="grid grid-cols-2 gap-3 text-[10px] font-mono text-gray-400">
                <div className="bg-black/10 p-2.5 rounded border border-white/5">
                  <span className="block text-gray-500">Unique Size:</span>
                  <span className="text-white font-bold text-xs mt-0.5 block">{tableStats?.size ?? 0} keys</span>
                </div>
                <div className="bg-black/10 p-2.5 rounded border border-white/5">
                  <span className="block text-gray-500">Table Capacity:</span>
                  <span className="text-white font-bold text-xs mt-0.5 block">{tableStats?.capacity ?? 8} slots</span>
                </div>
                <div className="bg-black/10 p-2.5 rounded border border-white/5">
                  <span className="block text-gray-500">Hash Collisions:</span>
                  <span className="text-amber-500 font-bold text-xs mt-0.5 block">{tableStats?.collision_count ?? 0}</span>
                </div>
                <div className="bg-black/10 p-2.5 rounded border border-white/5">
                  <span className="block text-gray-500">Rehash Count:</span>
                  <span className="text-brand-pink font-bold text-xs mt-0.5 block">{tableStats?.rehash_count ?? 0}</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right Side: Virtual Hash Memory Grid Array (lg:col-span-8) */}
        <div className="lg:col-span-8 flex flex-col">
          
          {/* Main Visualizer Board */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5 flex-1 min-h-[500px] flex flex-col relative overflow-hidden">
            
            {/* Screen overlay for dynamic rehashing animations */}
            <AnimatePresence>
              {animationState.operation === 'rehash' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-20 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
                >
                  <motion.div 
                    animate={{ scale: [1, 1.05, 1], rotate: [0, 5, -5, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="p-4 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 mb-4"
                  >
                    <AlertTriangle className="w-12 h-12" />
                  </motion.div>
                  <h3 className="text-xl font-bold font-display text-white mb-2">Threshold Exceeded! Rehashing Element Array...</h3>
                  <p className="text-xs text-gray-400 font-mono max-w-sm mb-6 leading-relaxed">
                    Load factor breached limit. Table capacity is doubling from <strong>{animationState.rehashInfo?.old_capacity}</strong> to <strong>{animationState.rehashInfo?.new_capacity}</strong>. Redistributing keys via new hash mod operations.
                  </p>

                  {/* Visual list of redistributions */}
                  <div className="w-full max-w-md bg-black/40 p-4 rounded-xl border border-white/5 font-mono text-[9px] text-left max-h-[220px] overflow-y-auto space-y-1">
                    <div className="font-bold text-white border-b border-white/5 pb-1 mb-1 grid grid-cols-3">
                      <span>Key</span>
                      <span>Old Bucket</span>
                      <span>New Bucket</span>
                    </div>
                    {animationState.rehashInfo?.redistributions?.map((red, idx) => (
                      <div key={idx} className="grid grid-cols-3 py-0.5 border-b border-white/[0.02]">
                        <span className="text-brand-blue">{red.key}</span>
                        <span className="text-gray-500">Slot {red.old_bucket}</span>
                        <span className="text-emerald-500 font-bold">Slot {red.new_bucket}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Simulation Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/5 pb-4 mb-6 gap-2.5">
              <h3 className="text-sm font-semibold text-white font-display flex items-center gap-2">
                <Layers className="w-4.5 h-4.5 text-brand-purple" />
                <span>Memory Buckets Array Slots</span>
              </h3>
              
              {/* Dynamic instruction status display */}
              <div className="text-[10px] font-mono text-gray-400">
                {animationState.status === 'idle' && (
                  <span className="text-gray-500">💡 Perform Insert/Search/Delete to watch execution steps.</span>
                )}
                {animationState.status === 'traversing' && (
                  <span className="text-brand-pink animate-pulse">
                    ⚡ Traversing Bucket {animationState.activeBucket}: comparison {animationState.traversedIndex + 1}...
                  </span>
                )}
                {animationState.status === 'complete' && (
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>Operation complete! Found: {animationState.found ? 'TRUE' : 'FALSE'}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Array of Buckets Visual Grid */}
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center text-xs font-mono text-gray-500 gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-brand-purple" />
                <span>Loading simulator buckets...</span>
              </div>
            ) : !tableStats || !tableStats.buckets ? (
              <div className="flex-1 flex items-center justify-center text-xs font-mono text-gray-500">
                Reset table to initialize simulator memory state.
              </div>
            ) : (
              <div className="flex-1 space-y-3.5 overflow-y-auto max-h-[550px] pr-2">
                {tableStats.buckets.map((bucket) => {
                  const isActiveBucket = animationState.activeBucket === bucket.index;
                  const isBucketTraversing = isActiveBucket && animationState.status === 'traversing';
                  
                  return (
                    <motion.div
                      key={bucket.index}
                      animate={{
                        borderColor: isActiveBucket 
                          ? (animationState.operation === 'search' ? '#ec4899' : (animationState.operation === 'delete' ? '#ef4444' : '#3b82f6')) 
                          : 'rgba(255, 255, 255, 0.05)',
                        backgroundColor: isActiveBucket 
                          ? 'rgba(139, 92, 246, 0.03)' 
                          : 'rgba(2, 4, 10, 0.15)'
                      }}
                      className="p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center gap-3 transition-colors"
                    >
                      {/* Bucket Index Marker */}
                      <div className={`w-14 px-2 py-1.5 rounded-lg border text-center font-mono text-[10px] ${
                        isActiveBucket 
                          ? 'bg-brand-purple/20 border-brand-purple/40 text-white font-bold' 
                          : 'bg-black/30 border-white/5 text-gray-500'
                      }`}>
                        Slot {bucket.index}
                      </div>

                      {/* Linked List Separate Chaining Row */}
                      <div className="flex-1 flex flex-wrap items-center gap-2">
                        {bucket.chain.length === 0 ? (
                          <span className="text-[10px] text-gray-600 font-mono italic">NULL / Empty</span>
                        ) : (
                          bucket.chain.map((keyVal, idx) => {
                            const isActiveNode = isActiveBucket && idx === animationState.traversedIndex;
                            const isNodeTraversed = isActiveBucket && idx < animationState.traversedIndex;
                            const isMatchNode = isActiveBucket && keyVal === animationState.targetKey && animationState.status === 'complete';
                            
                            return (
                              <React.Fragment key={idx}>
                                {/* Linked List Node Element */}
                                <motion.div
                                  animate={{
                                    scale: isActiveNode ? 1.05 : 1,
                                    borderColor: isMatchNode 
                                      ? '#10b981' 
                                      : isActiveNode 
                                        ? '#ec4899' 
                                        : (isNodeTraversed ? '#3b82f6' : 'rgba(255,255,255,0.08)'),
                                    backgroundColor: isMatchNode 
                                      ? 'rgba(16,185,129,0.1)' 
                                      : isActiveNode 
                                        ? 'rgba(236,72,153,0.1)' 
                                        : (isNodeTraversed ? 'rgba(59,130,246,0.05)' : 'rgba(255,255,255,0.02)')
                                  }}
                                  className="px-3 py-1.5 rounded-lg border font-mono text-[10px] text-white flex items-center gap-1.5 transition-all"
                                >
                                  <span className="font-semibold text-brand-purple">{keyVal}</span>
                                  {isActiveNode && (
                                    <span className="w-1.5 h-1.5 bg-brand-pink rounded-full animate-ping" />
                                  )}
                                  {isMatchNode && (
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  )}
                                </motion.div>

                                {/* Linked list arrow representation pointer */}
                                {idx < bucket.chain.length - 1 && (
                                  <ArrowRight className="w-3 h-3 text-gray-600" />
                                )}
                              </React.Fragment>
                            );
                          })
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
}
