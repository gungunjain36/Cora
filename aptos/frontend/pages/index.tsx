import { useState } from 'react';
import { useRouter } from 'next/router';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { WalletSelector } from '@aptos-labs/wallet-adapter-ant-design';
import { TransactionButton } from '../components/ui/TransactionButton';
import { blockchainService } from '../utils/blockchainService';
import toast, { Toaster } from 'react-hot-toast';

// Define insurance plan types
const INSURANCE_PLANS = [
  {
    id: 'term-life',
    name: 'Term Life Insurance',
    description: 'Financial protection for your loved ones in case of unexpected events.',
    coverageAmount: 10000,
    premiumAmount: 5000,
    durationDays: 365,
    features: [
      'Death benefit protection',
      'Fixed premium payments',
      'Simple application process',
      'No investment component'
    ]
  },
  {
    id: 'health',
    name: 'Health Insurance',
    description: 'Coverage for medical expenses and treatments to protect your health.',
    coverageAmount: 20000,
    premiumAmount: 8000,
    durationDays: 365,
    features: [
      'Hospital expense coverage',
      'Prescription drug coverage',
      'Doctor visit coverage',
      'Emergency care'
    ]
  },
  {
    id: 'property',
    name: 'Property Insurance',
    description: 'Protect your home and belongings from damage, theft, and other perils.',
    coverageAmount: 50000,
    premiumAmount: 12000,
    durationDays: 365,
    features: [
      'Dwelling coverage',
      'Personal property protection',
      'Liability coverage',
      'Additional living expenses'
    ]
  }
];

