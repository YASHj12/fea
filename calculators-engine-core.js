// FORM / FEA calculators — solvers for thermodynamics, fluids, CFD, piping,
// heat exchangers, mechanical elements and FORM FEA tools. Inputs arrive in each
// field's declared base unit (see calculators-utils.js presets).
(function (root) {
  'use strict';
  const M = root.CalcMath;
  const { finite, positive, nonNegative, result: R, outcome, frictionFactor, flowRegime, parseList } = M;
  const S = (id, fn) => { root.CALC_SOLVERS[id] = fn; };

  S('ideal-gas-law', v => {
    positive(v.gasConstant, 'Gas constant R');
    const P = v.pressure * 1000; // kPa → Pa
    let results;
    if (v.solveFor === 'pressure') {
      positive(v.volume, 'Volume'); nonNegative(v.amount, 'Amount'); positive(v.temperature, 'Absolute temperature');
      const p = v.amount * v.gasConstant * v.temperature / v.volume;
      results = [R('Absolute pressure', p, 'Pa'), R('Absolute pressure', p / 1000, 'kPa'), R('Absolute pressure', p / 1e5, 'bar')];
    } else if (v.solveFor === 'volume') {
      positive(P, 'Pressure'); positive(v.temperature, 'Absolute temperature');
      const vol = v.amount * v.gasConstant * v.temperature / P;
      results = [R('Volume', vol, 'm³'), R('Volume', vol * 1000, 'L')];
    } else if (v.solveFor === 'amount') {
      positive(P, 'Pressure'); positive(v.volume, 'Volume'); positive(v.temperature, 'Absolute temperature');
      results = [R('Amount of gas', P * v.volume / (v.gasConstant * v.temperature), 'mol')];
    } else {
      positive(P, 'Pressure'); positive(v.volume, 'Volume'); positive(v.amount, 'Amount');
      const T = P * v.volume / (v.amount * v.gasConstant);
      results = [R('Absolute temperature', T, 'K'), R('Temperature', T - 273.15, '°C')];
    }
    const out = outcome(results);
    out.steps = ['Use absolute pressure in pascals and temperature in kelvin in PV = nRT.'];
    return out;
  });

  S('Reynolds-number', v => {
    positive(v.velocity, 'Velocity'); positive(v.length, 'Characteristic length');
    let nu;
    if (v.viscosityMode === 'dynamic') { positive(v.density, 'Density'); positive(v.dynViscosity, 'Dynamic viscosity'); nu = v.dynViscosity / v.density; }
    else { positive(v.kinViscosity, 'Kinematic viscosity'); nu = v.kinViscosity; }
    const Re = v.velocity * v.length / nu;
    const out = outcome([R('Reynolds number', Re, '—'), R('Kinematic viscosity used', nu, 'm²/s'), R('Regime indication', flowRegime(Re), '')]);
    out.warnings = ['Regime labels use common internal-flow thresholds; external-flow transition can differ substantially.'];
    return out;
  });

  S('Nusselt-number', v => {
    let results;
    if (v.solveFor === 'Nusselt') {
      positive(v.h, 'h'); positive(v.length, 'L'); positive(v.k, 'k');
      results = [R('Nusselt number', v.h * v.length / v.k, '—')];
    } else if (v.solveFor === 'coefficient') {
      positive(v.Nusselt, 'Nu'); positive(v.length, 'L'); positive(v.k, 'k');
      results = [R('Convective coefficient h', v.Nusselt * v.k / v.length, 'W/(m²·K)')];
    } else if (v.solveFor === 'length') {
      positive(v.Nusselt, 'Nu'); positive(v.h, 'h'); positive(v.k, 'k');
      results = [R('Characteristic length L', v.Nusselt * v.k / v.h, 'm')];
    } else {
      positive(v.Nusselt, 'Nu'); positive(v.h, 'h'); positive(v.length, 'L');
      results = [R('Fluid conductivity k', v.h * v.length / v.Nusselt, 'W/(m·K)')];
    }
    return outcome(results);
  });

  S('turbulent-boundary-initial-conditions', v => {
    positive(v.velocity, 'Velocity'); nonNegative(v.intensity, 'Turbulence intensity');
    positive(v.lengthScale, 'Length scale'); positive(v.kinViscosity, 'Kinematic viscosity'); positive(v.cmu, 'Cμ');
    const I = v.intensity / 100;
    const k = 1.5 * Math.pow(v.velocity * I, 2);
    const epsilon = k === 0 ? 0 : Math.pow(v.cmu, 0.75) * Math.pow(k, 1.5) / v.lengthScale;
    const omega = k === 0 ? 0 : epsilon / (v.cmu * k);
    const nut = epsilon === 0 ? 0 : v.cmu * k * k / epsilon;
    const out = outcome([
      R('Turbulent kinetic energy k', k, 'm²/s²'), R('Dissipation rate ε', epsilon, 'm²/s³'),
      R('Specific dissipation ω', omega, '1/s'), R('Turbulent viscosity νt', nut, 'm²/s'),
      R('Turbulent/laminar viscosity ratio', nut / v.kinViscosity, '—')]);
    out.steps = ['Intensity is converted from percent to a fraction before applying k = 3⁄2(UI)².'];
    if (k === 0) out.warnings.push('Zero intensity gives zero k, ε and ω; most CFD inlets need a small non-zero turbulence level.');
    return out;
  });

  S('Courant-number', v => {
    let results;
    if (v.solveFor === 'courant') {
      positive(v.velocity, 'Velocity'); positive(v.timeStep, 'Time step'); positive(v.cellSize, 'Cell size');
      results = [R('Courant number Co', v.velocity * v.timeStep / v.cellSize, '—')];
    } else if (v.solveFor === 'timeStep') {
      positive(v.courant, 'Co'); positive(v.velocity, 'Velocity'); positive(v.cellSize, 'Cell size');
      results = [R('Time step Δt', v.courant * v.cellSize / v.velocity, 's')];
    } else if (v.solveFor === 'cellSize') {
      positive(v.courant, 'Co'); positive(v.velocity, 'Velocity'); positive(v.timeStep, 'Time step');
      results = [R('Cell length Δx', v.velocity * v.timeStep / v.courant, 'm')];
    } else {
      positive(v.courant, 'Co'); positive(v.timeStep, 'Time step'); positive(v.cellSize, 'Cell size');
      results = [R('Characteristic velocity U', v.courant * v.cellSize / v.timeStep, 'm/s')];
    }
    const out = outcome(results);
    out.warnings = ['This is the simple one-dimensional form. Production CFD may limit the step by the maximum directional Courant number, rotation, acoustics or source terms.'];
    return out;
  });

  S('rotating-blade-time-step', v => {
    positive(v.rpm, 'Rotational speed'); positive(v.angleStep, 'Angular increment'); positive(v.blades, 'Blade count');
    const omega = 2 * Math.PI * v.rpm / 60;
    const dt = (v.angleStep * Math.PI / 180) / omega;
    const revTime = 60 / v.rpm;
    const bpf = v.blades * v.rpm / 60;
    return outcome([
      R('Angular speed ω', omega, 'rad/s'), R('Time step Δt', dt, 's'),
      R('Steps per revolution', revTime / dt, 'steps/rev'), R('Blade-pass frequency', bpf, 'Hz'),
      R('Steps per blade-pass period', (1 / bpf) / dt, 'steps')]);
  });

  S('wall-distance-y-plus', v => {
    positive(v.kinViscosity, 'Kinematic viscosity');
    let utau = v.frictionVelocity;
    if (v.frictionMode === 'wallShear') {
      positive(v.wallShear, 'Wall shear'); positive(v.density, 'Density');
      utau = Math.sqrt(v.wallShear / v.density);
    }
    positive(utau, 'Friction velocity');
    let results;
    if (v.solveFor === 'distance') {
      positive(v.yPlus, 'Target y+');
      const y = v.yPlus * v.kinViscosity / utau;
      results = [R('Estimated wall distance y', y, 'm'), R('Estimated wall distance y', y * 1000, 'mm'), R('Friction velocity uτ', utau, 'm/s')];
    } else {
      positive(v.distance, 'Wall distance');
      results = [R('Resulting y+', utau * v.distance / v.kinViscosity, '—'), R('Friction velocity uτ', utau, 'm/s')];
    }
    const out = outcome(results);
    out.warnings = ['Confirm whether your mesher expects first-cell centre distance or full first-layer height; conventions differ.'];
    return out;
  });

  S('piping-pressure-drop', v => {
    positive(v.flow, 'Flow'); positive(v.diameter, 'Diameter'); nonNegative(v.length, 'Length');
    positive(v.density, 'Density'); positive(v.viscosity, 'Viscosity'); nonNegative(v.roughness, 'Roughness'); nonNegative(v.lossCoefficient, 'ΣK');
    const area = Math.PI * v.diameter ** 2 / 4;
    const vel = v.flow / area;
    const Re = v.density * vel * v.diameter / v.viscosity;
    const f = frictionFactor(Re, (v.roughness / 1000) / v.diameter);
    const dyn = v.density * vel * vel / 2;
    const friction = f * (v.length / v.diameter) * dyn;
    const minor = v.lossCoefficient * dyn;
    const elevation = v.density * 9.80665 * v.elevationRise;
    const out = outcome([
      R('Velocity', vel, 'm/s'), R('Reynolds number', Re, '—'), R('Darcy friction factor', f, '—'),
      R('Friction pressure drop', friction / 1000, 'kPa'), R('Fitting/minor loss', minor / 1000, 'kPa'),
      R('Elevation pressure change', elevation / 1000, 'kPa'), R('Total pressure requirement', (friction + minor + elevation) / 1000, 'kPa') ]);
    out.steps = [`Flow regime guide: ${flowRegime(Re)}. Haaland friction is used in turbulent/transitional estimates.`];
    return out;
  });

  S('valve-pressure-drop', v => {
    positive(v.coefficient, 'Valve coefficient'); positive(v.specificGravity, 'Specific gravity');
    const Kv = v.coefficientType === 'Kv' ? v.coefficient : v.coefficient / 1.156;
    const Cv = Kv * 1.156;
    let results;
    if (v.solveFor === 'pressureDrop') {
      positive(v.flow, 'Flow');
      const dpBar = v.specificGravity * Math.pow(v.flow / Kv, 2);
      results = [R('Valve pressure drop', dpBar * 100, 'kPa'), R('Valve pressure drop', dpBar, 'bar'), R('Equivalent Kv', Kv, 'm³/h at 1 bar'), R('Equivalent Cv', Cv, 'US gpm at 1 psi')];
    } else {
      positive(v.pressureDrop, 'Pressure drop');
      const dpBar = v.pressureDrop / 100; // canonical input is kPa
      const Q = Kv * Math.sqrt(dpBar / v.specificGravity);
      results = [R('Flow rate', Q, 'm³/h'), R('Flow rate', Q / 3.6, 'L/s'), R('Equivalent Kv', Kv, 'm³/h at 1 bar'), R('Equivalent Cv', Cv, 'US gpm at 1 psi')];
    }
    const out = outcome(results);
    out.warnings = ['Liquid, non-choked screening relation only. The manufacturer’s full sizing method governs cavitation, flashing and compressible service.'];
    return out;
  });

  S('total-head', v => {
    finite(v.elevationRise, 'Elevation rise'); finite(v.pressureRise, 'Pressure rise');
    nonNegative(v.velocity1, 'Velocity 1'); nonNegative(v.velocity2, 'Velocity 2');
    nonNegative(v.lossHead, 'Loss head'); positive(v.density, 'Density'); positive(v.gravity, 'Gravity');
    const pressureHead = (v.pressureRise * 1000) / (v.density * v.gravity);
    const velocityHead = (v.velocity2 ** 2 - v.velocity1 ** 2) / (2 * v.gravity);
    const total = v.elevationRise + pressureHead + velocityHead + v.lossHead;
    return outcome([
      R('Elevation head', v.elevationRise, 'm'), R('Pressure head change', pressureHead, 'm'),
      R('Velocity-head change', velocityHead, 'm'), R('Loss head', v.lossHead, 'm'),
      R('Total required head', total, 'm'), R('Equivalent pressure', total * v.density * v.gravity / 1000, 'kPa')]);
  });

  S('heat-exchanger-sizing', v => {
    positive(v.overallU, 'Overall U'); positive(v.correctionF, 'Correction factor F');
    const d1 = v.arrangement === 'counterflow' ? v.hotIn - v.coldOut : v.hotIn - v.coldIn;
    const d2 = v.arrangement === 'counterflow' ? v.hotOut - v.coldIn : v.hotOut - v.coldOut;
    if (d1 <= 0 || d2 <= 0) throw new Error('Terminal temperature differences must both be positive for the selected arrangement; check for a temperature cross.');
    const lmtd = Math.abs(d1 - d2) < 1e-10 ? d1 : (d1 - d2) / Math.log(d1 / d2);
    let results;
    if (v.solveFor === 'area') {
      positive(v.duty, 'Heat duty');
      const area = (v.duty * 1000) / (v.overallU * v.correctionF * lmtd);
      results = [R('Required area', area, 'm²'), R('Log mean temperature difference', lmtd, 'K'), R('Terminal difference 1', d1, 'K'), R('Terminal difference 2', d2, 'K')];
    } else {
      positive(v.area, 'Area');
      const Q = v.overallU * v.area * v.correctionF * lmtd;
      results = [R('Heat duty', Q / 1000, 'kW'), R('Log mean temperature difference', lmtd, 'K'), R('Terminal difference 1', d1, 'K'), R('Terminal difference 2', d2, 'K')];
    }
    const out = outcome(results);
    if (Math.min(d1, d2) < 5) out.warnings.push('A terminal approach below about 5 K can make area and cost very sensitive; verify temperatures and the practical approach limit.');
    return out;
  });

  S('shaft-design', v => {
    positive(v.power, 'Power'); positive(v.rpm, 'Speed'); positive(v.allowableShear, 'Allowable shear');
    positive(v.selectedDiameter, 'Selected diameter'); positive(v.length, 'Length'); positive(v.shearModulus, 'Shear modulus');
    const omega = 2 * Math.PI * v.rpm / 60;
    const torqueNm = (v.power * 1000) / omega;
    const torqueNmm = torqueNm * 1000;
    const minD = Math.cbrt(16 * torqueNmm / (Math.PI * v.allowableShear));
    const d = v.selectedDiameter;
    const J = Math.PI * d ** 4 / 32;
    const tau = 16 * torqueNmm / (Math.PI * d ** 3);
    const twist = torqueNmm * v.length / ((v.shearModulus * 1000) * J);
    const out = outcome([
      R('Torque', torqueNm, 'N·m'), R('Minimum solid diameter (pure torsion)', minD, 'mm'),
      R('Shear stress at selected diameter', tau, 'MPa'), R('Utilisation vs allowable shear', tau / v.allowableShear * 100, '%'),
      R('Polar moment J at selected diameter', J, 'mm⁴'), R('Twist over length', twist * 180 / Math.PI, 'degree')]);
    if (d < minD) out.warnings.push('Selected diameter is below the pure-torsion minimum for the stated allowable shear stress.');
    return out;
  });

  S('bolt-member-stiffness', v => {
    ['threadArea','threadLength','majorArea','unthreadLength','boltModulus','memberArea','gripLength','memberModulus'].forEach(k => positive(v[k], k));
    nonNegative(v.externalLoad, 'External load');
    const Eb = v.boltModulus * 1000; // GPa → N/mm²
    const Em = v.memberModulus * 1000;
    const kb = 1 / ((v.threadLength / (v.threadArea * Eb)) + (v.unthreadLength / (v.majorArea * Eb))); // N/mm
    const km = v.memberArea * Em / v.gripLength;
    const Cstiff = kb / (kb + km);
    return outcome([
      R('Effective bolt stiffness kb', kb / 1000, 'kN/mm'), R('Member stiffness km (direct area model)', km / 1000, 'kN/mm'),
      R('Joint constant C = kb/(kb+km)', Cstiff, '—'), R('Incremental bolt load from external P', Cstiff * v.externalLoad / 1000, 'kN'),
      R('Member load relief from external P', (1 - Cstiff) * v.externalLoad / 1000, 'kN')]);
  });

  S('stress-reduction-per-kg', v => {
    positive(v.baselineStress, 'Baseline stress'); positive(v.baselineMass, 'Baseline mass');
    nonNegative(v.modifiedStress, 'Modified stress'); positive(v.modifiedMass, 'Modified mass');
    const dStress = v.baselineStress - v.modifiedStress;
    const dMass = v.modifiedMass - v.baselineMass;
    const efficiency = dMass > 0 ? dStress / dMass : null;
    const results = [
      R('Stress reduction', dStress, 'MPa'), R('Stress reduction', dStress / v.baselineStress * 100, '%'),
      R('Mass change (modified − baseline)', dMass, 'kg'), R('Mass change', dMass / v.baselineMass * 100, '%'),
      R('Baseline stress per unit mass', v.baselineStress / v.baselineMass, 'MPa/kg'),
      R('Modified stress per unit mass', v.modifiedStress / v.modifiedMass, 'MPa/kg')];
    if (efficiency !== null) results.splice(2, 0, R('Stress reduction per added kilogram', efficiency, 'MPa/kg added'));
    const out = outcome(results);
    if (dMass <= 0 && dStress > 0) out.steps.push('Win–win change: stress fell without added mass, so “per added kilogram” is not a finite efficiency metric.');
    if (dStress <= 0) out.warnings.push('The modified design does not reduce the selected stress metric.');
    if (dMass === 0) out.warnings.push('Mass is unchanged, so MPa per added kilogram is undefined.');
    return out;
  });

  S('resonance-risk-checker', v => {
    positive(v.rpm, 'RPM'); positive(v.blades, 'Blade count'); positive(v.riskPercent, 'Risk threshold'); nonNegative(v.includeBladeHarmonics, 'Blade harmonics');
    const orders = parseList(v.orders, 'Excitation orders');
    const naturals = parseList(v.naturalFrequencies, 'Natural frequencies');
    const shaft = v.rpm / 60;
    const excitations = [];
    orders.forEach(n => excitations.push({ label: `Shaft order ${n}×`, frequency: n * shaft }));
    const bpf = v.blades * shaft;
    for (let h = 1; h <= Math.round(v.includeBladeHarmonics); h++) excitations.push({ label: `Blade-pass ${h}×BPF`, frequency: h * bpf });
    const rows = excitations.map(ex => {
      let nearest = naturals[0], sep = Infinity;
      naturals.forEach(fn => { const s = Math.abs(fn - ex.frequency); if (s < sep) { sep = s; nearest = fn; } });
      const pct = nearest === 0 ? Infinity : sep / nearest * 100;
      const risk = pct <= v.riskPercent ? 'HIGH' : (pct <= 2 * v.riskPercent ? 'WATCH' : 'CLEAR (screen)');
      return [ex.label, ex.frequency, nearest, sep, pct, risk];
    });
    const worst = rows.reduce((a, b) => (a[4] < b[4] ? a : b), rows[0]);
    const out = outcome([
      R('Shaft rotational frequency', shaft, 'Hz'), R('Blade-pass frequency', bpf, 'Hz'),
      R('Smallest separation found', worst ? worst[4] : NaN, '% of natural frequency'),
      R('Closest pair', worst ? `${worst[0]} vs ${M.formatNumber(worst[2])} Hz` : '—', '')],
      { table: { columns: ['Excitation', 'Excitation (Hz)', 'Nearest natural (Hz)', 'Separation (Hz)', 'Separation (%)', 'Screen'], rows } });
    out.warnings = ['Frequency separation is a screening metric. Forcing amplitude, modal effective mass, mode shape at the force location, damping and speed variation determine actual response.'];
    return out;
  });
})(globalThis);
