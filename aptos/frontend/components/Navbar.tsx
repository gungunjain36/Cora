import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/useAuth";
import { ConnectWalletButton } from "./ui/ConnectWalletButton";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useState, useEffect } from "react";

export function Navbar() {
  const location = useLocation();
  const { authenticated, logout } = useAuth();
  const { disconnect } = useWallet();
  const [scrolled, setScrolled] = useState(false);
  
  // Track scrolling to change navbar appearance
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Don't show navbar on onboarding page
  if (location.pathname === "/onboarding") {
    return null;
  }
  
  const isLandingPage = location.pathname === "/";
  const isDashboard = location.pathname === "/dashboard";
  const isPolicyDemo = location.pathname === "/create-policy-demo";
  const isImprovedPolicyDemo = location.pathname === "/improved-policy-demo";
  
  // Logout and disconnect wallet
  const handleLogout = () => {
    disconnect();
    logout();
  };

  // Check if dashboard tab is active
  const currentTab = new URLSearchParams(location.search).get('tab');
  const isPoliciesTab = currentTab === 'policies';
  const isClaimsTab = currentTab === 'claims';
  
  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 px-6 md:px-8 lg:px-16 2xl:px-[116px] transition-all duration-300 ${
      scrolled 
        ? "py-2 backdrop-blur-lg bg-black/60 border-b border-white/10 shadow-lg" 
        : "py-4 backdrop-blur-md bg-black/30 border-b border-white/5"
    } h-16`}>
      <div className="container mx-auto flex justify-between items-center h-full">
        <Link to="/" className="flex items-center group">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cora-primary to-cora-secondary flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
            <span className="text-cora-light font-bold">C</span>
          </div>
          <span className="ml-2 text-xl font-medium text-cora-light group-hover:text-cora-primary transition-colors duration-300">Cora</span>
        </Link>
        
        <div className="flex items-center gap-5">
          {/* Always show Home button except on landing page */}
          {!isLandingPage && (
            <Link 
              to="/" 
              className="hidden sm:flex items-center text-cora-light hover:text-cora-primary transition-all duration-300 relative px-1 py-1 text-sm font-medium"
            >
              <span className="relative z-10">Home</span>
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-cora-primary transition-all duration-300 group-hover:w-full"></span>
            </Link>
          )}
          
          {/* Show Dashboard link for authenticated users */}
          {authenticated && (
            <Link 
              to="/dashboard" 
              className={`hidden sm:flex items-center transition-all duration-300 relative px-1 py-1 text-sm font-medium ${
                isDashboard && !isPoliciesTab && !isClaimsTab ? "text-cora-primary" : "text-cora-light hover:text-cora-primary"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
              <span className="relative z-10">Dashboard</span>
              {isDashboard && !isPoliciesTab && !isClaimsTab && (
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-cora-primary"></span>
              )}
            </Link>
          )}
          
          {/* My Policies tab */}
          {authenticated && (
            <Link 
              to="/dashboard?tab=policies" 
              className={`hidden sm:flex items-center transition-all duration-300 relative px-1 py-1 text-sm font-medium ${
                isPoliciesTab ? "text-cora-primary" : "text-cora-light hover:text-cora-primary"
              }`}
              title="My Policies"
              aria-label="My Policies"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
                <path d="M3 8a2 2 0 012-2v10h8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
              </svg>
              <span className="relative z-10">My Policies</span>
              {isPoliciesTab && (
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-cora-primary"></span>
              )}
            </Link>
          )}
          
          {/* File a Claim tab */}
          {authenticated && (
            <Link 
              to="/dashboard?tab=claims" 
              className={`hidden sm:flex items-center transition-all duration-300 relative px-1 py-1 text-sm font-medium ${
                isClaimsTab ? "text-cora-primary" : "text-cora-light hover:text-cora-primary"
              }`}
              title="File a Claim"
              aria-label="File a Claim"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
              </svg>
              <span className="relative z-10">File a Claim</span>
              {isClaimsTab && (
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-cora-primary"></span>
              )}
            </Link>
          )}
          
          {/* Policy Demo Links */}
          <Link 
            to="/create-policy-demo" 
            className={`hidden sm:flex items-center transition-all duration-300 relative px-1 py-1 text-sm font-medium ${
              isPolicyDemo ? "text-cora-primary" : "text-cora-light hover:text-cora-primary"
            }`}
            title="Policy Demo"
            aria-label="Policy Demo"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
            </svg>
            <span className="relative z-10">Policy Demo</span>
            {isPolicyDemo && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-cora-primary"></span>
            )}
          </Link>
          
          <Link 
            to="/improved-policy-demo" 
            className={`hidden sm:flex items-center transition-all duration-300 relative px-1 py-1 text-sm font-medium ${
              isImprovedPolicyDemo ? "text-cora-primary" : "text-cora-light hover:text-cora-primary"
            }`}
            title="Improved Demo"
            aria-label="Improved Demo"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
            </svg>
            <span className="relative z-10">Improved Demo</span>
            {isImprovedPolicyDemo && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-cora-primary"></span>
            )}
          </Link>
          
          {/* Show Logout button for authenticated users */}
          {authenticated && (
            <>
              <button 
                onClick={handleLogout}
                className="hidden sm:flex items-center text-cora-light hover:text-cora-primary transition-all duration-300 relative px-1 py-1 text-sm font-medium"
                title="Logout"
                aria-label="Logout"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1H3zm6 11a1 1 0 11-2 0 1 1 0 012 0zm4-3a1 1 0 00-1-1H8a1 1 0 100 2h4a1 1 0 001-1zm-1-4a1 1 0 011 1 1 1 0 01-1 1H8a1 1 0 110-2h4z" />
                </svg>
                <span className="relative z-10">Logout</span>
              </button>
              <div className="h-6 w-px bg-white/10 hidden sm:block"></div>
            </>
          )}
          
          {/* Always show wallet button */}
          <ConnectWalletButton variant="secondary" />
        </div>
      </div>
    </nav>
  );
} 