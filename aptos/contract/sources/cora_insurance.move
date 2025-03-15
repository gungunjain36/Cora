module cora_insurance_addr::cora_insurance {
    use std::signer;
    use std::error;

    /// Error codes
    const E_NOT_AUTHORIZED: u64 = 1;

    /// Initialize the Cora Insurance platform
    fun init_module(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        
        // Check if the caller is the module publisher
        assert!(admin_addr == @cora_insurance_addr, error::permission_denied(E_NOT_AUTHORIZED));
        
        // Note: In a real implementation, we would initialize all modules here
        // But for now, we're relying on the individual modules' init_module functions
        // which are automatically called when the module is published
    }

    /// Public entry point to initialize the platform (for testing)
    public entry fun initialize_platform(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        
        // Check if the caller is the module publisher
        assert!(admin_addr == @cora_insurance_addr, error::permission_denied(E_NOT_AUTHORIZED));
        
        // Note: In a real implementation, we would initialize all modules here
        // But for now, we're relying on the individual modules' init_module functions
        // which are automatically called when the module is published
    }

    #[test_only]
    public fun init_for_testing(admin: &signer) {
        init_module(admin);
    }
} 