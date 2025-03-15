import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

// Components
import { CoraHeader } from "@/components/CoraHeader";
import { Hero } from "@/components/Hero";
import { Onboarding } from "@/components/Onboarding";
import { Dashboard } from "@/components/Dashboard";
import { TopBanner } from "@/components/TopBanner";

function App() {
  const { connected } = useWallet();

  return (
    <Router>
      <div className="min-h-screen bg-black text-white flex flex-col">
        <CoraHeader />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Hero />} />
            <Route 
              path="/onboarding" 
              element={connected ? <Onboarding /> : <Navigate to="/" />} 
            />
            <Route 
              path="/dashboard" 
              // element={connected ? <Dashboard /> : <Navigate to="/" />} 
              element={<Dashboard />}
            />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
