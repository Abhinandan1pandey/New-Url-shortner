import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Link } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Link2, Database, Layers, Search, Sun, Moon, Info, HelpCircle } from 'lucide-react';

// Page Imports
import LandingPage from './pages/LandingPage';
import VisualizationPage from './pages/VisualizationPage';
import Dashboard from './pages/Dashboard';
import LookupPage from './pages/LookupPage';
import RedirectHandler from './pages/RedirectHandler';

function MainLayout({ children, theme, toggleTheme }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col justify-between transition-colors duration-300">
      
      {/* Premium Glassmorphic Navbar */}
      <header className="sticky top-0 z-40 w-full glass-panel border-b border-white/5 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/" className="flex items-center gap-2 group cursor-pointer">
                <div className="p-2 rounded-xl bg-gradient-to-r from-brand-blue to-brand-purple text-white shadow-md shadow-brand-purple/20 group-hover:rotate-6 transition-transform">
                  <Link2 className="w-5 h-5" />
                </div>
                <span className="font-display font-extrabold text-lg text-white tracking-tight">
                  Url <span className="bg-gradient-to-r from-brand-blue to-brand-pink bg-clip-text text-transparent">Shortner</span>
                </span>
              </Link>
            </div>

            {/* Navigation links (Desktop) */}
            <nav className="hidden md:flex items-center gap-1">
              <NavLink 
                to="/" 
                className={({ isActive }) => 
                  `px-3 py-2 text-xs font-semibold rounded-lg transition-colors font-mono cursor-pointer ${
                    isActive ? 'bg-white/5 text-white border-b-2 border-brand-purple' : 'text-gray-400 hover:text-white hover:bg-white/[0.02]'
                  }`
                }
              >
                Shortener
              </NavLink>
              <NavLink 
                to="/playground" 
                className={({ isActive }) => 
                  `px-3 py-2 text-xs font-semibold rounded-lg transition-colors font-mono cursor-pointer ${
                    isActive ? 'bg-white/5 text-white border-b-2 border-brand-purple' : 'text-gray-400 hover:text-white hover:bg-white/[0.02]'
                  }`
                }
              >
                DSA Playground
              </NavLink>
              <NavLink 
                to="/dashboard" 
                className={({ isActive }) => 
                  `px-3 py-2 text-xs font-semibold rounded-lg transition-colors font-mono cursor-pointer ${
                    isActive ? 'bg-white/5 text-white border-b-2 border-brand-purple' : 'text-gray-400 hover:text-white hover:bg-white/[0.02]'
                  }`
                }
              >
                SaaS Dashboard
              </NavLink>
              <NavLink 
                to="/lookup" 
                className={({ isActive }) => 
                  `px-3 py-2 text-xs font-semibold rounded-lg transition-colors font-mono cursor-pointer ${
                    isActive ? 'bg-white/5 text-white border-b-2 border-brand-purple' : 'text-gray-400 hover:text-white hover:bg-white/[0.02]'
                  }`
                }
              >
                Reverse Lookup
              </NavLink>
            </nav>

            {/* Actions (Theme toggle & Mobile menu) */}
            <div className="flex items-center gap-2">
              {/* Theme Toggler */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white cursor-pointer transition-colors"
                title="Toggle Theme Mode"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-brand-purple" />}
              </button>

              {/* Mobile Drawer Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white cursor-pointer"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Panel */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/5 px-4 pt-2 pb-4 space-y-1 bg-dark-bg/95">
            <Link 
              to="/" 
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2.5 rounded-lg text-sm font-semibold text-gray-400 hover:text-white hover:bg-white/5 font-mono"
            >
              Shortener
            </Link>
            <Link 
              to="/playground" 
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2.5 rounded-lg text-sm font-semibold text-gray-400 hover:text-white hover:bg-white/5 font-mono"
            >
              DSA Playground
            </Link>
            <Link 
              to="/dashboard" 
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2.5 rounded-lg text-sm font-semibold text-gray-400 hover:text-white hover:bg-white/5 font-mono"
            >
              SaaS Dashboard
            </Link>
            <Link 
              to="/lookup" 
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2.5 rounded-lg text-sm font-semibold text-gray-400 hover:text-white hover:bg-white/5 font-mono"
            >
              Reverse Lookup
            </Link>
          </div>
        )}
      </header>

      {/* Main Page Layout Wrapper */}
      <main className="flex-grow">
        {children}
      </main>

      {/* Modern Premium Footer */}
      <footer className="w-full py-8 mt-12 border-t border-white/5 bg-black/20 text-center text-xs font-mono text-gray-500">
        <div className="max-w-7xl mx-auto px-4 space-y-3">
          <div className="flex justify-center items-center gap-2">
            <Database className="w-4 h-4 text-brand-purple" />
            <span className="font-bold text-gray-400">Url Shortner System v1.0.0</span>
          </div>
          {/* Description removed per request */}
          <div className="pt-2 text-[10px] text-gray-600">
            Made by Abhinandan Pandey — © {new Date().getFullYear()} Abhinandan Pandey. All Rights Reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

function App() {
  const [theme, setTheme] = useState('dark');

  // Unified theme handler
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    if (savedTheme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    if (nextTheme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
  };

  return (
    <Router>
      <MainLayout theme={theme} toggleTheme={toggleTheme}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/playground" element={<VisualizationPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/lookup" element={<LookupPage />} />
          <Route path="/:shortCode" element={<RedirectHandler />} />
        </Routes>
      </MainLayout>
      <Toaster position="top-center" reverseOrder={false} />
    </Router>
  );
}

export default App;
