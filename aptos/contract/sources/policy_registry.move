module cora_insurance_addr::policy_registry {
    use std::vector;
    use std::signer;
    use std::error;
    use aptos_framework::account;
    use aptos_framework::timestamp;
    use aptos_framework::event::{Self, EventHandle};

    /// Error codes
    const E_NOT_AUTHORIZED: u64 = 0x50001;
    const E_POLICY_ALREADY_EXISTS: u64 = 0x50002;
    const E_POLICY_DOES_NOT_EXIST: u64 = 0x50003;
    const E_POLICY_NOT_ACTIVE: u64 = 0x50004;
    const E_ADMIN_ALREADY_EXISTS: u64 = 0x50005;
    const E_ADMIN_DOES_NOT_EXIST: u64 = 0x50006;

    /// Policy status enum
    const POLICY_STATUS_ACTIVE: u8 = 0;
    const POLICY_STATUS_EXPIRED: u8 = 1;
    const POLICY_STATUS_CANCELLED: u8 = 2;

    /// Policy record stored on-chain
    struct PolicyRecord has key, store {
        id: u64,
        policyholder_address: address,
        coverage_amount: u64,
        premium_amount: u64,
        active_status: u8,
        document_hash: vector<u8>,
        start_time: u64,
        end_time: u64,
    }

    /// Event emitted when a new policy is created
    struct PolicyCreatedEvent has drop, store {
        id: u64,
        policyholder_address: address,
        coverage_amount: u64,
        premium_amount: u64,
        document_hash: vector<u8>,
        start_time: u64,
        end_time: u64,
    }

    /// Event emitted when a policy status is updated
    struct PolicyStatusUpdatedEvent has drop, store {
        id: u64,
        old_status: u8,
        new_status: u8,
    }

    /// Resource to store authorized administrators
    struct AuthorizedAdmins has key {
        admins: vector<address>,
    }

    /// Resource to store policy data and events
    struct PolicyStore has key {
        policies: vector<PolicyRecord>,
        next_policy_id: u64,
        policy_created_events: EventHandle<PolicyCreatedEvent>,
        policy_status_updated_events: EventHandle<PolicyStatusUpdatedEvent>,
    }

    /// Initialize the module
    fun init_module(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        
        // Check if the caller is the module publisher
        assert!(admin_addr == @cora_insurance_addr, error::permission_denied(E_NOT_AUTHORIZED));
        
        // Create and move the PolicyStore resource to the admin account
        move_to(admin, PolicyStore {
            policies: vector::empty<PolicyRecord>(),
            next_policy_id: 0,
            policy_created_events: account::new_event_handle<PolicyCreatedEvent>(admin),
            policy_status_updated_events: account::new_event_handle<PolicyStatusUpdatedEvent>(admin),
        });

        // Create and move the AuthorizedAdmins resource
        let admin_list = vector::empty<address>();
        vector::push_back(&mut admin_list, admin_addr); // Add module publisher as an admin
        
        move_to(admin, AuthorizedAdmins {
            admins: admin_list,
        });
    }

    /// Check if an address is an authorized admin
    fun is_authorized_admin(addr: address): bool acquires AuthorizedAdmins {
        // The module publisher is always authorized
        if (addr == @cora_insurance_addr) {
            return true
        };
        
        // Check if the address is in the authorized admins list
        let auth_admins = borrow_global<AuthorizedAdmins>(@cora_insurance_addr);
        let i = 0;
        let len = vector::length(&auth_admins.admins);
        
        while (i < len) {
            if (vector::borrow(&auth_admins.admins, i) == &addr) {
                return true
            };
            i = i + 1;
        };
        
        false
    }

    /// Add a new authorized admin
    public entry fun add_authorized_admin(
        admin: &signer,
        new_admin_addr: address
    ) acquires AuthorizedAdmins {
        let admin_addr = signer::address_of(admin);
        
        // Only the module publisher can add new admins
        assert!(admin_addr == @cora_insurance_addr, error::permission_denied(E_NOT_AUTHORIZED));
        
        let auth_admins = borrow_global_mut<AuthorizedAdmins>(@cora_insurance_addr);
        
        // Ensure the admin is not already in the list
        let i = 0;
        let len = vector::length(&auth_admins.admins);
        
        while (i < len) {
            assert!(vector::borrow(&auth_admins.admins, i) != &new_admin_addr, 
                   error::already_exists(E_ADMIN_ALREADY_EXISTS));
            i = i + 1;
        };
        
        // Add the new admin
        vector::push_back(&mut auth_admins.admins, new_admin_addr);
    }

    /// Remove an authorized admin
    public entry fun remove_authorized_admin(
        admin: &signer,
        admin_to_remove: address
    ) acquires AuthorizedAdmins {
        let admin_addr = signer::address_of(admin);
        
        // Only the module publisher can remove admins
        assert!(admin_addr == @cora_insurance_addr, error::permission_denied(E_NOT_AUTHORIZED));
        
        // Cannot remove the module publisher
        assert!(admin_to_remove != @cora_insurance_addr, error::invalid_argument(E_NOT_AUTHORIZED));
        
        let auth_admins = borrow_global_mut<AuthorizedAdmins>(@cora_insurance_addr);
        
        // Find and remove the admin
        let i = 0;
        let len = vector::length(&auth_admins.admins);
        let found = false;
        
        while (i < len) {
            if (vector::borrow(&auth_admins.admins, i) == &admin_to_remove) {
                vector::remove(&mut auth_admins.admins, i);
                found = true;
                break
            };
            i = i + 1;
        };
        
        // Ensure the admin was in the list
        assert!(found, error::not_found(E_ADMIN_DOES_NOT_EXIST));
    }

    /// Create a new policy
    public entry fun create_policy(
        admin: &signer,
        policyholder_address: address,
        coverage_amount: u64,
        premium_amount: u64,
        document_hash: vector<u8>,
        duration_in_days: u64,
    ) acquires PolicyStore, AuthorizedAdmins {
        let admin_addr = signer::address_of(admin);
        
        // Check if the caller is authorized (either module publisher or authorized admin)
        assert!(is_authorized_admin(admin_addr), error::permission_denied(E_NOT_AUTHORIZED));
        
        let policy_store = borrow_global_mut<PolicyStore>(@cora_insurance_addr);
        let policy_id = policy_store.next_policy_id;
        
        // Calculate policy start and end times
        let start_time = timestamp::now_seconds();
        let end_time = start_time + (duration_in_days * 86400); // 86400 seconds in a day
        
        // Create the policy record
        let policy = PolicyRecord {
            id: policy_id,
            policyholder_address,
            coverage_amount,
            premium_amount,
            active_status: POLICY_STATUS_ACTIVE,
            document_hash,
            start_time,
            end_time,
        };
        
        // Add the policy to the store
        vector::push_back(&mut policy_store.policies, policy);
        
        // Emit policy created event
        event::emit_event(&mut policy_store.policy_created_events, PolicyCreatedEvent {
            id: policy_id,
            policyholder_address,
            coverage_amount,
            premium_amount,
            document_hash,
            start_time,
            end_time,
        });
        
        // Increment the policy ID for the next policy
        policy_store.next_policy_id = policy_id + 1;
    }

    /// Update policy status
    public entry fun update_policy_status(
        admin: &signer,
        policy_id: u64,
        new_status: u8,
    ) acquires PolicyStore, AuthorizedAdmins {
        let admin_addr = signer::address_of(admin);
        
        // Check if the caller is authorized (either module publisher or authorized admin)
        assert!(is_authorized_admin(admin_addr), error::permission_denied(E_NOT_AUTHORIZED));
        
        let policy_store = borrow_global_mut<PolicyStore>(@cora_insurance_addr);
        
        // Find the policy by ID
        let i = 0;
        let len = vector::length(&policy_store.policies);
        let policy_found = false;
        
        while (i < len) {
            let policy = vector::borrow_mut(&mut policy_store.policies, i);
            if (policy.id == policy_id) {
                let old_status = policy.active_status;
                policy.active_status = new_status;
                policy_found = true;
                
                // Emit policy status updated event
                event::emit_event(&mut policy_store.policy_status_updated_events, PolicyStatusUpdatedEvent {
                    id: policy_id,
                    old_status,
                    new_status,
                });
                
                break
            };
            i = i + 1;
        };
        
        assert!(policy_found, error::not_found(E_POLICY_DOES_NOT_EXIST));
    }

    /// Check if a policy exists
    public fun policy_exists(policy_id: u64): bool acquires PolicyStore {
        let policy_store = borrow_global<PolicyStore>(@cora_insurance_addr);
        
        let i = 0;
        let len = vector::length(&policy_store.policies);
        
        while (i < len) {
            let policy = vector::borrow(&policy_store.policies, i);
            if (policy.id == policy_id) {
                return true
            };
            i = i + 1;
        };
        
        false
    }

    /// Get policy details
    public fun get_policy(policy_id: u64): (address, u64, u64, u8, vector<u8>, u64, u64) acquires PolicyStore {
        let policy_store = borrow_global<PolicyStore>(@cora_insurance_addr);
        
        let i = 0;
        let len = vector::length(&policy_store.policies);
        
        while (i < len) {
            let policy = vector::borrow(&policy_store.policies, i);
            if (policy.id == policy_id) {
                return (
                    policy.policyholder_address,
                    policy.coverage_amount,
                    policy.premium_amount,
                    policy.active_status,
                    *&policy.document_hash,
                    policy.start_time,
                    policy.end_time
                )
            };
            i = i + 1;
        };
        
        abort error::not_found(E_POLICY_DOES_NOT_EXIST)
    }

    /// Check if a policy is active
    public fun is_policy_active(policy_id: u64): bool acquires PolicyStore {
        let policy_store = borrow_global<PolicyStore>(@cora_insurance_addr);
        
        let i = 0;
        let len = vector::length(&policy_store.policies);
        
        while (i < len) {
            let policy = vector::borrow(&policy_store.policies, i);
            if (policy.id == policy_id) {
                return policy.active_status == POLICY_STATUS_ACTIVE
            };
            i = i + 1;
        };
        
        abort error::not_found(E_POLICY_DOES_NOT_EXIST)
    }

    #[test_only]
    public fun init_for_testing(admin: &signer) {
        init_module(admin);
    }
}