// FORM / FEA calculators — structural-analysis catalog metadata.
(function (root) {
  'use strict';
  const U = root.CalcUnits;
  const N = (key, label, def, unit, extra = {}) => ({ key, label, type: 'number', default: def, ...(Array.isArray(unit) ? { units: unit } : { unit }), ...extra });
  const S = (key, label, def, options, extra = {}) => ({ key, label, type: 'select', default: def, options, ...extra });
  const C = def => root.CALCULATORS.push(def);
  const stressTensor = (sx=80, sy=20, sz=-10, txy=25, tyz=5, txz=-8) => [
    N('sx', 'σx normal stress', sx, U.stressMpa), N('sy', 'σy normal stress', sy, U.stressMpa), N('sz', 'σz normal stress', sz, U.stressMpa),
    N('txy', 'τxy shear stress', txy, U.stressMpa), N('tyz', 'τyz shear stress', tyz, U.stressMpa), N('txz', 'τxz shear stress', txz, U.stressMpa) ];

  C({ id: 'tension-stress', category: 'structural-analysis', name: 'Basic Tension Stress Calculator', icon: 'tension',
    purpose: 'Calculate average axial stress, required area or force, with direct area or common section helpers.',
    formula: 'σ = F/A', ref: 'https://tensorcalculator.com/basic-tension-stress-calculator', tags: 'axial tension compression stress force area',
    checks: 'Average stress only. Stress concentration, bending, eccentric load, bearing and net-section effects need separate checks.',
    inputs: [ S('solveFor', 'Solve for', 'stress', ['stress', 'force', 'area']), S('section', 'Area input', 'direct', ['direct', 'rectangle', 'circle', 'hollowCircle']),
      N('force', 'Axial force F (+ tension, − compression)', 50, U.forceN, { defaultUnit: 'kN' }), N('stress', 'Average stress σ', 100, U.stressMpa),
      N('area', 'Cross-sectional area A (direct)', 500, U.areaMm2), N('width', 'Rectangle width b', 50, U.lengthMm), N('height', 'Rectangle height h', 10, U.lengthMm),
      N('diameter', 'Circle / outer diameter D', 25, U.lengthMm), N('innerDiameter', 'Inner diameter d (hollow)', 19, U.lengthMm) ] });

  C({ id: 'bending-stress', category: 'structural-analysis', name: 'Stress from Bending Moment Calculator', icon: 'bending',
    purpose: 'Calculate elastic bending stress at a point, or maximum stress using direct I/c or rectangle/circle section helpers.',
    formula: 'σ = My/I · σmax = M/S where S = I/c', ref: 'https://tensorcalculator.com/stress-from-bending-moment-calculator', tags: 'bending moment beam flexure section modulus',
    checks: 'Requires linear-elastic beam assumptions about the stated neutral axis. Shear, local buckling, holes and plasticity are separate.',
    inputs: [ S('section', 'Section input', 'rectangle', ['direct', 'rectangle', 'circle']), N('moment', 'Bending moment M', 5, U.momentNm, { defaultUnit: 'kN·m' }),
      N('distance', 'Distance from neutral axis y', 50, U.lengthMm), N('inertia', 'Second moment of area I (direct)', 4166667, U.inertiaMm4),
      N('width', 'Rectangle width b', 50, U.lengthMm), N('height', 'Rectangle depth h', 100, U.lengthMm), N('diameter', 'Circle diameter D', 60, U.lengthMm) ] });

  C({ id: 'torque-shear-stress', category: 'structural-analysis', name: 'Torque vs Shear Stress Calculator', icon: 'torsion',
    purpose: 'Calculate polar moment, maximum torsional shear stress and twist for solid or hollow circular shafts.',
    formula: 'τ = Tr/J · solid τmax = 16T/(πd³) · φ = TL/(GJ)', ref: 'https://tensorcalculator.com/torque-vs-shear-stress-calculator', tags: 'torque torsion shear shaft polar moment twist',
    checks: 'Circular-section formulas only. Keyways, shoulders, combined bending/axial load and fatigue stress concentration may govern.',
    inputs: [ S('section', 'Circular section', 'solid', ['solid', 'hollow']), N('torque', 'Torque T', 250, U.torqueNm),
      N('outerDiameter', 'Outer diameter D', 40, U.lengthMm), N('innerDiameter', 'Inner diameter d (hollow)', 28, U.lengthMm),
      N('length', 'Length for twist', 600, U.lengthMm), N('shearModulus', 'Shear modulus G', 79, U.modulusGpa) ] });

  C({ id: 'stress-concentration', category: 'structural-analysis', name: 'Stress Concentration Calculator', icon: 'stress-concentration',
    purpose: 'Estimate elastic peak stress from nominal stress and Kt, with an optional central-hole-in-plate Kt approximation.',
    formula: 'σmax = Ktσnominal', ref: 'https://tensorcalculator.com/stress-concentration-calculator', tags: 'stress concentration kt notch hole peak stress fatigue',
    checks: 'Kt is geometry/load dependent and elastic. It is not automatically the fatigue notch factor Kf or a mesh-independent FEA peak.',
    inputs: [ S('ktMethod', 'Kt method', 'direct', ['direct', 'holeInPlate']), N('nominalStress', 'Nominal stress', 90, U.stressMpa),
      N('kt', 'Stress concentration factor Kt (direct)', 2.4, '—'), N('holeDiameter', 'Hole diameter d', 10, U.lengthMm),
      N('plateWidth', 'Plate width W', 60, U.lengthMm), N('allowableStress', 'Allowable/yield for margin (optional)', 250, U.stressMpa) ] });

  C({ id: 'principal-stress-3d', category: 'structural-analysis', name: '3D Principal Stress Calculator', icon: 'principal-3d',
    purpose: 'Find ordered principal stresses and direction cosines from a symmetric 3D stress tensor.',
    formula: 'Principal stresses are eigenvalues of [σ]; directions are eigenvectors', ref: 'https://tensorcalculator.com/stress-tensor-3d-principal-stress-calculator', tags: 'principal stress tensor eigenvalues directions 3d',
    checks: 'Tensor is treated as symmetric. Principal directions have sign ambiguity; repeated eigenvalues have non-unique in-plane directions.',
    inputs: stressTensor() });

  C({ id: 'stress-invariants', category: 'structural-analysis', name: 'Stress Invariants Calculator', icon: 'stress-invariants',
    purpose: 'Calculate I1, I2 and I3 invariants of a symmetric stress tensor, independent of coordinate rotation.',
    formula: 'I1 = tr(σ) · I2 = σxσy+σyσz+σzσx−τxy²−τyz²−τxz² · I3 = det(σ)', ref: 'https://tensorcalculator.com/stress-invariants-calculator', tags: 'stress invariants trace determinant tensor',
    checks: 'Invariant values depend on consistent stress units and sign convention, not coordinate orientation.',
    inputs: stressTensor() });

  C({ id: 'hydrostatic-deviatoric-stress', category: 'structural-analysis', name: 'Hydrostatic, Mean and Deviatoric Stress Calculator', icon: 'hydrostatic-deviatoric',
    purpose: 'Split a stress tensor into mean/hydrostatic and deviatoric parts, with J2, von Mises and octahedral measures.',
    formula: 'σm = tr(σ)/3 · s = σ − σmI · σv = √(3J2)', ref: 'https://tensorcalculator.com/stress-tensor-calculator-octahedral-mean-hydrostatic-deviatoric', tags: 'hydrostatic mean deviatoric octahedral von mises j2',
    checks: 'With tension-positive stress, hydrostatic pressure is commonly p = −σm. State the convention in reports.',
    inputs: stressTensor() });

  C({ id: 'mohrs-circle-3d-stress', category: 'structural-analysis', name: "Mohr's Circle for 3D Stress", icon: 'mohr-3d',
    purpose: 'Plot the three Mohr circles for a 3D stress tensor and report principal stresses and maximum shear values.',
    formula: 'Centers (σi+σj)/2 · radii |σi−σj|/2', ref: 'https://tensorcalculator.com/mohrs-circle-for-3d-stress-calculator', tags: 'mohr circle principal stress maximum shear plot',
    checks: 'Mohr’s circle is a transformation/visualisation tool, not by itself a failure criterion.',
    inputs: stressTensor(120, 40, -20, 30, 10, -15) });

  C({ id: 'yielding-failure-criteria', category: 'structural-analysis', name: 'Yielding and Failure Criteria Calculator', icon: 'failure-criteria',
    purpose: 'Compare a 3D stress state against von Mises, Tresca and maximum-principal measures with yield margins.',
    formula: 'σv = √{[(σ1−σ2)²+(σ2−σ3)²+(σ3−σ1)²]/2} · Tresca = σmax−σmin', ref: 'https://tensorcalculator.com/yielding-and-failure-criteria-calculator', tags: 'von mises tresca rankine yield safety factor failure',
    checks: 'Choose a criterion appropriate to ductile/brittle behavior and failure mode. Fatigue, fracture, buckling and creep need separate assessments.',
    inputs: [ ...stressTensor(160, 60, -30, 45, 10, -20), N('yieldStrength', 'Yield/reference strength Sy', 250, U.stressMpa) ] });

  C({ id: 'strain-from-displacement', category: 'structural-analysis', name: 'Strain from Displacement Calculator', icon: 'strain-displacement',
    purpose: 'Convert nine displacement gradients into infinitesimal normal/engineering shear strains and small rotation components.',
    formula: 'εij = ½(∂ui/∂xj + ∂uj/∂xi) · γij = 2εij', ref: 'https://tensorcalculator.com/strain-from-displacement-calculator', tags: 'displacement gradient small strain rotation tensor',
    checks: 'Small-strain kinematics only. Large rotations/deformations require finite-strain measures such as Green–Lagrange or logarithmic strain.',
    inputs: [
      N('dudx', '∂u/∂x', .0012, '—'), N('dudy', '∂u/∂y', .0004, '—'), N('dudz', '∂u/∂z', -.0002, '—'),
      N('dvdx', '∂v/∂x', .0006, '—'), N('dvdy', '∂v/∂y', -.0005, '—'), N('dvdz', '∂v/∂z', .0001, '—'),
      N('dwdx', '∂w/∂x', -.0001, '—'), N('dwdy', '∂w/∂y', .0003, '—'), N('dwdz', '∂w/∂z', .0008, '—') ] });

  C({ id: 'strain-tensor', category: 'structural-analysis', name: 'Strain Tensor Calculator', icon: 'strain-tensor',
    purpose: 'Build a small-strain tensor from engineering strain components and calculate principal strains and volumetric strain.',
    formula: 'ε = ½(∇u+∇uᵀ) · tensor shear εij = γij/2 · principal strains are eigenvalues', ref: 'https://tensorcalculator.com/strain-tensor-calculator', tags: 'strain tensor principal microstrain volumetric engineering shear',
    checks: 'This form expects engineering shear strains γ. Tensor shear components are half those values; do not mix conventions.',
    inputs: [
      N('ex', 'εx normal strain', 1200, 'µε'), N('ey', 'εy normal strain', -350, 'µε'), N('ez', 'εz normal strain', -280, 'µε'),
      N('gxy', 'γxy engineering shear strain', 700, 'µε'), N('gyz', 'γyz engineering shear strain', 120, 'µε'), N('gxz', 'γxz engineering shear strain', -180, 'µε') ] });

  C({ id: 'mohrs-circle-strain', category: 'structural-analysis', name: "Mohr's Circle for Strain", icon: 'mohr-strain',
    purpose: 'Plot plane-strain Mohr’s circle and calculate principal strains, maximum shear, orientation and strain at a selected angle.',
    formula: 'C=(εx+εy)/2 · R=√[((εx−εy)/2)²+(γxy/2)²]', ref: 'https://tensorcalculator.com/mohrs-circle-for-strain-calculator-plotter', tags: 'mohr strain principal shear angle plot microstrain',
    checks: 'Inputs use engineering shear γxy; Mohr strain uses γxy/2 vertically. Absolute maximum shear considers the zero out-of-plane principal strain for plane strain display.',
    inputs: [ N('ex', 'εx', 900, 'µε'), N('ey', 'εy', -250, 'µε'), N('gxy', 'γxy engineering shear', 650, 'µε'), N('theta', 'Element angle θ', 30, U.angleDeg) ] });

  C({ id: 'isotropic-constitutive', category: 'structural-analysis', name: 'Isotropic Stress-Strain Constitutive Equation', icon: 'constitutive',
    purpose: 'Convert 3D strain to stress or stress to strain for a linear-elastic isotropic material defined by E and ν.',
    formula: 'σ = λ tr(ε)I + 2με · ε = (1+ν)σ/E − ν tr(σ)I/E', ref: 'https://tensorcalculator.com/stress-strain-tensor-constitutive-equation-calculator-isotropic-material', tags: 'constitutive isotropic elasticity hooke lame modulus poisson',
    checks: 'Shear inputs are engineering strains/stresses as labelled. Linear elasticity only; yielding, anisotropy and viscoelasticity are excluded.',
    inputs: [ S('direction', 'Conversion direction', 'strainToStress', ['strainToStress', 'stressToStrain']),
      N('youngsModulus', "Young's modulus E", 200, U.modulusGpa), N('poisson', "Poisson's ratio ν", .3, '—'),
      N('c1', 'xx component (εxx µε or σxx MPa)', 1000, 'input unit'), N('c2', 'yy component', -300, 'input unit'), N('c3', 'zz component', -250, 'input unit'),
      N('c4', 'xy component (γxy µε or τxy MPa)', 500, 'input unit'), N('c5', 'yz component', 100, 'input unit'), N('c6', 'xz component', -150, 'input unit') ] });

  C({ id: 'pressure-vessel-thickness', category: 'structural-analysis', name: 'Pressure Vessel Thickness Calculator', icon: 'pressure-vessel',
    purpose: 'Estimate internal-pressure wall thickness for cylindrical hoop/longitudinal or spherical shells using transparent code-style equations.',
    formula: 'Cylindrical hoop: t = PR/(SE−0.6P) · add corrosion allowance separately', ref: 'https://tensorcalculator.com/pressure-vessel-thickness-calculator', tags: 'pressure vessel thickness hoop stress asme allowable corrosion',
    checks: 'Preliminary only. Final design must use the governing code for geometry, weld category, openings, external pressure, temperature and tolerances.',
    inputs: [ S('shellType', 'Shell / stress case', 'cylinderHoop', ['cylinderHoop', 'cylinderLongitudinal', 'sphere']),
      N('pressure', 'Internal design pressure P', 2, U.stressMpa), N('insideDiameter', 'Inside diameter D', 1000, U.lengthMm),
      N('allowableStress', 'Allowable stress S', 138, U.stressMpa), N('jointEfficiency', 'Joint efficiency E', 85, U.percent),
      N('corrosionAllowance', 'Corrosion allowance', 3, U.lengthMm) ] });

  C({ id: 'material-selection-ashby', category: 'structural-analysis', name: 'Material Selection Filter (Ashby Plot)', icon: 'ashby-plot',
    purpose: 'Screen a built-in educational material set by modulus, strength and density; rank specific properties and view an Ashby-style scatter plot.',
    formula: 'Screening indices shown: E/ρ and σy/ρ (choose an index suited to the actual design objective)', ref: 'https://tensorcalculator.com/material-selection-filter-ashby-plot-plotter', tags: 'ashby material selection modulus density strength filter plot',
    checks: 'Typical handbook values for education only. Verify exact grade, temper, orientation, temperature, cost, joining and availability.',
    inputs: [ N('minModulus', 'Minimum Young’s modulus', 20, U.modulusGpa), N('minYield', 'Minimum yield/reference strength', 150, U.stressMpa),
      N('maxDensity', 'Maximum density', 8000, U.density),
      S('rankBy', 'Rank passing materials by', 'specificStrength', ['specificStrength', 'specificStiffness', 'yield', 'modulus', 'lightest']),
      S('yAxis', 'Plot vertical axis', 'modulus', ['modulus', 'yield', 'specificStiffness', 'specificStrength']) ] });
})(globalThis);
