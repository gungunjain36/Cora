module cora_insurance_addr::premium_escrow {
    use std::signer;
    use std::error;
    use std::vector;
    use aptos_framework::coin::{Self, Coin};
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::account;
    use aptos_framework::timestamp;
    use aptos_framework::event::{Self, EventHandle};
    use cora_insurance_addr::policy_registry;

    /// Error codes
    const E_NOT_AUTHORIZED: u64 = 1;
    const E_INSUFFICIENT_FUNDS: u64 = 2;
    const E_POLICY_NOT_FOUND: u64 = 3;
    const E_PAYMENT_ALREADY_MADE: u64 = 4;
    const E_INVALID_PAYMENT_AMOUNT: u64 = 5;

    /// Payment status enum
    const PAYMENT_STATUS_PENDING: u8 = 0;
    const PAYMENT_STATUS_COMPLETED: u8 = 1;
    const PAYMENT_STATUS_REFUNDED: u8 = 2;

    /// Premium payment record
    struct PremiumPayment has key, store {
        policy_id: u64,
        amount: u64,
        timestamp: u64,
        payment_status: u8,
    }

    /// Event emitted when a premium payment is made
    struct PremiumPaymentEvent has drop, store {
        policy_id: u64,
        payer_address: address,
        amount: u64,
        timestamp: u64,
    }

    /// Event emitted when funds are withdrawn from escrow
    struct EscrowWithdrawalEvent has drop, store {
        amount: u64,
        recipient_address: address,
        timestamp: u64,
    }

    /// Resource to store escrow data and events
    struct EscrowStore has key {
        funds: Coin<AptosCoin>,
        payments: vector<PremiumPayment>,
        premium_payment_events: EventHandle<PremiumPaymentEvent>,
        escrow_withdrawal_events: EventHandle<EscrowWithdrawalEvent>,
    }

    /// Initialize the module
    fun init_module(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        
        // Check if the caller is the module publisher
        assert!(admin_addr == @cora_insurance_addr, error::permission_denied(E_NOT_AUTHORIZED));
        
        // Create and move the EscrowStore resource to the admin account
        move_to(admin, EscrowStore {
            funds: coin::zero<AptosCoin>(),
            payments: vector::empty<PremiumPayment>(),
            premium_payment_events: account::new_event_handle<PremiumPaymentEvent>(admin),
            escrow_withdrawal_events: account::new_event_handle<EscrowWithdrawalEvent>(admin),
        });
    }

    /// Pay premium for a policy
    public entry fun pay_premium(
        payer: &signer,
        policy_id: u64,
        amount: u64,
    ) acquires EscrowStore {
        let payer_addr = signer::address_of(payer);
        
        // Verify that the policy exists and is active
        assert!(policy_registry::policy_exists(policy_id), error::not_found(E_POLICY_NOT_FOUND));
        assert!(policy_registry::is_policy_active(policy_id), error::invalid_state(E_POLICY_NOT_FOUND));
        
        // Get policy details to verify payment amount
        let (_, _, premium_amount, _, _, _, _) = policy_registry::get_policy(policy_id);
        assert!(amount == premium_amount, error::invalid_argument(E_INVALID_PAYMENT_AMOUNT));
        
        // Check if payment has already been made for this policy
        let escrow_store = borrow_global_mut<EscrowStore>(@cora_insurance_addr);
        let i = 0;
        let len = vector::length(&escrow_store.payments);
        
        while (i < len) {
            let payment = vector::borrow(&escrow_store.payments, i);
            if (payment.policy_id == policy_id && payment.payment_status == PAYMENT_STATUS_COMPLETED) {
                abort error::already_exists(E_PAYMENT_ALREADY_MADE)
            };
            i = i + 1;
        };
        
        // Transfer funds from payer to escrow
        let payment_coins = coin::withdraw<AptosCoin>(payer, amount);
        coin::merge(&mut escrow_store.funds, payment_coins);
        
        // Record the payment
        let current_time = timestamp::now_seconds();
        let payment = PremiumPayment {
            policy_id,
            amount,
            timestamp: current_time,
            payment_status: PAYMENT_STATUS_COMPLETED,
        };
        
        vector::push_back(&mut escrow_store.payments, payment);
        
        // Emit payment event
        event::emit_event(&mut escrow_store.premium_payment_events, PremiumPaymentEvent {
            policy_id,
            payer_address: payer_addr,
            amount,
            timestamp: current_time,
        });
    }

    /// Withdraw funds from escrow (admin only)
    public entry fun withdraw_funds(
        admin: &signer,
        amount: u64,
        recipient_address: address,
    ) acquires EscrowStore {
        let admin_addr = signer::address_of(admin);
        
        // Check if the caller is authorized
        assert!(admin_addr == @cora_insurance_addr, error::permission_denied(E_NOT_AUTHORIZED));
        
        let escrow_store = borrow_global_mut<EscrowStore>(@cora_insurance_addr);
        
        // Check if there are sufficient funds in escrow
        assert!(coin::value(&escrow_store.funds) >= amount, error::invalid_argument(E_INSUFFICIENT_FUNDS));
        
        // Extract coins from escrow
        let withdrawal_coins = coin::extract(&mut escrow_store.funds, amount);
        
        // Deposit to recipient
        // In production, ensure account exists before depositing
        coin::deposit(recipient_address, withdrawal_coins);
        
        // Emit withdrawal event
        event::emit_event(&mut escrow_store.escrow_withdrawal_events, EscrowWithdrawalEvent {
            amount,
            recipient_address,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Get escrow balance
    public fun get_escrow_balance(): u64 acquires EscrowStore {
        let escrow_store = borrow_global<EscrowStore>(@cora_insurance_addr);
        coin::value(&escrow_store.funds)
    }

    /// Check if premium has been paid for a policy
    public fun is_premium_paid(policy_id: u64): bool acquires EscrowStore {
        let escrow_store = borrow_global<EscrowStore>(@cora_insurance_addr);
        
        let i = 0;
        let len = vector::length(&escrow_store.payments);
        
        while (i < len) {
            let payment = vector::borrow(&escrow_store.payments, i);
            if (payment.policy_id == policy_id && payment.payment_status == PAYMENT_STATUS_COMPLETED) {
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