import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Components
import { Landing } from "./pages/Landing";
import { Dashboard } from "./components/Dashboard";
import { Onboarding } from "./components/Onboarding";
import { AptosAuthProvider } from "@/lib/AptosAuthProvider";
import { Navbar } from "./components/Navbar";
import CreatePolicyDemo from "./pages/CreatePolicyDemo";
import ImprovedPolicyDemo from "./pages/ImprovedPolicyDemo";

// Create a client
const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AptosAuthProvider>
        <BrowserRouter>
          <Navbar />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/create-policy-demo" element={<CreatePolicyDemo />} />
            <Route path="/improved-policy-demo" element={<ImprovedPolicyDemo />} />
          </Routes>
        </BrowserRouter>
      </AptosAuthProvider>
    </QueryClientProvider>
  );
}

export default App;
