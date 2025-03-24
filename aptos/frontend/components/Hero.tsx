import { useNavigate } from "react-router-dom";
import { SplineSceneBasic } from "../components/ui/spline-demo";
import { useAuth } from "@/lib/useAuth";

export function Hero() {
  const { authenticated, login, isOnboarded, navigateByAuthState } = useAuth();
  const navigate = useNavigate();

  const handleGetStarted = async () => {
    if (!authenticated) {
      // Trigger Privy login flow
      await login();
      return;
    }
    
    // Navigate based on onboarding status
    navigateByAuthState();
  };

  const handleChatWithCora = async () => {
    if (!authenticated) {
      // Trigger Privy login flow
      await login();
      return;
    }
    
    if (!isOnboarded) {
      navigate("/onboarding");
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-100px)] px-4 md:px-8 lg:px-16 2xl:px-[116px] py-16 pt-20">
      {/* Removed wallet connection button since it's now in the Navbar */}
      
      <div className="flex flex-col md:flex-row items-center justify-between w-full gap-8">
        {/* Left side content */}
        <div className="max-w-2xl text-left md:w-1/2">
          <h1 className="text-4xl md:text-6xl font-neue font-extrabold mb-6 gradient_text">
            Transparent Insurance on Blockchain
          </h1>
          <p className="text-lg md:text-xl mb-12 text-gray-300">
            Cora uses AI and blockchain to make life insurance more transparent, secure, and accessible. 
            Talk to our AI agent to find the perfect policy for you.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleGetStarted}
              className="cora-button"
            >
              <span className="absolute inset-0 bg-gradient-to-b from-cora-light to-cora-primary"></span>
              <span className="absolute inset-0 bg-gradient-to-b from-cora-light via-cora-light-green to-cora-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
              <span className="relative flex items-center whitespace-pre-wrap text-center text-lg md:text-xl font-medium leading-none tracking-tight text-cora-dark">
                Get Started
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2 transform group-hover:translate-x-1 transition-transform duration-200" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </span>
            </button>
            
            <button
              onClick={handleChatWithCora}
              className="cora-button-secondary"
            >
              <span className="absolute inset-0 bg-transparent border border-cora-primary rounded-full"></span>
              <span className="absolute inset-0 bg-cora-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full"></span>
              <span className="relative flex items-center whitespace-pre-wrap text-center text-lg md:text-xl font-medium leading-none tracking-tight text-cora-light">
                Chat with Cora
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                </svg>
              </span>
            </button>
          </div>
        </div>
        
        {/* Right side 3D Spline Scene */}
        <div className="md:w-1/2 w-full max-w-xl relative">
          <div className="w-full">
            <SplineSceneBasic />
          </div>
          {/* Platform line */}
          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cora-light/30 to-transparent"></div>
        </div>
      </div>
      
      <div className="mt-16 relative w-full max-w-4xl">
        <div className="rounded-3xl transform-gpu transition-all duration-300 hover:scale-105 hover:bg-morange hover:shadow-[0px_16px_40px_4px_rgba(46,139,87,0.2)] p-[1px] bg-gradient-to-b from-[#606064] via-[#60606442] to-[#9B9DC9BD] w-full overflow-hidden">
          <div className="black_card_gradient_with_colors h-full w-full relative rounded-[23px] overflow-hidden p-8 md:p-12">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="md:max-w-[50%]">
                <h3 className="mb-4 gradient_text_2 font-neue leading-none text-left text-[32px] md:text-[40px] font-extrabold">
                  AI-Powered Insurance
                </h3>
                <p className="text-balance mb-6 text-gray-300">
                  Talk to Cora, our AI agent, to get personalized policy recommendations based on your needs and risk profile.
                </p>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center">
                    <span className="text-cora-primary mr-2">✓</span>
                    <span>Transparent policy terms</span>
                  </li>
                  <li className="flex items-center">
                    <span className="text-cora-primary mr-2">✓</span>
                    <span>Secure blockchain storage</span>
                  </li>
                  <li className="flex items-center">
                    <span className="text-cora-primary mr-2">✓</span>
                    <span>Fast claim processing</span>
                  </li>
                </ul>
                <button
                  onClick={handleChatWithCora}
                  className="px-6 py-3 rounded-full border border-cora-primary text-cora-light hover:bg-cora-primary/10 transition-colors duration-300 flex items-center space-x-2"
                >
                  <span>Chat Now</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              <div className="relative w-full md:w-auto cursor-pointer" onClick={handleChatWithCora}>
                <div className="bg-black/50 backdrop-blur-sm rounded-xl p-4 md:p-6 border border-white/10 transition-all duration-300 hover:border-cora-primary hover:shadow-[0_0_15px_rgba(60,179,113,0.3)] relative group">
                  <div className="flex items-center mb-4">
                    <div className="w-10 h-10 rounded-full bg-cora-primary flex items-center justify-center">
                      <span className="font-bold text-cora-light">C</span>
                    </div>
                    <div className="ml-3">
                      <h4 className="font-medium text-cora-light">Cora Assistant</h4>
                      <p className="text-xs text-cora-gray">AI Insurance Agent</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-black/30 rounded-lg p-3 max-w-[80%] border border-white/5">
                      <p className="text-sm text-cora-light">Hello! I'm Cora, your insurance assistant. How can I help you today?</p>
                    </div>
                    <div className="bg-black/30 rounded-lg p-3 max-w-[80%] border border-white/5">
                      <p className="text-sm text-cora-light">I can help you find the right insurance policy based on your needs.</p>
                    </div>
                  </div>
                  
                  <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="bg-cora-primary/20 rounded-full p-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-cora-primary" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div
              className="absolute inset-0 opacity-20 z-0"
              style={{
                backgroundImage: `url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxkZWZzPjxwYXR0ZXJuIGlkPSJkb3RzIiB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiIHBhdHRlcm5UcmFuc2Zvcm09InJvdGF0ZSg0NSkiPjxjaXJjbGUgY3g9IjEiIGN5PSIxIiByPSIxIiBmaWxsPSJ3aGl0ZSIgb3BhY2l0eT0iMC4yIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2RvdHMpIiAvPjwvc3ZnPg==')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}