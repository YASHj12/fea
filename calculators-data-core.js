// FORM / FEA calculators — catalog metadata: thermodynamics, fluids, CFD, piping,
// heat exchangers, mechanical elements and FORM FEA tools.
(function (root) {
  'use strict';
  const U = root.CalcUnits;
  const N = (key, label, def, unit, extra = {}) => ({ key, label, type: 'number', default: def, ...(Array.isArray(unit) ? { units: unit } : { unit }), ...extra });
  const S = (key, label, def, options, extra = {}) => ({ key, label, type: 'select', default: def, options, ...extra });
  const T = (key, label, def, extra = {}) => ({ key, label, type: 'textarea', default: def, ...extra });
  const C = def => root.CALCULATORS.push(def);

  root.CALCULATOR_CATEGORIES.push(
    { id: 'thermodynamics', icon: 'cat-thermodynamics', num: '01', name: 'Thermodynamics', file: 'calculators-thermodynamics.html', motif: 'PV = nRT', goal: 'Relate pressure, volume, amount and absolute temperature for gases.', countLabel: '1 calculator' },
    { id: 'fluid-dynamics', icon: 'cat-fluid-dynamics', num: '02', name: 'General Fluid Dynamics', file: 'calculators-fluid-dynamics.html', motif: 'Re · Nu', goal: 'Classify flow regimes and compare convection with conduction.', countLabel: '2 calculators' },
    { id: 'cfd', icon: 'cat-cfd', num: '03', name: 'CFD', file: 'calculators-cfd.html', motif: 'y⁺ · CFL · k–ε', goal: 'Set credible turbulence inputs, wall spacing and transient time steps.', countLabel: '4 calculators' },
    { id: 'hvac', icon: 'cat-hvac', num: '04', name: 'HVAC', file: 'calculators-hvac.html', motif: 'Q · CFM · COP', goal: 'Size loads, air and water systems, airflow, energy and indoor-air requirements.', countLabel: '16 calculators' },
    { id: 'piping-process', icon: 'cat-piping-process', num: '05', name: 'Piping & Process', file: 'calculators-piping-process.html', motif: 'Δp · Kv · H', goal: 'Estimate pipe and valve losses and combine system head terms.', countLabel: '3 calculators' },
    { id: 'heat-exchangers', icon: 'cat-heat-exchangers', num: '06', name: 'Heat Exchangers', file: 'calculators-heat-exchangers.html', motif: 'Q = UAFΔTₗₘ', goal: 'Make transparent first-pass LMTD duty and area estimates.', countLabel: '1 calculator' },
    { id: 'mechanical-elements', icon: 'cat-mechanical-elements', num: '07', name: 'Mechanical Elements', file: 'calculators-mechanical-elements.html', motif: 'T · k_b · k_m', goal: 'Screen shafts and bolted-joint stiffness before detailed design.', countLabel: '2 calculators' },
    { id: 'structural-analysis', icon: 'cat-structural-analysis', num: '08', name: 'Structural Analysis', file: 'calculators-structural-analysis.html', motif: 'σ · ε · [σ]', goal: 'Work from basic stress to tensors, failure criteria, vessels and materials.', countLabel: '15 calculators' },
    { id: 'fea-tools', icon: 'cat-fea-tools', num: '09', name: 'FORM FEA Tools', file: 'calculators-fea-tools.html', motif: 'MPa/kg · fₙ', goal: 'FORM additions for comparing FEA design changes and screening resonance risk.', countLabel: '2 calculators' },
  );

  C({ id: 'ideal-gas-law', category: 'thermodynamics', name: 'Ideal Gas Law Calculator', icon: 'ideal-gas',
    purpose: 'Solve pressure, volume, amount of gas or absolute temperature using PV = nRT.',
    formula: 'PV = nRT', ref: 'https://tensorcalculator.com/ideal-gas-law-calculator', tags: 'gas pressure volume mole temperature',
    checks: 'Use absolute pressure and kelvin. Real gases may deviate at high pressure or near condensation.',
    inputs: [
      S('solveFor', 'Solve for', 'pressure', ['pressure', 'volume', 'amount', 'temperature']),
      N('pressure', 'Absolute pressure P', 101.325, U.pressureKpa), N('volume', 'Volume V', 1, U.volumeM3),
      N('amount', 'Amount n', 40.87, 'mol'), N('temperature', 'Temperature T', 298.15, U.tempK),
      N('gasConstant', 'Gas constant R', 8.314462618, 'J/(mol·K)') ] });

  C({ id: 'Reynolds-number', category: 'fluid-dynamics', name: 'Reynolds Number Calculator', icon: 'Reynolds-flow',
    purpose: 'Estimate Reynolds number and the likely internal-flow regime from velocity, length and viscosity.',
    formula: 'Re = ρVD/μ = VD/ν', ref: 'https://tensorcalculator.com/reynolds-number-calculator', tags: 'laminar turbulent transition density viscosity',
    checks: 'Pipe thresholds are guides, not universal limits. Choose the characteristic length appropriate to the geometry.',
    inputs: [ S('viscosityMode', 'Viscosity input', 'dynamic', ['dynamic', 'kinematic']),
      N('density', 'Density ρ', 998, U.density), N('velocity', 'Velocity V', 1.5, U.velocity),
      N('length', 'Characteristic length D or L', 0.05, U.lengthM), N('dynViscosity', 'Dynamic viscosity μ', 0.001002, U.dynViscosity),
      N('kinViscosity', 'Kinematic viscosity ν', 1.004e-6, U.kinViscosity) ] });

  C({ id: 'Nusselt-number', category: 'fluid-dynamics', name: 'Nusselt Number Calculator', icon: 'Nusselt-heat',
    purpose: 'Relate convective heat transfer to conduction across a characteristic fluid length, or solve for h, L or k.',
    formula: 'Nu = hL/k', ref: 'https://tensorcalculator.com/nusselt-number-calculator', tags: 'convection conduction heat transfer coefficient',
    checks: 'Use a correlation and characteristic length that match the geometry, flow regime and boundary condition.',
    inputs: [ S('solveFor', 'Solve for', 'Nusselt', ['Nusselt', 'coefficient', 'length', 'conductivity']),
      N('Nusselt', 'Nusselt number Nu', 120, '—'), N('h', 'Convective coefficient h', 250, U.heatFluxCoeff),
      N('length', 'Characteristic length L', .1, U.lengthM), N('k', 'Fluid conductivity k', .6, U.conductivity) ] });

  C({ id: 'turbulent-boundary-initial-conditions', category: 'cfd', name: 'Turbulent Boundary and Initial Conditions', icon: 'turbulence-inlet',
    purpose: 'Estimate k, ε, ω and turbulent viscosity ratio from mean velocity, turbulence intensity and a length scale.',
    formula: 'k = 3⁄2(UI)² · ε = Cμ³⁄⁴ k³⁄² / ℓ · ω = ε/(Cμk)', ref: 'https://tensorcalculator.com/turbulent-boundary-and-initial-conditions', tags: 'cfd turbulence intensity k epsilon omega inlet',
    checks: 'Confirm definitions and length scale for your turbulence model. These are estimates, not measured inlet data.',
    inputs: [ N('velocity', 'Mean velocity U', 10, U.velocity), N('intensity', 'Turbulence intensity I', 5, U.percent),
      N('lengthScale', 'Turbulence length scale ℓ', .07, U.lengthM), N('kinViscosity', 'Kinematic viscosity ν', 1.5e-5, U.kinViscosity),
      N('cmu', 'Model constant Cμ', .09, '—') ] });

  C({ id: 'Courant-number', category: 'cfd', name: 'Courant Number Calculator', icon: 'courant-time',
    purpose: 'Calculate Courant number, or solve for the time step, cell size or characteristic velocity in the simple 1D form.',
    formula: 'Co = UΔt/Δx', ref: 'https://tensorcalculator.com/courant-number-calculator', tags: 'cfd courant cfl timestep mesh',
    checks: 'Acceptable Co depends on solver, scheme and accuracy target. Multidimensional solvers combine directional contributions.',
    inputs: [ S('solveFor', 'Solve for', 'courant', ['courant', 'timeStep', 'cellSize', 'velocity']),
      N('courant', 'Courant number Co', .8, '—'), N('velocity', 'Characteristic velocity U', 12, U.velocity),
      N('timeStep', 'Time step Δt', .0005, 's'), N('cellSize', 'Cell length Δx', .01, U.lengthM) ] });

  C({ id: 'rotating-blade-time-step', category: 'cfd', name: 'Time Step for Rotating Blades', icon: 'rotor-step',
    purpose: 'Convert rotational speed and a target angular increment into a CFD time step and blade-passing resolution.',
    formula: 'ω = 2πN/60 · Δt = Δθ/ω · fBPF = ZN/60', ref: 'https://tensorcalculator.com/time-step-for-rotating-blades', tags: 'cfd rotating blade rpm time step bpf',
    checks: 'Resolve relevant flow physics as well as rotation; Courant and mesh-motion limits may demand smaller steps.',
    inputs: [ N('rpm', 'Rotational speed', 3000, 'rpm'), N('angleStep', 'Angular increment per step', 2, U.angleDeg),
      N('blades', 'Number of blades / vanes', 12, 'count', { step: 1 }) ] });

  C({ id: 'wall-distance-y-plus', category: 'cfd', name: 'Wall Distance from y+', icon: 'wall-layers',
    purpose: 'Find first-cell wall distance from target y+, or the y+ produced by a chosen distance and friction velocity.',
    formula: 'y⁺ = uτy/ν · uτ = √(τw/ρ)', ref: 'https://tensorcalculator.com/wall-distance-from-y-plus', tags: 'cfd y plus wall distance friction velocity boundary layer',
    checks: 'Target y+ depends on wall treatment. Friction velocity must represent the actual wall shear and flow condition.',
    inputs: [ S('solveFor', 'Solve for', 'distance', ['distance', 'yPlus']), S('frictionMode', 'Friction velocity from', 'direct', ['direct', 'wallShear']),
      N('yPlus', 'Target y+', 1, '—'), N('distance', 'Wall distance y', .00002, U.lengthM),
      N('frictionVelocity', 'Friction velocity uτ', .45, U.velocity), N('wallShear', 'Wall shear stress τw', 2.2, U.pressurePa),
      N('density', 'Density ρ', 1.2, U.density), N('kinViscosity', 'Kinematic viscosity ν', 1.5e-5, U.kinViscosity) ] });

  C({ id: 'piping-pressure-drop', category: 'piping-process', name: 'Piping Pressure Drop Calculator', icon: 'pipe-pressure',
    purpose: 'Estimate velocity, Reynolds number, friction, fitting and optional elevation pressure changes in a circular pipe.',
    formula: 'Δp = [f(L/D) + ΣK]ρV²/2 + ρgΔz', ref: 'https://tensorcalculator.com/piping-pressure-drop-calculator', tags: 'pipe darcy friction fittings pressure loss',
    checks: 'Confirm the friction correlation, fitting K values, roughness and whether elevation belongs in the pump/system balance.',
    inputs: [ N('flow', 'Flow rate Q', .05, U.flowM3s), N('diameter', 'Inside diameter D', .1, U.lengthM),
      N('length', 'Pipe length L', 50, U.lengthM), N('density', 'Density ρ', 998, U.density),
      N('viscosity', 'Dynamic viscosity μ', .001, U.dynViscosity), N('roughness', 'Absolute roughness ε', .045, U.lengthMm),
      N('lossCoefficient', 'Total fitting coefficient ΣK', 8, '—'), N('elevationRise', 'Elevation rise Δz (+ upward)', 0, U.lengthM) ] });

  C({ id: 'valve-pressure-drop', category: 'piping-process', name: 'Valve Pressure Drop Calculator', icon: 'valve',
    purpose: 'Relate liquid flow, specific gravity, Kv/Cv and valve pressure drop in either direction.',
    formula: 'Q = Kv√(Δp/SG) with Q in m³/h and Δp in bar · Cv ≈ 1.156Kv', ref: 'https://tensorcalculator.com/valve-pressure-drop-calculator', tags: 'valve kv cv flow coefficient pressure drop',
    checks: 'Use manufacturer definitions and check choked flow, cavitation, flashing and viscosity corrections for real valves.',
    inputs: [ S('solveFor', 'Solve for', 'pressureDrop', ['pressureDrop', 'flow']), S('coefficientType', 'Coefficient given', 'Kv', ['Kv', 'Cv']),
      N('coefficient', 'Valve coefficient', 40, 'Kv or Cv'), N('flow', 'Flow rate Q', 18, U.flowM3h),
      N('pressureDrop', 'Valve pressure drop Δp', 50, U.pressureKpa), N('specificGravity', 'Specific gravity SG', 1, '—') ] });

  C({ id: 'total-head', category: 'piping-process', name: 'Total Head Calculator', icon: 'total-head',
    purpose: 'Combine elevation, pressure, velocity-head change and losses into required total head and equivalent pressure.',
    formula: 'H = Δz + Δp/(ρg) + (V₂²−V₁²)/(2g) + hL', ref: 'https://tensorcalculator.com/total-head-calculator', tags: 'head pump bernoulli elevation pressure velocity loss',
    checks: 'Keep one datum and sign convention. In a closed loop, net static elevation may cancel while friction losses remain.',
    inputs: [ N('elevationRise', 'Elevation rise z₂−z₁', 5, U.lengthM), N('pressureRise', 'Pressure rise p₂−p₁', 0, U.pressureKpa),
      N('velocity1', 'Velocity at point 1', 1, U.velocity), N('velocity2', 'Velocity at point 2', 1.5, U.velocity),
      N('lossHead', 'System loss head hL', 3, U.lengthM), N('density', 'Density ρ', 998, U.density), N('gravity', 'Gravity g', 9.80665, 'm/s²') ] });

  C({ id: 'heat-exchanger-sizing', category: 'heat-exchangers', name: 'Heat Exchanger Sizing Calculator', icon: 'heat-exchanger',
    purpose: 'Use LMTD to solve heat-exchanger area from duty, or duty from area, U value and correction factor.',
    formula: 'Q = U A F ΔTlm', ref: 'https://tensorcalculator.com/heat-exchanger-sizing-calculator', tags: 'heat exchanger lmtd area duty overall coefficient',
    checks: 'Check terminal temperature approach, flow arrangement, fouling, pressure drop and whether U is based on the same area definition.',
    inputs: [ S('solveFor', 'Solve for', 'area', ['area', 'duty']), S('arrangement', 'Temperature pairing', 'counterflow', ['counterflow', 'parallel']),
      N('duty', 'Heat duty Q', 250, U.powerKw), N('area', 'Heat-transfer area A', 42, U.areaM2),
      N('overallU', 'Overall coefficient U', 650, U.heatFluxCoeff), N('correctionF', 'LMTD correction factor F', .9, '—'),
      N('hotIn', 'Hot fluid inlet', 120, U.tempC), N('hotOut', 'Hot fluid outlet', 70, U.tempC),
      N('coldIn', 'Cold fluid inlet', 25, U.tempC), N('coldOut', 'Cold fluid outlet', 55, U.tempC) ] });

  C({ id: 'shaft-design', category: 'mechanical-elements', name: 'Mechanical Shaft Design Calculator', icon: 'shaft-torque',
    purpose: 'From power and speed, estimate torque, minimum solid-shaft diameter in pure torsion and stress/twist for a selected diameter.',
    formula: 'T = P/ω · τmax = 16T/(πd³) · φ = TL/(GJ)', ref: 'https://tensorcalculator.com/mechanical-shaft-design-calculator', tags: 'shaft torque power diameter torsional stress twist',
    checks: 'Pure torsion is a screen. Bending, fatigue, keys, shoulders, deflection, dynamics and stress concentration may govern.',
    inputs: [ N('power', 'Transmitted power P', 15, U.powerKw), N('rpm', 'Rotational speed', 1450, 'rpm'),
      N('allowableShear', 'Allowable shear stress', 40, U.stressMpa), N('selectedDiameter', 'Selected solid diameter', 35, U.lengthMm),
      N('length', 'Shaft length for twist', 500, U.lengthMm), N('shearModulus', 'Shear modulus G', 79, U.modulusGpa) ] });

  C({ id: 'bolt-member-stiffness', category: 'mechanical-elements', name: 'Bolt and Member Stiffness Calculator', icon: 'bolt-stiffness',
    purpose: 'Calculate series bolt stiffness, direct member stiffness, joint constant and how an external load increments bolt/member forces.',
    formula: 'kb from threaded + unthreaded lengths in series · km = AmEm/L · C = kb/(kb+km)', ref: 'https://tensorcalculator.com/bolt-and-member-stiffness-calculator', tags: 'bolt stiffness joint constant preload clamped member',
    checks: 'The direct member model needs a defensible effective area. Contact, embedment, prying, bending and preload loss require joint-level checks.',
    inputs: [ N('threadArea', 'Bolt tensile-stress area At', 84.3, U.areaMm2), N('threadLength', 'Threaded length in grip lt', 12, U.lengthMm),
      N('majorArea', 'Major-diameter area Ad', 113.1, U.areaMm2), N('unthreadLength', 'Unthreaded length in grip ld', 28, U.lengthMm),
      N('boltModulus', 'Bolt modulus Eb', 200, U.modulusGpa), N('memberArea', 'Effective member area Am', 650, U.areaMm2),
      N('gripLength', 'Clamped grip length L', 40, U.lengthMm), N('memberModulus', 'Member modulus Em', 200, U.modulusGpa),
      N('externalLoad', 'External separating load P (optional)', 10, U.forceN, { defaultUnit: 'kN' }) ] });

  C({ id: 'stress-reduction-per-kg', category: 'fea-tools', name: 'Stress Reduction per Added Kilogram', icon: 'stress-per-kg', featured: true,
    purpose: 'Compare baseline and modified FEA designs by stress change, percentage improvement, added mass and MPa reduced per added kilogram.',
    formula: 'Δσ = σbaseline − σmodified · efficiency = Δσ/Δm', ref: '', tags: 'fea optimization stress mass design comparison',
    checks: 'Compare only like-for-like models: same mesh quality, loads, boundary conditions, stress definition, averaging and result location.',
    inputs: [ N('baselineStress', 'Baseline stress', 320, U.stressMpa), N('baselineMass', 'Baseline mass', 12.5, U.massKg),
      N('modifiedStress', 'Modified stress', 260, U.stressMpa), N('modifiedMass', 'Modified mass', 13.1, U.massKg) ] });

  C({ id: 'resonance-risk-checker', category: 'fea-tools', name: 'Excitation Frequency & Resonance Risk Checker', icon: 'resonance', featured: true,
    purpose: 'Screen shaft orders and blade-pass excitations against modal natural frequencies with configurable separation criteria.',
    formula: 'f₁ = RPM/60 · order n = n·f₁ · BPF = blade count × RPM/60', ref: '', tags: 'fea modal resonance rpm orders blade pass frequency separation',
    checks: 'A screening result is not proof of safety. Consider damping, force amplitude, modal participation, mode shape and the full speed range.',
    inputs: [ N('rpm', 'Operating speed', 3000, 'rpm'), N('blades', 'Blades / vanes', 12, 'count', { step: 1 }),
      T('orders', 'Excitation orders to check', '1, 2, 3, 4'), T('naturalFrequencies', 'Natural frequencies from modal analysis (Hz)', '48, 125, 260, 610, 920'),
      N('riskPercent', 'High-risk separation threshold', 10, U.percent), N('includeBladeHarmonics', 'Blade-pass harmonics to include', 2, 'count', { step: 1 }) ] });
})(globalThis);
