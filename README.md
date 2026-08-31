# Gravity Front

A browser-based Universal Century mobile-suit combat game.

**Play the public build:** <https://gravity-front.jimpeng.chatgpt.site/>

> **Unofficial fan project.** Gravity Front is not affiliated with or endorsed by
> Bandai Namco, Sunrise, or the owners of the Gundam trademarks and designs.

## Armament modification

Compatible mobile suits can exchange their hand-carried primary and support
weapons for Universal Century alternatives. The editor is available in both:

- **Custom Battle → Unit Readout → Armament Control**
- **Campaign → Hangar**, inside each owned unit readout

Weapon mass changes the suit's walking, boost, hover, sand-kick, and space
movement speed. Fixed equipment such as head vulcans, built-in cannons, and arm
weapons stays attached. Campaign configurations are saved per mobile suit and
are also used when that suit deploys as a wingman.

## Start a PvP duel

1. Both players open the same deployed game and choose **PVP DUEL — ONLINE**.
2. The host creates an invite and sends the generated code to the joining player.
3. The joining player pastes the invite, creates an answer, and sends that answer back.
4. The host pastes the answer, applies it, and launches once both pilots are connected.

Both players should refresh the game before connecting so they are running the
same published combat version.

The duel uses a direct WebRTC data channel. The website hosts the game files; it
is not the multiplayer server. The included public STUN configuration works for
many home networks, but some restrictive or symmetric-NAT networks require a
TURN relay. A TURN service can be added later without changing the combat
protocol.

PvP is intended for friendly matches. It is peer-to-peer and has no authoritative
server or ranked anti-cheat; a modified client cannot be made fully trustworthy
without moving combat authority to a dedicated server.

## Local development

```sh
npm install
python3 serve.py
```

Then open <http://localhost:8124>.

Run the automated checks and production build with:

```sh
npm test
npm run build
```
