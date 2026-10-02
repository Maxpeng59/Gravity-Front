export const COLUMBUS_LAUNCH_INTERVAL = 10;

export const COLUMBUS_LAUNCH_CHANCES = Object.freeze({
  gm: 0.10,
  saberfish: 0.30,
  saberfish5000: 0.25,
  gmii: 0.05,
});

// All four event rolls are taken before the GM loadout roll. This keeps the
// events independent: a single ten-second cycle can launch every unit type.
export function rollColumbusLaunches(random = Math.random){
  const rolls = {
    gm: random(),
    saberfish: random(),
    saberfish5000: random(),
    gmii: random(),
  };
  const launches = [];
  if (rolls.gm < COLUMBUS_LAUNCH_CHANCES.gm)
    launches.push(random() < 0.5 ? 'gm' : 'gmbazooka');
  if (rolls.saberfish < COLUMBUS_LAUNCH_CHANCES.saberfish) launches.push('saberfish');
  if (rolls.saberfish5000 < COLUMBUS_LAUNCH_CHANCES.saberfish5000) launches.push('saberfish5000');
  if (rolls.gmii < COLUMBUS_LAUNCH_CHANCES.gmii) launches.push('gmii');
  return launches;
}
