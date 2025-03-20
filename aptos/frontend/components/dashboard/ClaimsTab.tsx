type PolicyCard = {
  id: string;
  name: string;
  coverage: string;
  premium: string;
  status: "Active" | "Pending" | "Expired";
};

type ClaimsTabProps = {
  policies: PolicyCard[];
  setActiveTab: (tab: "chat" | "policies" | "claims") => void;
};

export function ClaimsTab({ policies, setActiveTab }: ClaimsTabProps) {
  return (
    <div className="backdrop-blur-xl bg-black/30 rounded-2xl border border-white/10 shadow-xl h-full flex flex-col overflow-hidden">
      <div className="p-6 border-b border-white/5">
        <h2 className="text-xl font-bold text-cora-light">File a Claim</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="bg-gradient-to-r from-cora-primary/20 to-cora-secondary/20 rounded-2xl p-[1px] overflow-hidden">
          <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-6">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-cora-primary to-cora-secondary flex items-center justify-center">
                <span className="text-cora-light font-bold text-lg">C</span>
              </div>
              <div className="ml-4">
                <h3 className="text-xl font-bold text-cora-light">Cora Claim Assistant</h3>
                <p className="text-cora-gray">I'll guide you through the claim process</p>
              </div>
            </div>
            <p className="text-cora-light/80 mb-6">
              Filing a claim is easy with Cora. I can help you submit the necessary documentation and track your claim status in real-time. Would you like to start a guided claim process?
            </p>
            <button 
              onClick={() => setActiveTab("chat")}
              className="cora-button py-3 px-6"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-cora-primary to-cora-secondary"></span>
              <span className="absolute inset-0 bg-gradient-to-r from-cora-primary via-cora-light-orange to-cora-secondary opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
              <span className="relative flex items-center text-cora-light">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                </svg>
                Chat with Cora
              </span>
            </button>
          </div>
        </div>
        
        <div className="space-y-4">
          {policies.map((policy) => (
            <div key={policy.id} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 hover:border-cora-primary/30 transition-all duration-300">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-medium text-lg text-cora-light">{policy.name}</h3>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  policy.status === "Active" ? "bg-green-900/30 text-green-400" :
                  policy.status === "Pending" ? "bg-yellow-900/30 text-yellow-400" :
                  "bg-red-900/30 text-red-400"
                }`}>
                  {policy.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm text-cora-gray mb-4">
                <div>
                  <p className="text-cora-gray">Coverage</p>
                  <p className="font-medium text-cora-light">{policy.coverage}</p>
                </div>
                <div>
                  <p className="text-cora-gray">Premium</p>
                  <p className="font-medium text-cora-light">{policy.premium}</p>
                </div>
              </div>
              <div className="flex space-x-2">
                <button className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded text-sm transition-colors text-cora-light">
                  View Details
                </button>
                <button className="relative overflow-hidden px-3 py-1 rounded text-sm group">
                  <span className="absolute inset-0 bg-gradient-to-r from-cora-primary to-cora-secondary"></span>
                  <span className="absolute inset-0 bg-gradient-to-r from-cora-primary via-cora-light-orange to-cora-secondary opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                  <span className="relative text-cora-light">File Claim</span>
                </button>
              </div>
            </div>
          ))}

          {policies.length === 0 && (
            <div className="text-center py-8">
              <p className="text-cora-gray mb-4">You don't have any policies yet</p>
              <button 
                onClick={() => setActiveTab("policies")}
                className="cora-button py-2 px-4"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-cora-primary to-cora-secondary"></span>
                <span className="absolute inset-0 bg-gradient-to-r from-cora-primary via-cora-light-orange to-cora-secondary opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                <span className="relative text-cora-light">Get Your First Policy</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 