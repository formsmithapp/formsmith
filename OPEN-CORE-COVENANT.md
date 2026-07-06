# The Formsmith Open-Core Covenant

Formsmith is an open-core project: an AGPL core, an MIT integration surface, commercially
licensed enterprise modules, and (eventually) a hosted service. That model has a trust
problem: projects have used contributor agreements and relicensing to pull the rug on
their communities. This covenant exists so you can hold us to the opposite, in public,
in writing, versioned in git.

## The six commitments

1. **The core stays AGPL, forever.** The open packages and apps (engine, blocks, rules,
   ai, renderer, schemas, db, adapters, ui, and the web/api apps) are licensed
   AGPL-3.0-only, and every future version of them will be too. We will never move the
   open core to a closed, source-available, "fair source," or delayed-open license.

2. **Features move one way: into the core.** A capability released in the open core is
   never relocated to the enterprise modules or the hosted tier. Enterprise features may
   graduate *into* the core; the reverse never happens.

3. **Self-hosting stays first-class and complete.** The self-host build is the same
   application we run for the hosted service, including the configuration flag that
   controls "Powered by Formsmith" branding. We will not degrade or cripple self-hosting
   to sell hosting.

4. **The MIT surface stays MIT.** The embed SDK, framework wrappers, and API client
   remain MIT-licensed so embedding Formsmith never raises copyleft questions for your
   codebase.

5. **About the CLA, honestly.** Our [CLA](CLA.md) grants the Project Owner broad rights
   over contributions, including commercial relicensing. That is deliberate: it is what
   legally funds the project through the enterprise modules and the hosted service. This
   covenant is the public constraint on that power: every contribution merged into an
   open package remains available under that package's open license, permanently.

6. **If Formsmith-the-business ever ends,** everything already published keeps its
   license. That is how AGPL and MIT work, and no one can take it back, including us.
   We additionally commit to leaving the public repositories up.

## Scope and succession

These commitments bind the current project owner and any successor or assign (such as a
legal entity later formed to own Formsmith). This document may be clarified over time,
but the six commitments themselves will not be weakened; the git history of this file is
the record.

Gnana Siva Sai V, founding maintainer · first published 2026-07-05
