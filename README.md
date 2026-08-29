# Gravity Front

A browser-based Universal Century mobile-suit combat game.

> **Unofficial fan project.** Gravity Front is not affiliated with or endorsed by
> Bandai Namco, Sunrise, or the owners of the Gundam trademarks and designs.

## Play through GitHub Pages

1. Push this folder to a GitHub repository.
2. Open the repository's **Settings → Pages**.
3. Choose **Deploy from a branch**, select the branch containing the game, and publish from `/ (root)`.
4. Open the HTTPS GitHub Pages URL after the deployment finishes.

The game is entirely static, so it does not need a build step.

## Start a PvP duel

1. Both players open the same deployed game and choose **PVP DUEL — ONLINE**.
2. The host creates an invite and sends the generated code to the joining player.
3. The joining player pastes the invite, creates an answer, and sends that answer back.
4. The host pastes the answer, applies it, and launches once both pilots are connected.

Both players should refresh the game before connecting so they are running the
same published combat version.

The duel uses a direct WebRTC data channel. GitHub Pages hosts the game files; it is not the multiplayer server. The included public STUN configuration works for many home networks, but some restrictive or symmetric-NAT networks require a TURN relay. A TURN service can be added later without changing the combat protocol.

PvP is intended for friendly matches. It is peer-to-peer and has no authoritative
server or ranked anti-cheat; a modified client cannot be made fully trustworthy
without moving combat authority to a dedicated server.

## Local development

```sh
python3 serve.py
```

Then open <http://localhost:8124>.
