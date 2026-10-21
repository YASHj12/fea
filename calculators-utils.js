// FORM / FEA calculators — shared units, validation, math helpers and registries.
(function (root) {
  'use strict';

  root.CALCULATOR_CATEGORIES = [];
  root.CALCULATORS = [];
  root.CALC_SOLVERS = {};

  const U = (label, factor, offset = 0) => ({ label, factor, offset });
  root.CalcUnits = {
    pressurePa: [U('Pa', 1), U('kPa', 1e3), U('MPa', 1e6), U('bar', 1e5), U('atm', 101325), U('psi', 6894.757)],
    pressureKpa: [U('kPa', 1), U('Pa', 0.001), U('bar', 100), U('atm', 101.325), U('psi', 6.894757)],
    lengthM: [U('m', 1), U('mm', 0.001), U('cm', 0.01), U('in', 0.0254), U('ft', 0.3048)],
    lengthMm: [U('mm', 1), U('cm', 10), U('m', 1000), U('in', 25.4)],
    areaM2: [U('m²', 1), U('cm²', 1e-4), U('mm²', 1e-6), U('ft²', 0.09290304), U('in²', 0.00064516)],
    areaMm2: [U('mm²', 1), U('cm²', 100), U('m²', 1e6), U('in²', 645.16)],
    volumeM3: [U('m³', 1), U('L', 0.001), U('cm³', 1e-6), U('ft³', 0.0283168), U('gal (US)', 0.00378541)],
    flowM3s: [U('m³/s', 1), U('m³/h', 1 / 3600), U('L/s', 0.001), U('CFM', 0.000471947), U('gpm (US)', 0.0000630902)],
    flowM3h: [U('m³/h', 1), U('m³/s', 3600), U('L/s', 3.6), U('CFM', 1.69901)],
    velocity: [U('m/s', 1), U('km/h', 1 / 3.6), U('ft/s', 0.3048), U('mph', 0.44704)],
    tempC: [U('°C', 1), U('K', 1, -273.15), U('°F', 5 / 9, -32)],
    tempK: [U('K', 1), U('°C', 1, 273.15), U('°F', 5 / 9, 459.67)],
    tempDiffK: [U('K / °C', 1), U('°F', 5 / 9)],
    powerW: [U('W', 1), U('kW', 1000), U('hp', 745.699872), U('Btu/h', 0.29307107)],
    powerKw: [U('kW', 1), U('W', 0.001), U('hp', 0.745699872), U('TR', 3.51685)],
    forceN: [U('N', 1), U('kN', 1000), U('MN', 1e6), U('kgf', 9.80665), U('lbf', 4.4482216)],
    torqueNm: [U('N·m', 1), U('kN·m', 1000), U('N·mm', 0.001), U('lbf·ft', 1.3558179)],
    momentNm: [U('N·m', 1), U('kN·m', 1000), U('N·mm', 0.001), U('lbf·ft', 1.3558179)],
    stressMpa: [U('MPa', 1), U('Pa', 1e-6), U('kPa', 0.001), U('GPa', 1000), U('psi', 0.00689476), U('ksi', 6.89476)],
    modulusGpa: [U('GPa', 1), U('MPa', 0.001), U('Pa', 1e-9), U('psi', 6.89476e-6)],
    density: [U('kg/m³', 1), U('g/cm³', 1000), U('lb/ft³', 16.0184634)],
    dynViscosity: [U('Pa·s', 1), U('mPa·s', 0.001), U('cP', 0.001), U('kg/(m·s)', 1)],
    kinViscosity: [U('m²/s', 1), U('mm²/s (cSt)', 1e-6), U('St', 1e-4)],
    massKg: [U('kg', 1), U('g', 0.001), U('t', 1000), U('lb', 0.45359237)],
    angleDeg: [U('degree', 1), U('radian', 57.2957795)],
    inertiaM4: [U('m⁴', 1), U('cm⁴', 1e-8), U('mm⁴', 1e-12), U('in⁴', 4.162314e-7)],
    inertiaMm4: [U('mm⁴', 1), U('cm⁴', 1e4), U('m⁴', 1e12), U('in⁴', 416231.4)],
    heatFluxCoeff: [U('W/(m²·K)', 1), U('kW/(m²·K)', 1000), U('Btu/(h·ft²·°F)', 5.678263)],
    conductivity: [U('W/(m·K)', 1), U('kW/(m·K)', 1000), U('Btu/(h·ft·°F)', 1.7307347)],
    percent: [U('%', 1), U('fraction', 100)],
  };

  const finite = (v, label) => {
    if (!Number.isFinite(v)) throw new Error(`${label || 'An input'} must be a valid number.`);
    return v;
  };
  const positive = (v, label) => {
    finite(v, label);
    if (v <= 0) throw new Error(`${label} must be greater than zero.`);
    return v;
  };
  const nonNegative = (v, label) => {
    finite(v, label);
    if (v < 0) throw new Error(`${label} cannot be negative.`);
    return v;
  };
  const result = (label, value, unit = '', note = '') => ({ label, value, unit, note });
  const outcome = (results, extra = {}) => ({ results, warnings: [], steps: [], ...extra });
  const parseList = (text, label) => {
    const vals = String(text || '').split(/[\s,;]+/).filter(Boolean).map(Number);
    if (!vals.length || vals.some(v => !Number.isFinite(v))) throw new Error(`${label} must be a list of numbers separated by commas or spaces.`);
    return vals;
  };

  function frictionFactor(Re, relativeRoughness = 0) {
    positive(Re, 'Reynolds number');
    if (Re < 2300) return 64 / Re;
    const rr = Math.max(0, relativeRoughness || 0);
    const haaland = Math.pow(-1.8 * Math.log10(Math.pow(rr / 3.7, 1.11) + 6.9 / Re), -2);
    if (Re <= 4000) {
      const laminarAt2300 = 64 / 2300;
      const t = (Re - 2300) / 1700;
      return laminarAt2300 + t * (haaland - laminarAt2300);
    }
    return haaland;
  }

  function flowRegime(Re) {
    if (Re < 2300) return 'Laminar (internal-flow guide)';
    if (Re <= 4000) return 'Transitional (internal-flow guide)';
    return 'Turbulent (internal-flow guide)';
  }

  function saturationPressureKpa(tempC) {
    finite(tempC, 'Temperature');
    return 0.61094 * Math.exp((17.625 * tempC) / (tempC + 243.04));
  }
  function dewPointFromVaporPressureKpa(pv) {
    positive(pv, 'Vapour pressure');
    const a = Math.log(pv / 0.61094);
    return (243.04 * a) / (17.625 - a);
  }
  function wetBulbApproxC(tempC, rhPercent) {
    // Stull approximation; appropriate for common HVAC screening ranges.
    const T = tempC, R = rhPercent;
    return T * Math.atan(0.151977 * Math.sqrt(R + 8.313659)) + Math.atan(T + R) - Math.atan(R - 1.676331)
      + 0.00391838 * Math.pow(R, 1.5) * Math.atan(0.023101 * R) - 4.686035;
  }

  function determinant3(m) {
    return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
      - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
      + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  }

  function eigenSymmetric3(input) {
    const a = input.map(row => row.slice());
    const v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    for (let sweep = 0; sweep < 100; sweep++) {
      let p = 0, q = 1, max = Math.abs(a[0][1]);
      if (Math.abs(a[0][2]) > max) { p = 0; q = 2; max = Math.abs(a[0][2]); }
      if (Math.abs(a[1][2]) > max) { p = 1; q = 2; max = Math.abs(a[1][2]); }
      const scale = Math.max(1, Math.abs(a[0][0]), Math.abs(a[1][1]), Math.abs(a[2][2]));
      if (max < 1e-12 * scale) break;
      const app = a[p][p], aqq = a[q][q], apq = a[p][q];
      const phi = 0.5 * Math.atan2(2 * apq, aqq - app);
      const c = Math.cos(phi), s = Math.sin(phi);
      for (let k = 0; k < 3; k++) {
        const akp = a[k][p], akq = a[k][q];
        a[k][p] = c * akp - s * akq;
        a[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < 3; k++) {
        const apk = a[p][k], aqk = a[q][k];
        a[p][k] = c * apk - s * aqk;
        a[q][k] = s * apk + c * aqk;
      }
      for (let k = 0; k < 3; k++) {
        const vkp = v[k][p], vkq = v[k][q];
        v[k][p] = c * vkp - s * vkq;
        v[k][q] = s * vkp + c * vkq;
      }
    }
    const pairs = [0, 1, 2].map(i => {
      const vector = [v[0][i], v[1][i], v[2][i]];
      const n = Math.hypot(...vector) || 1;
      const norm = vector.map(x => x / n);
      const major = norm.reduce((best, x, idx) => Math.abs(x) > Math.abs(norm[best]) ? idx : best, 0);
      return { value: a[i][i], vector: norm[major] < 0 ? norm.map(x => -x) : norm };
    }).sort((x, y) => y.value - x.value);
    return pairs;
  }

  function formatNumber(value) {
    if (!Number.isFinite(value)) return '—';
    if (value === 0) return '0';
    const abs = Math.abs(value);
    if (abs >= 1e9 || abs < 1e-4) return value.toExponential(5);
    if (abs >= 1000) return value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
    if (abs >= 100) return value.toFixed(2);
    if (abs >= 1) return value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
    return value.toPrecision(5).replace(/0+$/, '').replace(/\.$/, '');
  }

  root.CalcMath = {
    finite, positive, nonNegative, result, outcome, parseList,
    frictionFactor, flowRegime, saturationPressureKpa, dewPointFromVaporPressureKpa,
    wetBulbApproxC, determinant3, eigenSymmetric3, formatNumber,
    R: result,
  };
})(globalThis);
