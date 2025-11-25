;; Quadratic Voting DAO with liquidity deposits
;; DAOs want fair voting that prevents whale dominance.

(impl-trait .trait-sip-010? (optional false)) ;; placeholder so the contract can be extended later

(define-constant ERR-INVALID-AMOUNT u100)
(define-constant ERR-PROPOSAL-NOT-FOUND u101)
(define-constant ERR-INSUFFICIENT-CREDITS u102)
(define-constant ERR-INSUFFICIENT-LIQUIDITY u103)

;; Total STX liquidity held by this contract
(define-data-var total-liquidity uint u0)

;; Per-user liquidity and available "credits" used for quadratic voting
(define-map user-liquidity
  { voter: principal }
  { deposited: uint, credits: uint })

;; Governance proposals that token holders can vote on
(define-data-var next-proposal-id uint u1)

(define-map proposals
  uint
  { description: (buff 200), total-votes: uint })

(define-map user-votes
  { voter: principal, proposal-id: uint }
  uint)

(define-read-only (get-contract-principal)
  (ok (contract-of 'quadratic-voting)))

(define-read-only (get-total-liquidity)
  (var-get total-liquidity))

(define-read-only (get-next-proposal-id)
  (var-get next-proposal-id))

(define-read-only (get-user (who principal))
  (default-to { deposited: u0, credits: u0 }
    (map-get? user-liquidity { voter: who })))

(define-read-only (get-proposal (id uint))
  (match (map-get? proposals id)
    proposal (ok proposal)
    (err ERR-PROPOSAL-NOT-FOUND)))

(define-read-only (get-user-votes (who principal) (id uint))
  (default-to u0 (map-get? user-votes { voter: who, proposal-id: id })))

;; Public functions

;; Deposit STX liquidity into the DAO. Each micro-STX becomes one voting credit.
;; Returns the caller's new credit balance.
(define-public (deposit-liquidity (amount uint))
  (begin
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (let ((transfer-result (stx-transfer? amount tx-sender (contract-of 'quadratic-voting))))
      (match transfer-result
        transfer-ok
          (let (
                (current (get-user tx-sender))
                (new-deposited (+ (get deposited current) amount))
                (new-credits (+ (get credits current) amount))
               )
            (map-set user-liquidity { voter: tx-sender }
              { deposited: new-deposited, credits: new-credits })
            (var-set total-liquidity (+ (var-get total-liquidity) amount))
            (ok new-credits))
        transfer-err (err transfer-err)))))

;; Withdraw previously deposited STX, burning the same amount of credits.
(define-public (withdraw-liquidity (amount uint))
  (begin
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (let ((current (get-user tx-sender)))
      (let (
            (current-deposited (get deposited current))
            (current-credits (get credits current))
           )
        (asserts! (>= current-deposited amount) (err ERR-INSUFFICIENT-LIQUIDITY))
        (asserts! (>= current-credits amount) (err ERR-INSUFFICIENT-CREDITS))
        (let (
              (new-deposited (- current-deposited amount))
              (new-credits (- current-credits amount))
             )
          (let ((transfer-result (stx-transfer? amount (contract-of 'quadratic-voting) tx-sender)))
            (match transfer-result
              transfer-ok
                (begin
                  (map-set user-liquidity { voter: tx-sender }
                    { deposited: new-deposited, credits: new-credits })
                  (var-set total-liquidity (- (var-get total-liquidity) amount))
                  (ok new-deposited))
              transfer-err (err transfer-err))))))))

;; Create a new proposal and return its id.
(define-public (create-proposal (description (buff 200)))
  (let ((id (var-get next-proposal-id)))
    (var-set next-proposal-id (+ id u1))
    (map-insert proposals id { description: description, total-votes: u0 })
    (ok id)))

;; Quadratic voting: the cost of casting `votes` is votes^2 credits.
;; This makes it increasingly expensive to accumulate many votes on a single proposal.
(define-public (vote (proposal-id uint) (votes uint))
  (begin
    (asserts! (> votes u0) (err ERR-INVALID-AMOUNT))
    (match (map-get? proposals proposal-id)
      proposal
        (let (
              (cost (* votes votes))
              (current (get-user tx-sender))
             )
          (let ((current-credits (get credits current)))
            (asserts! (>= current-credits cost) (err ERR-INSUFFICIENT-CREDITS))
            (let ((remaining-credits (- current-credits cost)))
              (map-set user-liquidity { voter: tx-sender }
                { deposited: (get deposited current), credits: remaining-credits })

              (let ((current-total (get total-votes proposal)))
                (map-set proposals proposal-id
                  { description: (get description proposal), total-votes: (+ current-total votes) }))

              (let ((previous-votes
                      (default-to u0
                        (map-get? user-votes { voter: tx-sender, proposal-id: proposal-id }))))
                (map-set user-votes { voter: tx-sender, proposal-id: proposal-id }
                  (+ previous-votes votes)))

              (ok { cost: cost, remaining-credits: remaining-credits }))))
      (err ERR-PROPOSAL-NOT-FOUND))))
