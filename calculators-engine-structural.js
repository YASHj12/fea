// FORM / FEA calculators — structural-analysis solvers.
(function (root) {
  'use strict';
  const M = root.CalcMath;
  const { finite, positive, nonNegative, result: R, outcome, eigenSymmetric3, determinant3 } = M;
  const S = (id, fn) => { root.CALC_SOLVERS[id] = fn; };
  const tensor = v => [[v.sx, v.txy, v.txz], [v.txy, v.sy, v.tyz], [v.txz, v.tyz, v.sz]];
  const principalInfo = v => {
    const pairs = eigenSymmetric3(tensor(v));
    const p = pairs.map(x => x.value);
    const vm = Math.sqrt(Math.max(0, ((p[0]-p[1])**2 + (p[1]-p[2])**2 + (p[2]-p[0])**2) / 2));
    return { pairs, p, vm, maxShear: (p[0] - p[2]) / 2, mean: (v.sx + v.sy + v.sz) / 3 };
  };
  const vectorText = vec => `(${vec.map(x => M.formatNumber(x)).join(', ')})`;

  S('tension-stress', v => {
    let area = v.area;
    if (v.section === 'rectangle') { positive(v.width, 'Width'); positive(v.height, 'Height'); area = v.width * v.height; }
    if (v.section === 'circle') { positive(v.diameter, 'Diameter'); area = Math.PI * v.diameter ** 2 / 4; }
    if (v.section === 'hollowCircle') {
      positive(v.diameter, 'Outer diameter'); nonNegative(v.innerDiameter, 'Inner diameter');
      if (v.innerDiameter >= v.diameter) throw new Error('Inner diameter must be smaller than outer diameter.');
      area = Math.PI * (v.diameter ** 2 - v.innerDiameter ** 2) / 4;
    }
    let results;
    if (v.solveFor === 'stress') {
      finite(v.force, 'Axial force'); positive(area, 'Area');
      const stress = v.force / area;
      results = [R('Average axial stress', stress, 'MPa', stress >= 0 ? 'tensile' : 'compressive'), R('Cross-sectional area used', area, 'mm²')];
    } else if (v.solveFor === 'force') {
      finite(v.stress, 'Stress'); positive(area, 'Area');
      results = [R('Axial force', v.stress * area / 1000, 'kN'), R('Cross-sectional area used', area, 'mm²')];
    } else {
      finite(v.force, 'Axial force'); if (v.stress === 0) throw new Error('Stress cannot be zero when solving for area.');
      const required = v.force / v.stress;
      if (required <= 0) throw new Error('Force and stress signs give a non-physical negative area; use matching tension/compression signs.');
      results = [R('Required area', required, 'mm²')];
    }
    return outcome(results);
  });

  S('bending-stress', v => {
    finite(v.moment, 'Bending moment'); nonNegative(v.distance, 'Distance y');
    let I = v.inertia, c;
    if (v.section === 'rectangle') { positive(v.width, 'Width'); positive(v.height, 'Depth'); I = v.width * v.height ** 3 / 12; c = v.height / 2; }
    if (v.section === 'circle') { positive(v.diameter, 'Diameter'); I = Math.PI * v.diameter ** 4 / 64; c = v.diameter / 2; }
    positive(I, 'Second moment of area');
    const Mmm = Math.abs(v.moment) * 1000;
    const stressAtY = Mmm * v.distance / I;
    const results = [R('Bending stress magnitude at y', stressAtY, 'MPa'), R('Second moment of area I', I, 'mm⁴')];
    if (c) results.push(R('Maximum outer-fibre stress', Mmm * c / I, 'MPa'), R('Section modulus S = I/c', I / c, 'mm³'));
    const out = outcome(results);
    out.steps = ['Sign depends on which side of the neutral axis is inspected; magnitudes are reported.'];
    return out;
  });

  S('torque-shear-stress', v => {
    nonNegative(v.torque, 'Torque'); positive(v.outerDiameter, 'Outer diameter'); positive(v.length, 'Length'); positive(v.shearModulus, 'Shear modulus');
    const D = v.outerDiameter, d = v.section === 'hollow' ? v.innerDiameter : 0;
    if (d < 0 || d >= D) throw new Error('Inner diameter must be at least zero and smaller than outer diameter.');
    const J = Math.PI * (D ** 4 - d ** 4) / 32;
    const T = v.torque * 1000;
    const tau = T * (D / 2) / J;
    const twist = T * v.length / ((v.shearModulus * 1000) * J);
    return outcome([
      R('Polar second moment J', J, 'mm⁴'), R('Maximum torsional shear stress', tau, 'MPa'),
      R('Twist over length', twist * 180 / Math.PI, 'degree'), R('Twist per unit length', twist / v.length * 1000 * 180 / Math.PI, 'degree/m')]);
  });

  S('stress-concentration', v => {
    finite(v.nominalStress, 'Nominal stress');
    let Kt = v.kt, note = 'Direct Kt input.';
    if (v.ktMethod === 'holeInPlate') {
      positive(v.holeDiameter, 'Hole diameter'); positive(v.plateWidth, 'Plate width');
      const ratio = v.holeDiameter / v.plateWidth;
      if (ratio <= 0 || ratio >= 0.9) throw new Error('For the hole approximation, use 0 < d/W < 0.9.');
      Kt = 3 - 3.13 * ratio + 3.66 * ratio ** 2 - 1.53 * ratio ** 3;
      note = `Howland finite-width hole approximation at d/W = ${M.formatNumber(ratio)}; confirm whether nominal stress is based on net or gross area for your chart.`;
    }
    positive(Kt, 'Kt');
    const peak = Kt * v.nominalStress;
    const results = [R('Stress concentration factor Kt', Kt, '—'), R('Elastic peak stress', peak, 'MPa')];
    if (v.allowableStress > 0) results.push(R('Margin ratio allowable/|peak|', v.allowableStress / Math.max(Math.abs(peak), 1e-12), '—'));
    const out = outcome(results); out.steps = [note]; return out;
  });

  S('principal-stress-3d', v => {
    const info = principalInfo(v);
    const out = outcome([
      R('Principal stress σ1', info.p[0], 'MPa', `direction ${vectorText(info.pairs[0].vector)}`),
      R('Principal stress σ2', info.p[1], 'MPa', `direction ${vectorText(info.pairs[1].vector)}`),
      R('Principal stress σ3', info.p[2], 'MPa', `direction ${vectorText(info.pairs[2].vector)}`),
      R('Absolute maximum shear stress', info.maxShear, 'MPa'), R('von Mises stress', info.vm, 'MPa'), R('Mean stress', info.mean, 'MPa')]);
    out.steps = ['Principal directions are unit eigenvectors (direction cosines) in x-y-z order; reversing a vector gives the same physical axis.'];
    return out;
  });

  S('stress-invariants', v => {
    const m = tensor(v);
    const I1 = v.sx + v.sy + v.sz;
    const I2 = v.sx*v.sy + v.sy*v.sz + v.sz*v.sx - v.txy**2 - v.tyz**2 - v.txz**2;
    return outcome([R('First invariant I1', I1, 'MPa'), R('Second invariant I2', I2, 'MPa²'), R('Third invariant I3 = det(σ)', determinant3(m), 'MPa³')]);
  });

  S('hydrostatic-deviatoric-stress', v => {
    const info = principalInfo(v), mean = info.mean;
    const s = { x: v.sx-mean, y: v.sy-mean, z: v.sz-mean, xy: v.txy, yz: v.tyz, xz: v.txz };
    const J2 = 0.5 * (s.x*s.x + s.y*s.y + s.z*s.z) + s.xy*s.xy + s.yz*s.yz + s.xz*s.xz;
    const octahedralShear = Math.sqrt(2 * J2 / 3);
    return outcome([
      R('Mean (hydrostatic) stress σm', mean, 'MPa'), R('Hydrostatic pressure p = −σm', -mean, 'MPa'),
      R('Deviatoric sxx, syy, szz', `${M.formatNumber(s.x)}, ${M.formatNumber(s.y)}, ${M.formatNumber(s.z)}`, 'MPa'),
      R('Deviatoric sxy, syz, sxz', `${M.formatNumber(s.xy)}, ${M.formatNumber(s.yz)}, ${M.formatNumber(s.xz)}`, 'MPa'),
      R('Second deviatoric invariant J2', J2, 'MPa²'), R('von Mises stress √(3J2)', Math.sqrt(3 * J2), 'MPa'),
      R('Octahedral normal stress', mean, 'MPa'), R('Octahedral shear stress', octahedralShear, 'MPa')]);
  });

  S('mohrs-circle-3d-stress', v => {
    const info = principalInfo(v); const [a,b,c] = info.p;
    const circles = [[a,b],[b,c],[a,c]].map(([x,y]) => ({ center: (x+y)/2, radius: Math.abs(x-y)/2, pair: `${M.formatNumber(x)} / ${M.formatNumber(y)}` }));
    return outcome([
      R('Principal stresses σ1, σ2, σ3', `${M.formatNumber(a)}, ${M.formatNumber(b)}, ${M.formatNumber(c)}`, 'MPa'),
      R('Maximum shear (σ1−σ2)/2', Math.abs(a-b)/2, 'MPa'), R('Maximum shear (σ2−σ3)/2', Math.abs(b-c)/2, 'MPa'),
      R('Absolute maximum shear (σ1−σ3)/2', Math.abs(a-c)/2, 'MPa')],
      { plot: { type: 'mohr', title: '3D Mohr circles', xLabel: 'Normal stress σ (MPa)', yLabel: 'Shear stress τ (MPa)', circles } });
  });

  S('yielding-failure-criteria', v => {
    positive(v.yieldStrength, 'Yield strength');
    const info = principalInfo(v);
    const tresca = info.p[0] - info.p[2];
    const rankine = Math.max(Math.abs(info.p[0]), Math.abs(info.p[2]));
    const fos = eq => eq > 0 ? v.yieldStrength / eq : Infinity;
    const out = outcome([
      R('Principal stresses σ1, σ2, σ3', info.p.map(x => M.formatNumber(x)).join(', '), 'MPa'),
      R('von Mises equivalent stress', info.vm, 'MPa', `FoS ${M.formatNumber(fos(info.vm))}`),
      R('Tresca equivalent stress', tresca, 'MPa', `FoS ${M.formatNumber(fos(tresca))}`),
      R('Maximum absolute principal stress', rankine, 'MPa', `ratio to Sy ${M.formatNumber(fos(rankine))}`),
      R('Maximum shear stress', info.maxShear, 'MPa')]);
    if (info.vm >= v.yieldStrength) out.warnings.push('von Mises equivalent stress reaches or exceeds the entered yield/reference strength.');
    if (tresca >= v.yieldStrength) out.warnings.push('Tresca equivalent stress reaches or exceeds the entered yield/reference strength.');
    out.steps = ['FoS here is simply Sy/equivalent stress for screening; code factors, load factors and failure-mode-specific limits are not included.'];
    return out;
  });

  S('strain-from-displacement', v => {
    const ex=v.dudx, ey=v.dvdy, ez=v.dwdz;
    const exy=.5*(v.dudy+v.dvdx), eyz=.5*(v.dvdz+v.dwdy), exz=.5*(v.dudz+v.dwdx);
    const wxy=.5*(v.dudy-v.dvdx), wyz=.5*(v.dvdz-v.dwdy), wxz=.5*(v.dudz-v.dwdx);
    const micro = x => x*1e6;
    return outcome([
      R('Normal strains εx, εy, εz', `${M.formatNumber(micro(ex))}, ${M.formatNumber(micro(ey))}, ${M.formatNumber(micro(ez))}`, 'µε'),
      R('Engineering shear γxy, γyz, γxz', `${M.formatNumber(micro(2*exy))}, ${M.formatNumber(micro(2*eyz))}, ${M.formatNumber(micro(2*exz))}`, 'µε'),
      R('Tensor shear εxy, εyz, εxz', `${M.formatNumber(micro(exy))}, ${M.formatNumber(micro(eyz))}, ${M.formatNumber(micro(exz))}`, 'µε'),
      R('Volumetric strain trace', micro(ex+ey+ez), 'µε'),
      R('Small rotation ωxy, ωyz, ωxz', `${M.formatNumber(wxy)}, ${M.formatNumber(wyz)}, ${M.formatNumber(wxz)}`, 'rad')]);
  });

  S('strain-tensor', v => {
    const m = [[v.ex, v.gxy/2, v.gxz/2], [v.gxy/2, v.ey, v.gyz/2], [v.gxz/2, v.gyz/2, v.ez]];
    const pairs = eigenSymmetric3(m), p = pairs.map(x=>x.value);
    return outcome([
      R('Tensor shear εxy, εyz, εxz', `${M.formatNumber(v.gxy/2)}, ${M.formatNumber(v.gyz/2)}, ${M.formatNumber(v.gxz/2)}`, 'µε'),
      R('Principal strains ε1, ε2, ε3', p.map(x=>M.formatNumber(x)).join(', '), 'µε'),
      R('Principal directions', pairs.map(x=>vectorText(x.vector)).join(' · '), ''),
      R('Volumetric strain', v.ex+v.ey+v.ez, 'µε'), R('Absolute maximum engineering shear strain', p[0]-p[2], 'µε')]);
  });

  S('mohrs-circle-strain', v => {
    finite(v.ex,'εx'); finite(v.ey,'εy'); finite(v.gxy,'γxy'); finite(v.theta,'θ');
    const center=(v.ex+v.ey)/2;
    const radius=Math.hypot((v.ex-v.ey)/2, v.gxy/2);
    const e1=center+radius, e2=center-radius;
    const thetaP=.5*Math.atan2(v.gxy, v.ex-v.ey)*180/Math.PI;
    const th=v.theta*Math.PI/180;
    const exTheta=center + (v.ex-v.ey)/2*Math.cos(2*th) + v.gxy/2*Math.sin(2*th);
    const eyTheta=center - (v.ex-v.ey)/2*Math.cos(2*th) - v.gxy/2*Math.sin(2*th);
    const gammaTheta=-(v.ex-v.ey)*Math.sin(2*th) + v.gxy*Math.cos(2*th); // engineering shear
    const principals=[e1,e2,0].sort((a,b)=>b-a);
    return outcome([
      R('Circle centre', center, 'µε'), R('Circle radius', radius, 'µε'),
      R('Principal strains ε1, ε2', `${M.formatNumber(e1)}, ${M.formatNumber(e2)}`, 'µε'),
      R('Principal angle θp', thetaP, 'degree'), R('Maximum in-plane engineering shear', 2*radius, 'µε'),
      R('Absolute maximum engineering shear (incl. 0)', principals[0]-principals[2], 'µε'),
      R(`At θ=${M.formatNumber(v.theta)}°: εx′, εy′, γx′y′`, `${M.formatNumber(exTheta)}, ${M.formatNumber(eyTheta)}, ${M.formatNumber(gammaTheta)}`, 'µε')],
      { plot: { type:'mohr', title:'Mohr circle for plane strain', xLabel:'Normal strain ε (µε)', yLabel:'γ/2 (µε)', circles:[{center,radius,pair:'plane'}], points:[{x:v.ex,y:v.gxy/2,label:'X'}, {x:v.ey,y:-v.gxy/2,label:'Y'}] } });
  });

  S('isotropic-constitutive', v => {
    positive(v.youngsModulus, 'Young’s modulus');
    if (v.poisson <= -1 || v.poisson >= 0.5) throw new Error('For a stable isotropic elastic material, use −1 < ν < 0.5.');
    const E_MPa = v.youngsModulus * 1000, nu = v.poisson;
    const G = E_MPa / (2 * (1 + nu));
    const K = E_MPa / (3 * (1 - 2 * nu));
    const lambda = E_MPa * nu / ((1 + nu) * (1 - 2 * nu));
    let results = [R('Shear modulus G', G / 1000, 'GPa'), R('Bulk modulus K', K / 1000, 'GPa'), R('Lamé λ', lambda / 1000, 'GPa')];
    if (v.direction === 'strainToStress') {
      const e = [v.c1, v.c2, v.c3].map(x => finite(x,'Strain') * 1e-6);
      const gamma = [v.c4, v.c5, v.c6].map(x => finite(x,'Shear strain') * 1e-6);
      const trace = e[0]+e[1]+e[2];
      const normal = e.map(x => lambda * trace + 2 * G * x);
      const shear = gamma.map(x => G * x);
      results.push(R('Normal stresses σxx, σyy, σzz', normal.map(x=>M.formatNumber(x)).join(', '), 'MPa'),
                   R('Shear stresses τxy, τyz, τxz', shear.map(x=>M.formatNumber(x)).join(', '), 'MPa'));
    } else {
      const s = [v.c1, v.c2, v.c3].map(x => finite(x,'Stress'));
      const tau = [v.c4, v.c5, v.c6].map(x => finite(x,'Shear stress'));
      const trace = s[0]+s[1]+s[2];
      const normal = s.map(x => ((1+nu)*x - nu*trace) / E_MPa * 1e6);
      const gamma = tau.map(x => x / G * 1e6);
      results.push(R('Normal strains εxx, εyy, εzz', normal.map(x=>M.formatNumber(x)).join(', '), 'µε'),
                   R('Engineering shear γxy, γyz, γxz', gamma.map(x=>M.formatNumber(x)).join(', '), 'µε'));
    }
    const out = outcome(results);
    out.steps = [v.direction === 'strainToStress' ? 'Strain inputs are interpreted as microstrain (µε), with shear as engineering γ.' : 'Stress inputs are interpreted as MPa; strain outputs are microstrain, with shear as engineering γ.'];
    return out;
  });

  S('pressure-vessel-thickness', v => {
    positive(v.pressure, 'Pressure'); positive(v.insideDiameter, 'Inside diameter'); positive(v.allowableStress, 'Allowable stress'); nonNegative(v.corrosionAllowance, 'Corrosion allowance');
    const Eeff = v.jointEfficiency / 100;
    if (Eeff <= 0 || Eeff > 1) throw new Error('Joint efficiency must be greater than 0 and no more than 100%.');
    const P=v.pressure, Rr=v.insideDiameter/2, Sallow=v.allowableStress;
    let denom, formulaName;
    if (v.shellType === 'cylinderHoop') { denom = Sallow*Eeff - 0.6*P; formulaName='Cylindrical hoop: PR/(SE−0.6P)'; }
    else if (v.shellType === 'cylinderLongitudinal') { denom = 2*Sallow*Eeff + 0.4*P; formulaName='Cylindrical longitudinal: PR/(2SE+0.4P)'; }
    else { denom = 2*Sallow*Eeff - 0.2*P; formulaName='Spherical: PR/(2SE−0.2P)'; }
    if (denom <= 0) throw new Error('The formula denominator is not positive; pressure is too high for the allowable/efficiency combination.');
    const tPressure=P*Rr/denom;
    const out=outcome([R('Pressure-required thickness', tPressure, 'mm'), R('Minimum thickness incl. corrosion allowance', tPressure+v.corrosionAllowance, 'mm'), R('Inside radius used', Rr, 'mm'), R('Formula', formulaName, '')]);
    out.warnings=['Do not use this screen as a code calculation. The governing pressure-vessel code may require different formulas, factors and checks.'];
    return out;
  });

  const MATERIALS = [
    ['Mild steel',200,7850,250],['Alloy steel 4340 (Q&T)',205,7850,860],['Stainless steel 304',193,7900,215],['Cast iron (grey)',110,7200,200],
    ['Aluminium 1100',69,2710,35],['Aluminium 6061-T6',69,2700,276],['Aluminium 7075-T6',72,2810,503],['Magnesium AZ31',45,1770,200],
    ['Titanium Ti-6Al-4V',114,4430,880],['Copper C110',117,8940,70],['Brass C360',97,8500,125],['Inconel 718',200,8190,1035],
    ['CFRP (quasi-isotropic, indicative)',55,1550,450],['GFRP (indicative)',20,1900,250],['ABS',2.3,1050,40],['Nylon 6/6',3,1140,70],
    ['Polycarbonate',2.4,1200,62],['PEEK',3.6,1320,95],['Oak (along grain, indicative)',12,720,40],['Concrete (typical)',30,2400,3],
    ['Soda-lime glass',70,2500,40],['Alumina ceramic',380,3900,300],['Silicon carbide',450,3210,350],['Tungsten',400,19300,550]
  ].map(([name,E,rho,sy]) => ({ name, E, rho, sy, specE: E*1000/rho, specS: sy*1000/rho }));

  S('material-selection-ashby', v => {
    nonNegative(v.minModulus, 'Minimum modulus'); nonNegative(v.minYield, 'Minimum strength'); positive(v.maxDensity, 'Maximum density');
    const ranked=[...MATERIALS].sort((a,b)=>{
      if(v.rankBy==='specificStrength') return b.specS-a.specS;
      if(v.rankBy==='specificStiffness') return b.specE-a.specE;
      if(v.rankBy==='yield') return b.sy-a.sy;
      if(v.rankBy==='modulus') return b.E-a.E;
      return a.rho-b.rho;
    });
    const rows=ranked.map(m=>{
      const pass=m.E>=v.minModulus && m.sy>=v.minYield && m.rho<=v.maxDensity;
      return {...m, pass};
    });
    const passing=rows.filter(x=>x.pass);
    const yVal=m=> v.yAxis==='yield'?m.sy : v.yAxis==='specificStiffness'?m.specE : v.yAxis==='specificStrength'?m.specS : m.E;
    const yLabel=v.yAxis==='yield'?'Yield / reference strength (MPa)' : v.yAxis==='specificStiffness'?'Specific stiffness E/ρ (MN·m/kg)' : v.yAxis==='specificStrength'?'Specific strength σy/ρ (kN·m/kg)' : 'Young’s modulus (GPa)';
    const out=outcome([
      R('Materials passing all filters', passing.length, `of ${rows.length}`),
      R('Best ranked passing material', passing[0] ? passing[0].name : 'None', ''),
      R('Dataset note', 'Typical educational values; verify design data', '')],
      { table:{ columns:['Material','E (GPa)','Density (kg/m³)','Yield/ref. (MPa)','E/ρ (MN·m/kg)','σy/ρ (kN·m/kg)','Filter'],
                rows: rows.map(m=>[m.name,m.E,m.rho,m.sy,m.specE,m.specS,m.pass?'PASS':'—']) },
        plot:{ type:'scatter', title:'Ashby-style screening plot', xLabel:'Density ρ (kg/m³)', yLabel, logX:true, logY:true,
               points: rows.map(m=>({x:m.rho,y:yVal(m),label:m.name,pass:m.pass})) } });
    if(!passing.length) out.warnings.push('No built-in material passes all filters. Relax one constraint or expand the verified dataset.');
    out.warnings.push('Concrete and some brittle/composite “yield” entries are reference strengths for screening only; do not use them as allowable design values.');
    return out;
  });
})(globalThis);
