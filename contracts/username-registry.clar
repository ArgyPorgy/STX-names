;; Username Registry Smart Contract
;; A decentralized username registration system on Stacks
;; Users can claim unique usernames by paying a registration fee

;; ========================================
;; Constants
;; ========================================

;; Contract owner (deployer)
(define-constant CONTRACT_OWNER tx-sender)

;; Error codes
(define-constant ERR_UNAUTHORIZED (err u100))
(define-constant ERR_USERNAME_TAKEN (err u101))
(define-constant ERR_USERNAME_TOO_SHORT (err u102))
(define-constant ERR_USERNAME_TOO_LONG (err u103))
(define-constant ERR_USERNAME_INVALID_CHARS (err u104))
(define-constant ERR_INSUFFICIENT_FUNDS (err u105))
(define-constant ERR_USERNAME_NOT_FOUND (err u106))
(define-constant ERR_NOT_OWNER (err u107))
(define-constant ERR_TRANSFER_FAILED (err u108))
(define-constant ERR_ALREADY_HAS_USERNAME (err u109))
(define-constant ERR_CANNOT_TRANSFER_TO_SELF (err u110))

;; Username constraints
(define-constant MIN_USERNAME_LENGTH u3)
(define-constant MAX_USERNAME_LENGTH u30)

;; ========================================
;; Data Variables
;; ========================================

;; Registration fee in microSTX (1 STX = 1,000,000 microSTX)
;; Default: 1 STX
(define-data-var registration-fee uint u1000000)

;; Total fees collected
(define-data-var total-fees-collected uint u0)

;; Total usernames registered
(define-data-var total-usernames uint u0)

;; ========================================
;; Data Maps
;; ========================================

;; Map username to owner address
(define-map usernames
    { username: (string-ascii 30) }
    { 
        owner: principal,
        registered-at: uint,
        updated-at: uint
    }
)

;; Map address to username (reverse lookup)
(define-map address-to-username
    { owner: principal }
    { username: (string-ascii 30) }
)

;; Map for username transfer approvals
(define-map transfer-approvals
    { username: (string-ascii 30) }
    { approved-for: principal }
)

;; ========================================
;; Private Functions
;; ========================================

;; Check if character is valid (lowercase a-z, 0-9, underscore, hyphen)
(define-private (is-valid-char (char (string-ascii 1)))
    (or
        ;; lowercase letters a-z
        (is-eq char "a") (is-eq char "b") (is-eq char "c") (is-eq char "d")
        (is-eq char "e") (is-eq char "f") (is-eq char "g") (is-eq char "h")
        (is-eq char "i") (is-eq char "j") (is-eq char "k") (is-eq char "l")
        (is-eq char "m") (is-eq char "n") (is-eq char "o") (is-eq char "p")
        (is-eq char "q") (is-eq char "r") (is-eq char "s") (is-eq char "t")
        (is-eq char "u") (is-eq char "v") (is-eq char "w") (is-eq char "x")
        (is-eq char "y") (is-eq char "z")
        ;; numbers 0-9
        (is-eq char "0") (is-eq char "1") (is-eq char "2") (is-eq char "3")
        (is-eq char "4") (is-eq char "5") (is-eq char "6") (is-eq char "7")
        (is-eq char "8") (is-eq char "9")
        ;; special characters
        (is-eq char "_") (is-eq char "-")
    )
)

;; Validate username format
(define-private (validate-username (username (string-ascii 30)))
    (let
        (
            (username-length (len username))
        )
        (if (< username-length MIN_USERNAME_LENGTH)
            ERR_USERNAME_TOO_SHORT
            (if (> username-length MAX_USERNAME_LENGTH)
                ERR_USERNAME_TOO_LONG
                (ok true)
            )
        )
    )
)

;; ========================================
;; Read-Only Functions
;; ========================================

;; Get username info by username
(define-read-only (get-username-info (username (string-ascii 30)))
    (map-get? usernames { username: username })
)

;; Get username owner
(define-read-only (get-username-owner (username (string-ascii 30)))
    (match (map-get? usernames { username: username })
        entry (some (get owner entry))
        none
    )
)

;; Get username by address
(define-read-only (get-address-username (owner principal))
    (match (map-get? address-to-username { owner: owner })
        entry (some (get username entry))
        none
    )
)

;; Check if username is available
(define-read-only (is-username-available (username (string-ascii 30)))
    (is-none (map-get? usernames { username: username }))
)

;; Get current registration fee
(define-read-only (get-registration-fee)
    (var-get registration-fee)
)

;; Get total fees collected
(define-read-only (get-total-fees-collected)
    (var-get total-fees-collected)
)

;; Get total usernames registered
(define-read-only (get-total-usernames)
    (var-get total-usernames)
)

;; Get contract owner
(define-read-only (get-contract-owner)
    CONTRACT_OWNER
)

;; Check if address has a username
(define-read-only (has-username (owner principal))
    (is-some (map-get? address-to-username { owner: owner }))
)

;; Get transfer approval for username
(define-read-only (get-transfer-approval (username (string-ascii 30)))
    (match (map-get? transfer-approvals { username: username })
        entry (some (get approved-for entry))
        none
    )
)

