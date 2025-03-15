module cora_insurance_addr::claim_processor {
    use std::signer;
    use std::error;
    use std::vector;
    use std::string::String;
    use aptos_framework::account;
    use aptos_framework::timestamp;
    use aptos_framework::event::{Self, EventHandle};
    use cora_insurance_addr::policy_registry;
    use cora_insurance_addr::premium_escrow;

    /// Error codes
    const E_NOT_AUTHORIZED: u64 = 1;
    const E_POLICY_NOT_FOUND: u64 = 2;
    const E_POLICY_NOT_ACTIVE: u64 = 3;
    const E_PREMIUM_NOT_PAID: u64 = 4;
    const E_CLAIM_ALREADY_EXISTS: u64 = 5;
    const E_CLAIM_NOT_FOUND: u64 = 6;
    const E_INVALID_CLAIM_STATUS: u64 = 7;
    const E_INSUFFICIENT_FUNDS: u64 = 8;
    const E_INVALID_BENEFICIARY: u64 = 9;

    /// Claim status enum
    const CLAIM_STATUS_PENDING: u8 = 0;
    const CLAIM_STATUS_VERIFIED: u8 = 1;
    const CLAIM_STATUS_REJECTED: u8 = 2;
    const CLAIM_STATUS_PAID: u8 = 3;

    /// Claim record
    struct ClaimRecord has key, store {
        id: u64,
        policy_id: u64,
        beneficiary_address: address,
        claim_amount: u64,
        claim_status: u8,
        verification_hash: vector<u8>,
        claim_reason: String,
        timestamp: u64,
    }

    /// Event emitted when a new claim is filed
    struct ClaimFiledEvent has drop, store {
        claim_id: u64,
        policy_id: u64,
        beneficiary_address: address,
        claim_amount: u64,
        claim_reason: String,
        timestamp: u64,
    }

    /// Event emitted when a claim status is updated
    struct ClaimStatusUpdatedEvent has drop, store {
        claim_id: u64,
        old_status: u8,
        new_status: u8,
        verification_hash: vector<u8>,
        timestamp: u64,
    }

    /// Event emitted when a claim is paid out
    struct ClaimPaidEvent has drop, store {
        claim_id: u64,
        policy_id: u64,
        beneficiary_address: address,
        amount: u64,
        timestamp: u64,
    }

    /// Resource to store claim data and events
    struct ClaimStore has key {
        claims: vector<ClaimRecord>,
        next_claim_id: u64,
        claim_filed_events: EventHandle<ClaimFiledEvent>,
        claim_status_updated_events: EventHandle<ClaimStatusUpdatedEvent>,
        claim_paid_events: EventHandle<ClaimPaidEvent>,
    }

    /// Initialize the module
    fun init_module(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        
        // Check if the caller is the module publisher
        assert!(admin_addr == @cora_insurance_addr, error::permission_denied(E_NOT_AUTHORIZED));
        
        // Create and move the ClaimStore resource to the admin account
        move_to(admin, ClaimStore {
            claims: vector::empty<ClaimRecord>(),
            next_claim_id: 0,
            claim_filed_events: account::new_event_handle<ClaimFiledEvent>(admin),
            claim_status_updated_events: account::new_event_handle<ClaimStatusUpdatedEvent>(admin),
            claim_paid_events: account::new_event_handle<ClaimPaidEvent>(admin),
        });
    }

    /// File a new claim
    public entry fun file_claim(
        claimant: &signer,
        policy_id: u64,
        beneficiary_address: address,
        claim_amount: u64,
        claim_reason: String,
    ) acquires ClaimStore {
        let claimant_addr = signer::address_of(claimant);
        
        // Verify that the policy exists and is active
        assert!(policy_registry::policy_exists(policy_id), error::not_found(E_POLICY_NOT_FOUND));
        assert!(policy_registry::is_policy_active(policy_id), error::invalid_state(E_POLICY_NOT_ACTIVE));
        
        // Verify that premium has been paid
        assert!(premium_escrow::is_premium_paid(policy_id), error::invalid_state(E_PREMIUM_NOT_PAID));
        
        // Get policy details to verify claimant is policyholder
        let (policyholder_address, coverage_amount, _, _, _, _, _) = policy_registry::get_policy(policy_id);
        assert!(claimant_addr == policyholder_address, error::permission_denied(E_NOT_AUTHORIZED));
        
        // Ensure claim amount doesn't exceed coverage
        assert!(claim_amount <= coverage_amount, error::invalid_argument(E_INVALID_CLAIM_STATUS));
        
        // Check if a claim already exists for this policy
        let claim_store = borrow_global_mut<ClaimStore>(@cora_insurance_addr);
        let i = 0;
        let len = vector::length(&claim_store.claims);
        
        while (i < len) {
            let claim = vector::borrow(&claim_store.claims, i);
            if (claim.policy_id == policy_id) {
                abort error::already_exists(E_CLAIM_ALREADY_EXISTS)
            };
            i = i + 1;
        };
        
        // Create the claim record
        let claim_id = claim_store.next_claim_id;
        let current_time = timestamp::now_seconds();
        
        let claim = ClaimRecord {
            id: claim_id,
            policy_id,
            beneficiary_address,
            claim_amount,
            claim_status: CLAIM_STATUS_PENDING,
            verification_hash: vector::empty<u8>(), // Will be set during verification
            claim_reason,
            timestamp: current_time,
        };
        
        // Add the claim to the store
        vector::push_back(&mut claim_store.claims, claim);
        
        // Increment the next claim ID
        claim_store.next_claim_id = claim_id + 1;
        
        // Emit claim filed event
        event::emit_event(&mut claim_store.claim_filed_events, ClaimFiledEvent {
            claim_id,
            policy_id,
            beneficiary_address,
            claim_amount,
            claim_reason,
            timestamp: current_time,
        });
    }

    /// Update claim status (admin/verifier only)
    public entry fun update_claim_status(
        admin: &signer,
        claim_id: u64,
        new_status: u8,
        verification_hash: vector<u8>,
    ) acquires ClaimStore {
        let admin_addr = signer::address_of(admin);
        
        // Check if the caller is authorized
        assert!(admin_addr == @cora_insurance_addr, error::permission_denied(E_NOT_AUTHORIZED));
        
        // Validate new status
        assert!(
            new_status == CLAIM_STATUS_VERIFIED || 
            new_status == CLAIM_STATUS_REJECTED || 
            new_status == CLAIM_STATUS_PAID,
            error::invalid_argument(E_INVALID_CLAIM_STATUS)
        );
        
        let claim_store = borrow_global_mut<ClaimStore>(@cora_insurance_addr);
        
        // Find the claim by ID
        let i = 0;
        let len = vector::length(&claim_store.claims);
        let claim_found = false;
        let old_status = 0;
        
        while (i < len) {
            let claim = vector::borrow_mut(&mut claim_store.claims, i);
            if (claim.id == claim_id) {
                old_status = claim.claim_status;
                
                // Validate status transition
                if (old_status == CLAIM_STATUS_PENDING) {
                    assert!(
                        new_status == CLAIM_STATUS_VERIFIED || new_status == CLAIM_STATUS_REJECTED,
                        error::invalid_argument(E_INVALID_CLAIM_STATUS)
                    );
                } else if (old_status == CLAIM_STATUS_VERIFIED) {
                    assert!(
                        new_status == CLAIM_STATUS_PAID,
                        error::invalid_argument(E_INVALID_CLAIM_STATUS)
                    );
                } else if (old_status == CLAIM_STATUS_REJECTED || old_status == CLAIM_STATUS_PAID) {
                    abort error::invalid_state(E_INVALID_CLAIM_STATUS)
                };
                
                claim.claim_status = new_status;
                claim.verification_hash = verification_hash;
                claim_found = true;
                break
            };
            i = i + 1;
        };
        
        assert!(claim_found, error::not_found(E_CLAIM_NOT_FOUND));
        
        // Emit claim status updated event
        event::emit_event(&mut claim_store.claim_status_updated_events, ClaimStatusUpdatedEvent {
            claim_id,
            old_status,
            new_status,
            verification_hash,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Process claim payment (admin only)
    public entry fun process_claim_payment(
        admin: &signer,
        claim_id: u64,
    ) acquires ClaimStore {
        let admin_addr = signer::address_of(admin);
        
        // Check if the caller is authorized
        assert!(admin_addr == @cora_insurance_addr, error::permission_denied(E_NOT_AUTHORIZED));
        
        let claim_store = borrow_global_mut<ClaimStore>(@cora_insurance_addr);
        
        // Find the claim by ID
        let i = 0;
        let len = vector::length(&claim_store.claims);
        let claim_found = false;
        let beneficiary_address: address = @0x0;
        let claim_amount: u64 = 0;
        let policy_id: u64 = 0;
        
        while (i < len) {
            let claim = vector::borrow_mut(&mut claim_store.claims, i);
            if (claim.id == claim_id) {
                // Verify claim is in VERIFIED status
                assert!(claim.claim_status == CLAIM_STATUS_VERIFIED, error::invalid_state(E_INVALID_CLAIM_STATUS));
                
                beneficiary_address = claim.beneficiary_address;
                claim_amount = claim.claim_amount;
                policy_id = claim.policy_id;
                
                // Update claim status to PAID
                claim.claim_status = CLAIM_STATUS_PAID;
                claim_found = true;
                break
            };
            i = i + 1;
        };
        
        assert!(claim_found, error::not_found(E_CLAIM_NOT_FOUND));
        
        // Check if escrow has sufficient funds
        let escrow_balance = premium_escrow::get_escrow_balance();
        assert!(escrow_balance >= claim_amount, error::resource_exhausted(E_INSUFFICIENT_FUNDS));
        
        // Withdraw funds from escrow and pay to beneficiary
        premium_escrow::withdraw_funds(admin, claim_amount, beneficiary_address);
        
        // Emit claim paid event
        event::emit_event(&mut claim_store.claim_paid_events, ClaimPaidEvent {
            claim_id,
            policy_id,
            beneficiary_address,
            amount: claim_amount,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Get claim details
    public fun get_claim(claim_id: u64): (u64, address, u64, u8, vector<u8>, String, u64) acquires ClaimStore {
        let claim_store = borrow_global<ClaimStore>(@cora_insurance_addr);
        
        let i = 0;
        let len = vector::length(&claim_store.claims);
        
        while (i < len) {
            let claim = vector::borrow(&claim_store.claims, i);
            if (claim.id == claim_id) {
                return (
                    claim.policy_id,
                    claim.beneficiary_address,
                    claim.claim_amount,
                    claim.claim_status,
                    *&claim.verification_hash,
                    *&claim.claim_reason,
                    claim.timestamp
                )
            };
            i = i + 1;
        };
        
        abort error::not_found(E_CLAIM_NOT_FOUND)
    }

    /// Check if a claim exists for a policy
    public fun claim_exists_for_policy(policy_id: u64): bool acquires ClaimStore {
        let claim_store = borrow_global<ClaimStore>(@cora_insurance_addr);
        
        let i = 0;
        let len = vector::length(&claim_store.claims);
        
        while (i < len) {
            let claim = vector::borrow(&claim_store.claims, i);
            if (claim.policy_id == policy_id) {
                return true
            };
            i = i + 1;
        };
        
        false
    }

    #[test_only]
    public fun init_for_testing(admin: &signer) {
        init_module(admin);
    }
} 