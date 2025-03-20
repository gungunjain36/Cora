import { PolicyCard } from "./types";
import { Dispatch, SetStateAction } from "react";

type ClaimsTabProps = {
  policies: PolicyCard[];
  setActiveTab: Dispatch<SetStateAction<"chat" | "policies" | "claims">>;
};

export function ClaimsTab({ policies, setActiveTab }: ClaimsTabProps) {
  return (
    <div className="backdrop-blur-xl bg-black/30 rounded-2xl border border-white/10 shadow-xl h-full flex flex-col overflow-hidden">
      <div className="p-6 border-b border-white/5">
        <h2 className="text-xl font-bold text-white">Claims</h2>
        <p className="text-gray-400 mt-1">View and manage your insurance claims</p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6">
        {policies.some(policy => policy.status === "Active") ? (
          <div className="space-y-6">
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-medium text-white mb-4">File a New Claim</h3>
              <p className="text-gray-400 mb-6">
                Select the policy you'd like to file a claim against and follow the steps.
              </p>
              
              <div className="space-y-4 mb-6">
                <label className="block text-sm font-medium text-gray-300" id="policy-select-label">
                  Select Policy
                </label>
                <select 
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:ring-cora-primary focus:border-cora-primary"
                  aria-labelledby="policy-select-label"
                >
                  <option value="">Select a policy...</option>
                  {policies
                    .filter(policy => policy.status === "Active")
                    .map(policy => (
                      <option key={policy.id} value={policy.id}>
                        {policy.name} - {policy.coverage}
                      </option>
                    ))
                  }
                </select>
              </div>
              
              <button className="px-4 py-2 bg-gradient-to-r from-cora-primary to-purple-600 text-white rounded-xl hover:shadow-lg hover:shadow-cora-primary/20 transition-all duration-200 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Start Claim Process
              </button>
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-white mb-4">Recent Claims</h3>
              <div className="text-center py-8 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl">
                <div className="w-16 h-16 mx-auto rounded-full bg-white/5 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-gray-400 mb-2">You haven't filed any claims yet.</p>
                <p className="text-gray-500 text-sm">When you file a claim, it will appear here.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-12">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-gray-400 mb-6 text-center max-w-md">You need an active policy before you can file a claim.</p>
            <button 
              onClick={() => setActiveTab("policies")}
              className="px-6 py-3 bg-gradient-to-r from-cora-primary to-purple-600 text-white rounded-xl hover:shadow-lg hover:shadow-cora-primary/20 transition-all duration-200 flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
                <path d="M3 8a2 2 0 012-2v10h8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
              </svg>
              Browse Policies
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 