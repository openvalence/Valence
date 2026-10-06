---
title: Build with Valence
description: >-
  Connect a client, write an app integration, make your firmware a conforming hub, and test all of it locally.
---

# Build with Valence

These pages cover clients, plugins, hub firmware, the command-line tools and local testing.

| Page | Contents |
|---|---|
| [Quickstart](quickstart.md) | A connected client in about 20 lines |
| [JavaScript](clients/javascript.md) · [C#](clients/csharp.md) · [C++](clients/cpp.md) · [Python](clients/python.md) | A working client in your language |
| [Plugin guide](plugins.md) | An app integration, with a shipped plugin as the worked example |
| [Hub implementer guide](hub.md) | Your own firmware answering as a conforming hub |
| [CLI guide](cli.md) | The command-line tooling, including motion-versus-planner graphing |
| [Local testing](local-testing.md) | A simulator, a probe, the fuzz harnesses, and the regression patterns |

## Before you start

Read [How it works](../understand/how-it-works.md). A client keeps no
optimistic local state and renders what the hub reports.

Keep [the Dictionary](../reference/dictionary.md) open. It defines each term
used on this site.

## Shadow and echo

Your [shadow](../reference/dictionary.md#shadow) updates only from hub
frames, not from your own requests.

You send an [intent](../reference/dictionary.md#intent), the hub
[clamps](../reference/dictionary.md#clamp) it, and the
[echo](../reference/dictionary.md#echo) reports the applied value. Render the
echo value. On a moving machine, rendering the request instead of the echo is
a safety defect.
