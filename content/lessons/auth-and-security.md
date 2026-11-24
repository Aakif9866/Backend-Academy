---
title: Auth and Security Essentials
summary: Authentication vs authorisation, password storage, sessions vs JWT, OAuth, MFA, authorisation models and the common attacks in plain English.
difficulty: beginner
minutes: 35
source: backend/06-auth-and-security.md
prerequisites: [http-deep-dive]
objectives:
  - Distinguish authentication from authorisation
  - Explain why passwords are hashed with slow, salted algorithms
  - Compare server sessions with JWTs, including revocation and storage trade-offs
  - Describe where authorisation must be enforced
videos:
  - id: UBUNrFtufWo
    title: Session vs Token Authentication in 100 Seconds
    channel: Fireship
    why: A fast visual of the two models compared in the "Sessions vs JWT" section.
  - id: 8ZtInClXe1Q
    title: How NOT to Store Passwords! - Computerphile
    channel: Computerphile
    why: Walks through plaintext, encryption, plain hashing and salted slow hashing, and why only the last is acceptable.
resources:
  - url: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
    title: OWASP Password Storage Cheat Sheet
    why: Current recommended algorithms and parameters (Argon2id, scrypt, bcrypt) from OWASP.
  - url: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
    title: OWASP Session Management Cheat Sheet
    why: Cookie flags, session ID entropy, rotation and expiry, all in one place.
  - url: https://owasp.org/Top10/
    title: OWASP Top 10
    why: The industry reference list of the most critical web application security risks.
quiz:
  - type: mcq
    q: "\"User 42 may edit invoice 7 only if they belong to invoice 7's organisation.\" This rule is…"
    options: ["Authentication", "Authorisation", "Encryption", "Hashing"]
    answer: 1
    explain: Authentication establishes who you are. Authorisation decides what that identity may do to which resource.
  - type: tf
    q: Encrypting passwords with AES and a key stored on the server is as good as hashing them with Argon2.
    answer: 1
    explain: False. Encryption is reversible, so anyone who steals the key gets every password. Password hashes are one-way, salted and deliberately slow, which makes offline guessing expensive.
  - type: scenario
    q: A user reports their laptop was stolen. You use stateless JWTs that expire in 7 days and have no server-side store. What's the problem?
    options: ["None; JWTs are encrypted", "You can't revoke the stolen token until it expires without adding a denylist or short expiry plus refresh tokens", "The JWT will stop working immediately", "JWTs can't be stolen"]
    answer: 1
    explain: Stateless tokens are valid until expiry. The usual design is short-lived access tokens (minutes) plus revocable refresh tokens kept server-side.
  - type: mcq
    q: Where must an authorisation check always happen?
    options: ["Only in the frontend, by hiding buttons", "On the server, for every request that touches a protected resource", "Only at login", "In the CDN"]
    answer: 1
    explain: Clients are fully controlled by the user, so hidden buttons are UX, not security. The server (or database RLS) must check every request.
---

## Hands-on exercise

In any language:

1. Hash the password `correct horse battery staple` with Argon2id (or bcrypt) twice and print both hashes. Explain why they differ (salt) and how verification still works.
2. Time a single hash. Then estimate how long an attacker would need to try 10 billion guesses at that speed on one core.
3. Decode any JWT (for example one from jwt.io's example) by hand with base64url. Confirm the payload is readable, not encrypted.

## Completion criteria

- You can explain hashing vs encryption vs encoding.
- You can choose between sessions and JWTs for a given app and describe revocation for each.
