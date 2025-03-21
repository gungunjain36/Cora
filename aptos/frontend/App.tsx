import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Components
import { Landing } from "./pages/Landing";
import { Dashboard } from "./components/Dashboard";
import { Onboarding } from "./components/Onboarding";
import { PrivyProvider } from "@/lib/PrivyProvider";
import { Navbar } from "./components/Navbar";

// Create a client
const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PrivyProvider>
        <BrowserRouter>
          <Navbar />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/onboarding" element={<Onboarding />} />
          </Routes>
        </BrowserRouter>
      </PrivyProvider>
    </QueryClientProvider>
  );
}

export default App;