;; ========================================
;; Public Functions
;; ========================================

;; Register a new username
(define-public (register-username (username (string-ascii 30)))
    (let
        (
            (fee (var-get registration-fee))
            (caller tx-sender)
        )
        ;; Validate username format
        (try! (validate-username username))
        
        ;; Check if username is available
        (asserts! (is-username-available username) ERR_USERNAME_TAKEN)
        
        ;; Check if caller already has a username
        (asserts! (not (has-username caller)) ERR_ALREADY_HAS_USERNAME)
        
        ;; Transfer fee to contract owner
        (if (> fee u0)
            (try! (stx-transfer? fee caller CONTRACT_OWNER))
            true
        )
        
        ;; Register the username
        (map-set usernames
            { username: username }
            {
                owner: caller,
                registered-at: block-height,
                updated-at: block-height
            }
        )
        
        ;; Set reverse lookup
        (map-set address-to-username
            { owner: caller }
            { username: username }
        )
        
        ;; Update stats
        (var-set total-fees-collected (+ (var-get total-fees-collected) fee))
        (var-set total-usernames (+ (var-get total-usernames) u1))
        
        (ok username)
    )
)

;; Transfer username to another address
(define-public (transfer-username (username (string-ascii 30)) (new-owner principal))
    (let
        (
            (caller tx-sender)
            (username-data (unwrap! (map-get? usernames { username: username }) ERR_USERNAME_NOT_FOUND))
            (current-owner (get owner username-data))
        )
        ;; Check caller is the owner
        (asserts! (is-eq caller current-owner) ERR_NOT_OWNER)
        
        ;; Cannot transfer to self
        (asserts! (not (is-eq caller new-owner)) ERR_CANNOT_TRANSFER_TO_SELF)
        
        ;; Check new owner doesn't already have a username
        (asserts! (not (has-username new-owner)) ERR_ALREADY_HAS_USERNAME)
        
        ;; Update username ownership
        (map-set usernames
            { username: username }
            {
                owner: new-owner,
                registered-at: (get registered-at username-data),
                updated-at: block-height
            }
        )
        
        ;; Update reverse lookups
        (map-delete address-to-username { owner: caller })
        (map-set address-to-username
            { owner: new-owner }
            { username: username }
        )
        
        ;; Clear any transfer approval
        (map-delete transfer-approvals { username: username })
        
        (ok true)
    )
)

;; Approve another address to receive username transfer
(define-public (approve-transfer (username (string-ascii 30)) (approved-for principal))
    (let
        (
            (caller tx-sender)
            (username-data (unwrap! (map-get? usernames { username: username }) ERR_USERNAME_NOT_FOUND))
        )
        ;; Check caller is the owner
        (asserts! (is-eq caller (get owner username-data)) ERR_NOT_OWNER)
        
        ;; Set approval
        (map-set transfer-approvals
            { username: username }
            { approved-for: approved-for }
        )
        
        (ok true)
    )
)

;; Claim approved transfer
(define-public (claim-transfer (username (string-ascii 30)))
    (let
        (
            (caller tx-sender)
            (username-data (unwrap! (map-get? usernames { username: username }) ERR_USERNAME_NOT_FOUND))
            (approval (unwrap! (map-get? transfer-approvals { username: username }) ERR_UNAUTHORIZED))
            (current-owner (get owner username-data))
        )
        ;; Check caller is approved
        (asserts! (is-eq caller (get approved-for approval)) ERR_UNAUTHORIZED)
        
        ;; Check caller doesn't already have a username
        (asserts! (not (has-username caller)) ERR_ALREADY_HAS_USERNAME)
        
        ;; Update username ownership
        (map-set usernames
            { username: username }
            {
                owner: caller,
                registered-at: (get registered-at username-data),
                updated-at: block-height
            }
        )
        
        ;; Update reverse lookups
        (map-delete address-to-username { owner: current-owner })
        (map-set address-to-username
            { owner: caller }
            { username: username }
        )
        
        ;; Clear approval
        (map-delete transfer-approvals { username: username })
        
        (ok true)
    )
)

;; Release username (give up ownership)
(define-public (release-username (username (string-ascii 30)))
    (let
        (
            (caller tx-sender)
            (username-data (unwrap! (map-get? usernames { username: username }) ERR_USERNAME_NOT_FOUND))
        )
        ;; Check caller is the owner
        (asserts! (is-eq caller (get owner username-data)) ERR_NOT_OWNER)
        
        ;; Delete username
        (map-delete usernames { username: username })
        
        ;; Delete reverse lookup
        (map-delete address-to-username { owner: caller })
        
        ;; Clear any transfer approval
        (map-delete transfer-approvals { username: username })
        
        ;; Update stats
        (var-set total-usernames (- (var-get total-usernames) u1))
        
        (ok true)
    )
)

;; ========================================
;; Admin Functions
;; ========================================

;; Update registration fee (only contract owner)
(define-public (set-registration-fee (new-fee uint))
    (begin
        (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)
        (var-set registration-fee new-fee)
        (ok new-fee)
    )
)

