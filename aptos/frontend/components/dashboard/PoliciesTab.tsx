type PolicyCard = {
  id: string;
  name: string;
  coverage: string;
  premium: string;
  status: "Active" | "Pending" | "Expired";
};

type PoliciesTabProps = {
  policies: PolicyCard[];
};

export function PoliciesTab({ policies }: PoliciesTabProps) {
  return (
    <div className="backdrop-blur-xl bg-black/30 rounded-2xl border border-white/10 shadow-xl h-full flex flex-col overflow-hidden">
      <div className="p-6 border-b border-white/5 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Your Policies</h2>
        <button className="px-4 py-2 bg-gradient-to-r from-cora-primary to-purple-600 text-white rounded-xl hover:shadow-lg hover:shadow-cora-primary/20 transition-all duration-200 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          New Policy
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {policies.map((policy) => (
            <div key={policy.id} className="group bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:border-cora-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-cora-primary/10">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-medium text-xl text-white">{policy.name}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    policy.status === "Active" ? "bg-green-900/30 text-green-400" :
                    policy.status === "Pending" ? "bg-yellow-900/30 text-yellow-400" :
                    "bg-red-900/30 text-red-400"
                  }`}>
                    {policy.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-gray-400 text-sm mb-1">Coverage</p>
                    <p className="font-medium text-white text-lg">{policy.coverage}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-gray-400 text-sm mb-1">Premium</p>
                    <p className="font-medium text-white text-lg">{policy.premium}</p>
                  </div>
                </div>
                <div className="flex space-x-3">
                  <button className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-300 transition-colors flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                    Details
                  </button>
                  <button className="flex-1 px-4 py-2 bg-gradient-to-r from-cora-primary to-purple-600 text-white rounded-xl hover:shadow-lg hover:shadow-cora-primary/20 transition-all duration-200 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
                    </svg>
                    File Claim
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {policies.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-12">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
                <path d="M3 8a2 2 0 012-2v10h8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
              </svg>
            </div>
            <p className="text-gray-400 mb-6 text-center max-w-md">You don't have any insurance policies yet. Let's find the perfect coverage for your needs.</p>
            <button className="px-6 py-3 bg-gradient-to-r from-cora-primary to-purple-600 text-white rounded-xl hover:shadow-lg hover:shadow-cora-primary/20 transition-all duration-200 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Get Your First Policy
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 