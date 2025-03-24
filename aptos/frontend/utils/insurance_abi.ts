// Insurance contract ABI
export const INSURANCE_ABI = {
  address: '0xe53177a3c1354e7a47df7facaf2161297e688e21f5ef9e6a9db81b07337056cc',
  name: 'Cora Insurance',
  
  // View functions
  view: {
    // Policy Registry module view functions
    get_user_policies: {
      module: 'policy_registry',
      name: 'get_user_policies',
      doc: 'Get all policies owned by a user'
    },
    get_policy_details: {
      module: 'policy_registry',
      name: 'get_policy_details',
      doc: 'Get details for a specific policy'
    },
    
    // Premium Escrow module view functions
    get_premium_payment_status: {
      module: 'premium_escrow',
      name: 'get_premium_payment_status',
      doc: 'Check if premium has been paid for a policy'
    },
    
    // Claim Processor module view functions
    get_claim_status: {
      module: 'claim_processor',
      name: 'get_claim_status',
      doc: 'Get status of a claim for a policy'
    }
  },
  
  // Entry functions
  entry: {
    // Policy Registry module functions
    create_policy: {
      module: 'policy_registry',
      name: 'create_policy',
      doc: 'Create a new insurance policy',
      ty_args: [],
      args: [
        { name: 'policyholder', ty: 'address' },
        { name: 'coverage_amount', ty: 'u64' },
        { name: 'premium_amount', ty: 'u64' },
        { name: 'document_hash', ty: 'vector<u8>' },
        { name: 'duration_days', ty: 'u64' }
      ]
    },
    
    // Premium Escrow module functions
    pay_premium: {
      module: 'premium_escrow',
      name: 'pay_premium',
      doc: 'Pay premium for a policy',
      ty_args: [],
      args: [
        { name: 'policy_id', ty: 'u64' },
        { name: 'amount', ty: 'u64' }
      ]
    },
    
    // Claim Processor module functions
    file_claim: {
      module: 'claim_processor',
      name: 'file_claim',
      doc: 'File a claim for a policy',
      ty_args: [],
      args: [
        { name: 'policy_id', ty: 'u64' },
        { name: 'claimant', ty: 'address' },
        { name: 'claim_amount', ty: 'u64' },
        { name: 'claim_reason', ty: 'string' }
      ]
    },
    update_claim_status: {
      module: 'claim_processor',
      name: 'update_claim_status',
      doc: 'Update the status of a claim',
      ty_args: [],
      args: [
        { name: 'policy_id', ty: 'u64' },
        { name: 'status', ty: 'u8' },
        { name: 'document_hash', ty: 'vector<u8>' }
      ]
    },
    process_claim_payment: {
      module: 'claim_processor',
      name: 'process_claim_payment',
      doc: 'Process payment for an approved claim',
      ty_args: [],
      args: [
        { name: 'policy_id', ty: 'u64' }
      ]
    }
  }
}; 