export default function Home() {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const { connected, account, signAndSubmitTransaction } = useWallet();
  const [processing, setProcessing] = useState(false);
  const router = useRouter();

  const handlePurchase = async () => {
    if (!connected || !account?.address || !selectedPlan) {
      toast.error('Please connect your wallet and select a plan');
      return { success: false };
    }

    try {
      setProcessing(true);
      const plan = INSURANCE_PLANS.find(p => p.id === selectedPlan);
      
      if (!plan) {
        toast.error('Invalid plan selected');
        return { success: false };
      }

      // Create policy on the blockchain
      const result = await blockchainService.createPolicy({
        policyType: plan.name,
        coverageAmount: plan.coverageAmount,
        premiumAmount: plan.premiumAmount,
        durationDays: plan.durationDays,
        walletAddress: account.address.toString()
      });
      
      if (result.success) {
        toast.success('Policy created successfully!');
        // Navigate to dashboard after successful purchase
        setTimeout(() => router.push('/dashboard'), 2000);
        return { success: true };
      } else {
        toast.error(result.message || 'Failed to create policy');
        return { success: false };
      }
    } catch (error) {
      console.error('Error creating policy:', error);
      return { success: false, error };
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-[#11021E] text-white">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className="py-6 px-8 border-b border-white/10 backdrop-blur-md bg-black/30 sticky top-0 z-10">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center">
            <img src="/logo.svg" alt="Cora Insurance" className="h-8 w-8 mr-3" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-cora-primary to-purple-600 bg-clip-text text-transparent">Cora Insurance</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/dashboard')} 
              className="px-4 py-2 text-white/80 hover:text-white transition-colors"
            >
              Dashboard
            </button>
            <WalletSelector />
          </div>
        </div>
      </header>
      
      {/* Hero Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-extrabold mb-6 max-w-4xl mx-auto">
            Next-Gen <span className="bg-gradient-to-r from-cora-primary to-purple-600 bg-clip-text text-transparent">Blockchain Insurance</span> For Everyone
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-10">
            Secure, transparent, and efficient insurance powered by the Aptos blockchain. Instant claims, no middlemen.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-cora-primary to-purple-600 text-white font-medium hover:shadow-xl hover:shadow-cora-primary/20 transition-all"
            >
              View Plans
            </button>
            <button 
              onClick={() => router.push('/dashboard')} 
              className="px-8 py-4 rounded-xl bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-all"
            >
              My Dashboard
            </button>
          </div>
        </div>
      </section>
      
      {/* Plans Section */}
      <section id="plans" className="py-20 px-6">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Choose Your Protection Plan</h2>
          <p className="text-gray-400 text-center max-w-2xl mx-auto mb-12">
            Select the insurance policy that best fits your needs. All policies are backed by smart contracts for guaranteed payouts.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {INSURANCE_PLANS.map((plan) => (
              <div 
                key={plan.id} 
                className={`backdrop-blur-xl rounded-2xl border p-6 transition-all cursor-pointer ${
                  selectedPlan === plan.id 
                    ? 'border-cora-primary shadow-xl shadow-cora-primary/20 bg-black/60' 
                    : 'border-white/10 bg-black/40 hover:bg-black/50'
                }`}
                onClick={() => setSelectedPlan(plan.id)}
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-semibold">{plan.name}</h3>
                  {selectedPlan === plan.id && (
                    <div className="bg-cora-primary text-white text-xs font-medium px-2 py-1 rounded-full">Selected</div>
                  )}
                </div>
                <p className="text-gray-400 mb-6">{plan.description}</p>
                
                <div className="mb-6">
                  <div className="text-sm text-gray-400 mb-1">Coverage Amount</div>
                  <div className="text-2xl font-bold text-cora-primary">${plan.coverageAmount.toLocaleString()}</div>
                </div>
                
                <div className="mb-6">
                  <div className="text-sm text-gray-400 mb-1">Premium</div>
                  <div className="text-xl font-semibold">${plan.premiumAmount.toLocaleString()}</div>
                  <div className="text-sm text-gray-400">per year</div>
                </div>
                
                <div className="border-t border-white/10 pt-4 mt-4">
                  <div className="text-sm text-gray-400 mb-2">Key Features</div>
                  <ul className="space-y-2">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-cora-primary shrink-0 mr-2" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-12 flex justify-center">
            <TransactionButton
              onClick={handlePurchase}
              className={`px-8 py-4 rounded-xl font-medium text-lg w-full max-w-md ${
                !selectedPlan 
                  ? 'bg-gray-700 text-gray-300 cursor-not-allowed'
                  : 'bg-gradient-to-r from-cora-primary to-purple-600 text-white hover:shadow-xl hover:shadow-cora-primary/20'
              }`}
              loadingText="Creating your policy..."
              successText="Policy created! Redirecting to dashboard..."
              errorText="Failed to create policy"
              disabled={!selectedPlan || !connected}
            >
              {!connected ? 'Connect Wallet to Purchase' : selectedPlan ? 'Purchase Selected Plan' : 'Select a Plan'}
            </TransactionButton>
          </div>
        </div>
      </section>
      
      {/* Features Section */}
      <section className="py-20 px-6 bg-gradient-to-b from-[#11021E] to-black">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Why Choose Blockchain Insurance</h2>
          <p className="text-gray-400 text-center max-w-2xl mx-auto mb-16">
            Discover the benefits of decentralized insurance powered by smart contracts on the Aptos blockchain.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-cora-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                ),
                title: 'Maximum Security',
                description: 'Your policy is secured by cryptographic proofs and distributed across the Aptos blockchain.'
              },
              {
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-cora-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                ),
                title: 'Instant Claims',
                description: 'Smart contracts automatically verify and process claims without lengthy manual reviews.'
              },
              {
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-cora-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                ),
                title: 'Full Transparency',
                description: 'All policy terms and claim processing are publicly verifiable on the blockchain.'
              },
              {
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-cora-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
                title: 'Lower Premiums',
                description: 'Elimination of intermediaries results in cost savings passed directly to you.'
              },
              {
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-cora-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                ),
                title: 'Guaranteed Payouts',
                description: 'Once verified, claims are paid automatically with no possibility of denial or delay.'
              },
              {
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-cora-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                ),
                title: 'Global Accessibility',
                description: 'Access insurance services from anywhere without geographical restrictions.'
              }
            ].map((feature, index) => (
              <div key={index} className="backdrop-blur-xl bg-black/40 border border-white/10 rounded-2xl p-6">
                <div className="mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="py-10 px-6 border-t border-white/10">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-6 md:mb-0">
              <img src="/logo.svg" alt="Cora Insurance" className="h-8 w-8 mr-3" />
              <h1 className="text-xl font-bold bg-gradient-to-r from-cora-primary to-purple-600 bg-clip-text text-transparent">Cora Insurance</h1>
            </div>
            
            <div className="text-center md:text-right">
              <p className="text-gray-400 text-sm">
                Powered by Aptos Blockchain - Secured by Smart Contracts
              </p>
              <p className="text-gray-500 text-xs mt-2">
                © 2024 Cora Insurance. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
} 