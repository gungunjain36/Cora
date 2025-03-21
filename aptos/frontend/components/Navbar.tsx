import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/useAuth";
import { ConnectWalletButton } from "./ui/ConnectWalletButton";

export function Navbar() {
  const location = useLocation();
  const { authenticated, logout } = useAuth();
  
  // Don't show navbar on onboarding page
  if (location.pathname === "/onboarding") {
    return null;
  }
  
  // Don't show full navbar on landing page (Hero component has its own wallet button)
  const isLandingPage = location.pathname === "/";
  
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 py-4 px-6 md:px-8 lg:px-16 2xl:px-[116px] backdrop-blur-md bg-black/30 border-b border-white/5">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cora-primary to-cora-secondary flex items-center justify-center">
            <span className="text-cora-light font-bold">C</span>
          </div>
          <span className="ml-2 text-xl font-medium text-cora-light">Cora</span>
        </Link>
        
        <div className="flex items-center gap-4">
          {authenticated && !isLandingPage && (
            <>
              <Link to="/dashboard" className="hidden sm:block text-cora-light hover:text-cora-primary transition-colors">
                Dashboard
              </Link>
              <button 
                onClick={logout}
                className="hidden sm:block text-cora-light hover:text-cora-primary transition-colors"
              >
                Logout
              </button>
              <div className="h-6 w-px bg-white/10 hidden sm:block"></div>
            </>
          )}
          
          {!isLandingPage && (
            <ConnectWalletButton variant="secondary" />
          )}
        </div>
      </div>
    </nav>
  );
} 