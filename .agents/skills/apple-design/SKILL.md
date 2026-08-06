---
name: apple-design
description: Apple's approach to interface design, fluid physical motion, response latency, spring physics, and typography.
---

# Apple Design

An interface is fluid when it behaves like the physical world: things respond instantly, move continuously, carry momentum, resist at boundaries, and can be redirected mid-motion.

## Core Principles

1. **Kill Latency**: Respond on pointer-down / press, not on release. Highlight a button the instant it is pressed (`active:scale-[0.94]`).
2. **Interruptibility**: Never lock out input during a transition.
3. **Behavior over Animation**: Use spring physics (`damping: 1.0`, response ~0.3s-0.4s).
4. **Spatial Consistency**: Enter and exit along the same path. Popovers scale from their trigger origin.
