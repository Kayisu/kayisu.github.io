# Mathworld V1: body, threats and the Boundary Academy

The Canvas campaign remains in `public/mathworld/`. V2 and its shared art/engine dependencies are unchanged. `combat-v1.js` owns persistent body state and advanced math; `game.js` connects it to the existing movement, weapons and art.

## Body rules

The core is 5. Hits append arithmetic scars; integrity counts unused scar capacity (8 initially, +2 for the durability perk). Large or negative values are valid and do not themselves kill. Scalar arithmetic uses reduced exact fractions. Self actions that restore an earlier exact value remove those scars, so alternative repair orders are valid as well as reverse order. Other self operations really change the body and can also be reversed.

R / BEDENİM switches to self targeting. An action takes 0.45 seconds in live combat, slows movement and leaves the player vulnerable. Repair costs one focus; one focus returns every six seconds, each collected core adds two, maximum six. Village self actions are free. Waves, regions and upgrades do not heal wounds. Retrying or returning from defeat restores encounter-entry body and collected-core count, not a pristine body.

A bound equation occupies two capacity slots and a denominator trap occupies one. Capacity exhaustion, no real solution to a constrained equation, and a zero denominator have separate failure messages. Domain conditions remain recorded after legal denominator cancellation.

## Advanced encounters

Solving the existing differential boss `y′ + 2y = 6` still preserves `C` in `y = 3 + Ce⁻²ˣ`. It opens the village's southwest Δ portal to the Boundary Academy. Its encounters teach Clutter, Unreal and Undefined separately, then Clutter + Unreal and Unreal + Undefined, then the Boundary Guardian. Title-screen practice entries provide the same Academy or boss without recording the previous campaign as completed.

| Role | Preparation | Threat | Counters |
| --- | --- | --- | --- |
| Clutter | Adds +3, then ×2; exact nested scars | Fills integrity slots | Inverse self action, valid enemy transformation, dash or range |
| Unreal | Binds `x² + 5x + 4 = 0` | Changes only the left constant by +4, removing real roots in the canonical form | Confirm −1 or −4 as root; change coefficients equivalently to withstand fixed +4; interrupt; evade |
| Undefined | Binds the body to denominator `d = 2` | Subtracts 2 from that specific denominator | Multiply by 2 or confirm safe `d = 2`; interrupt; evade |

Preparation normally takes 4–5 seconds; lethal preparation gets six seconds. Simultaneous attackers have ordered countdowns. The HUD simulates the currently announced operations in that order, including failed old targets. An announced attack stores its operation, amount and target ID; solving its original target makes it miss rather than secretly binding a replacement. A valid normal-enemy transformation explicitly interrupts preparation and starts a newly announced plan.

The enemy attack changes the equation maliciously; a player's add/subtract/multiply/divide applies to both sides and preserves roots. A polynomial expression with no real zero is not itself a death condition.

## First hybrid boss

Planning has no deadline. Each turn supplies two actions; attack and self repair share the budget. End Turn executes the announced enemy operation, followed by another unlimited planning turn. Three seals must be solved. The boss uses real polynomial coefficients rather than an expected-button sequence:

- Factor `(x+4)(x+1)`, then confirm either −1 or −4 with `=1` / `=4`.
- Differentiate twice, then seal the natural constant with `=`.
- Four arithmetic operations alter the polynomial; differentiation works on the resulting coefficients. Integration retains `C` until differentiation removes its constant contribution.

The visible `=k` convention selects `x = −k` in this first quadratic encounter; it is explicitly shown in the toolbar and hints. A heavy ×k action (k≥2) interrupts the boss's announced attack, costing an action. An optional 0.3-second Space / Kaçın window can parry during execution, but a complete victory is tested without parry. Self actions use the turn budget instead of live-combat focus.

This is a first balance pass with constrained operation sets, fixed introductory quadratic and denominator, two enemy pairs and one hybrid boss. Broader root selection, more coefficients, differential systems and deeper enemy search are follow-up content, not implied implemented features.

## Validation

```
node --experimental-vm-modules tests/mathworld-v1-combat.test.mjs
node --experimental-vm-modules tests/mathworld-v1-integration.test.mjs
node --experimental-vm-modules tests/mathworld-v1-art.test.mjs
node --experimental-vm-modules tests/mathworld-v2.test.mjs
```

The first two cover exact scar repair, distinct losses, preserved domains, locked intentions, real coefficients, persistence/checkpoints, role counters, both boss routes, two-action accounting, unlimited planning, pause and a no-parry victory. Integration uses a controlled DOM/Canvas stub; native Canvas rendering and the deployed browser are also checked separately. The existing Pages workflow type-checks Astro/TypeScript, builds and verifies generated routes before deployment.
