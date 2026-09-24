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

The Unit Readout presents equipment as right-hand and support slots backed by
an armament inventory. Restore the factory rack or equip individual compatible
weapons; the live equipment-load meter shows light, medium, or heavy burden and
the resulting movement value.

Precision rifles and direct-fire long guns support dedicated sniper optics.
Select a compatible weapon and hold **RMB** for FPS-style aim-down-sights, or
press **N** to latch the 6× sight until **N** is pressed again. **LMB** fires
through the centered optic. The suit braces and moves slowly while scoped,
mouse sensitivity drops, and the sight sways until stability builds. Hold
**Shift** while planted to steady the sight and hold the pilot's breath; the
breath meter drains, firing kicks the optic and costs stability, and releasing
RMB returns immediately to the previous camera unless the sight was latched.

Humanoid mobile suits can press **K** to kneel wherever they are, including
while airborne or operating in space. Lowering into the firing stance takes two
seconds, as does standing again; horizontal movement is locked through both
transitions and while kneeling, but gravity always remains active. The braced
posture reduces weapon spread and improves sniper stability. Allied and hostile
pilots use the same posture automatically when they have a ranged target in
their effective firing band, then stand to reposition or meet a close threat.

Destructible buildings—including city blocks, hangars, barracks, bunkers,
command posts, bases, and depots—have **20×** their former integrity. This does
not change the durability of walls, utility structures, vehicles, or ships.

## Anime render style

Every unit is drawn in a cel-animation look: hard two-tone shading with a crisp specular glint,
ink outlines on every armour part (line weight thins with distance), and bloom on beams,
thrusters and sensor eyes. Explosions are hard-edged fireballs that break into two-tone smoke,
with spark streaks, shock rings and star-cross muzzle flashes. **Main Menu → VISUAL STYLE**
switches between ANIME CEL and CLASSIC (the choice is remembered on this device).

## Weapon ballistics

- Kinetic rounds fall under local gravity (1 g on Earth and in colonies, lunar gravity on airless
  bodies, none in space) and lose speed to air drag. The fire-control computer raises the bore so
  rounds arc onto the crosshair; moving targets still need lead.
- Penetration depends on calibre and remaining velocity against the target's armour rating.
  Glancing hits count as thicker armour and can ricochet. Small guns barely scratch heavy suits;
  tank and heavy MG rounds bite.
- Mega-particle beams ignore armour penetration but diffuse with range — much faster in
  atmosphere than in space.
- Sustained fire and movement widen the dispersion cone (the ring around the crosshair); it
  settles when you stop, kneel or pause between bursts. One round in three is a tracer.

## Staged operations and bonus goals

New contract types appear on the campaign board and in **Custom Battle → OPERATION**:

- **RECON** — hold inside each survey ring until the scan completes, then reach extraction.
- **DEMOLITION** — stand still beside each target to set charges, then get 220 m clear before
  the fuse runs out.
- **PILOT RESCUE** — reach the downed pilot and hold the landing zone for 60 s; lose the pilot
  and the contract fails.
- **BREAKTHROUGH** — destroy three AA sites, hold the drop zone while an allied paradrop lands,
  then kill the sector commander.

Most campaign contracts also list up to two bonus goals (integrity, wingmen, time limit, enemy
aces). Each goal met adds 15–20% to the pay; results are shown on the debrief screen.

## Gravity Front original mobile suits

Four machines designed for this game: **GFR-24 Harrow** (Federation heavy support),
**GFR-31 Kestrel** (Federation marksman), **GFZ-17 Varg** (Zeon assault) and
**GFZ-22 Lamia** (Zeon raider). They are playable in Custom Battle, sold in Federation markets,
take part in armament modification, and the Zeon pair joins the enemy rosters mid-war.

## Campaign Challenge Runs and PvP equipment

The Campaign bridge includes **CHALLENGES**, a sequential set of solo surface
evaluations against 1, 5, 10, 20, 35, and finally 50 hostile units. Challenge
Runs never carry hangar wingmen, aircraft, teammates, or ship fire support.
Clears are saved as device-level PvP progression and permanently authorize the
listed hand equipment in the online PvP equipment screen. Stock armament stays
available even before a challenge is cleared.

Online PvP always deploys both pilots on the ground in **Clear-Sky City**. Each
pilot's equipped right-hand/support loadout is exchanged with the duel packet
and reproduced for the remote machine.

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
