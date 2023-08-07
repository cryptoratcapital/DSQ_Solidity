# Strategies Audit Response

The protocol was audited by Paladin Blockchain Security on commit `xxx`. The repository has been migrated since then, and git history has been lost. The resolution process has been undertaken starting from commit `835b2f17b2afb6015011b1576174b373415bae18` of `theMLtrader/DSQ_Solidity` repo, which is believed to be identical to the audited commit.

## Global Issues

1. Governance should be under a multi-signature wallet with known or
   doxxed signatories

Acknowledged. The trust model of the DSquared project requires a reputable, trustworthy executor, and all reasonable efforts will be taken to ensure that `EXECUTOR_ROLE` holders are well-vetted and properly incentivized. Admin roles will be held by multisignature wallets.

2. Several tokens might get locked

Acknowledge the need to carefully validate that all reward tokens, LP tokens, etc. are correctly configured in the protocol.

3. Potential storage collision

TODO: Implement

Implemented the suggested change.

4. Architectural risk for missing approvals

Acknowledged. Post-deploy scripts will be developed.

5. Extra safeguards for NATIVE/NON-NATIVE functions

TODO: Review and decide

6. Implementations can be directly called

TODO: Implement.

Implementation (aka. "facet") contracts are intended for delegate call only. The protocol has elected not to add protections preventing users from calling the contracts directly for gas efficiency reasons. Language has been added to the natspec of each implementation warning users against direct interaction.

7. Lack of validation for `_facet`

TODO: Implement

Implemented the suggested change.

8. tx.origin usage by projects

Acknowledged.

## Base/VaultV1

9. Architectural risk: Potential miscalculation of shares —
   totalDeposit denomination

TODO: Review

10. Governance risk

Acknowledged. These risks are inherent in the architecture, and plain-language risk disclosure will be provided to users.

11. Malicious users can manipulate share calculation

TODO: Review, decide, implement

12. Malicious user can DoS deposits of other users

TODO

13. maxDeposits can be circumvented

TODO

14. Reliance on underlying validations

TODO

15. Frontend phishing risk

Acknowledged. A bespoke frontend monitoring tool has been developed to provide additional protection to the frontend.

16. Typographical issues

TODO

Implemented the recommended changes.

## Base/TraderV0
