// FORM / FEA calculators — HVAC solvers. Inputs arrive in each field's declared base unit.
(function (root) {
  'use strict';
  const M = root.CalcMath;
  const { finite, positive, nonNegative, result: R, outcome, frictionFactor, flowRegime,
          saturationPressureKpa, dewPointFromVaporPressureKpa, wetBulbApproxC } = M;
  const S = (id, fn) => { root.CALC_SOLVERS[id] = fn; };

  S('cooling-load', v => {
    nonNegative(v.roomArea, 'Area'); nonNegative(v.envelopeU, 'U-value'); nonNegative(v.deltaT, 'ΔT');
    nonNegative(v.people, 'People'); nonNegative(v.appliances, 'Appliance heat'); nonNegative(v.windowArea, 'Window area'); nonNegative(v.ventilation, 'Ventilation');
    const envelope = v.roomArea * v.envelopeU * v.deltaT;
    const people = v.people * v.peopleWatts;
    const windowLoad = v.windowArea * v.solarFactor;
    const ventilation = (v.ventilation / 3600) * 1.2 * 1006 * v.deltaT;
    const subtotal = envelope + people + v.appliances + windowLoad + ventilation;
    const total = subtotal * (1 + nonNegative(v.safety, 'Allowance') / 100);
    const out = outcome([
      R('Total cooling load', total / 1000, 'kW'), R('Total cooling load', total / 3516.85, 'TR'),
      R('Envelope conduction', envelope, 'W'), R('People', people, 'W'), R('Equipment/appliances', v.appliances, 'W'),
      R('Window solar gain (factor model)', windowLoad, 'W'), R('Ventilation sensible load', ventilation, 'W'), R('Subtotal before allowance', subtotal, 'W')]);
    out.steps = ['Ventilation uses sensible load only: ρ ≈ 1.2 kg/m³ and cp ≈ 1006 J/(kg·K). Adjust the exposed U-value and solar factor to your building assumptions.'];
    return out;
  });

  S('heating-load', v => {
    nonNegative(v.envelopeArea, 'Envelope area'); nonNegative(v.uValue, 'U-value'); nonNegative(v.ventilation, 'Ventilation');
    const dT = v.indoorTemp - v.outdoorTemp;
    if (dT <= 0) throw new Error('Indoor design temperature must exceed outdoor design temperature for a positive heating load.');
    const envelope = v.envelopeArea * v.uValue * dT;
    const ventilation = (v.ventilation / 3600) * 1.2 * 1006 * dT;
    const total = (envelope + ventilation) * (1 + nonNegative(v.safety, 'Allowance') / 100);
    return outcome([
      R('Design temperature difference', dT, 'K'), R('Envelope loss ΣUAΔT', envelope, 'W'),
      R('Ventilation/infiltration sensible loss', ventilation, 'W'), R('Total heating load', total / 1000, 'kW'), R('Total heating load', total, 'W')]);
  });

  S('psychrometric', v => {
    finite(v.dryBulb, 'Dry-bulb temperature'); positive(v.pressure, 'Pressure');
    if (v.relativeHumidity < 0 || v.relativeHumidity > 100) throw new Error('Relative humidity must be between 0 and 100%.');
    const psat = saturationPressureKpa(v.dryBulb);
    const pv = v.relativeHumidity / 100 * psat;
    if (pv >= v.pressure) throw new Error('Vapour pressure must be below total pressure for a valid moist-air state.');
    const w = 0.621945 * pv / (v.pressure - pv);
    const dew = pv > 0 ? dewPointFromVaporPressureKpa(pv) : NaN;
    const h = 1.006 * v.dryBulb + w * (2501 + 1.86 * v.dryBulb);
    const Tkelvin = v.dryBulb + 273.15;
    const specificVolume = 287.042 * Tkelvin / (v.pressure * 1000) * (1 + 1.607858 * w); // m³ per kg dry air
    const density = (1 + w) / specificVolume;
    const wet = wetBulbApproxC(v.dryBulb, v.relativeHumidity);
    const out = outcome([
      R('Saturation vapour pressure', psat, 'kPa'), R('Actual vapour pressure', pv, 'kPa'),
      R('Humidity ratio', w * 1000, 'g/kg dry air'), R('Dew point', dew, '°C'),
      R('Wet-bulb temperature (approx.)', wet, '°C'), R('Enthalpy', h, 'kJ/kg dry air'),
      R('Specific volume', specificVolume, 'm³/kg dry air'), R('Moist-air density', density, 'kg/m³')]);
    out.warnings = ['Wet-bulb is the Stull screening approximation; use full psychrometric relations/software for final coil/process design.'];
    return out;
  });

  S('duct-sizing', v => {
    positive(v.flow, 'Airflow'); positive(v.targetVelocity, 'Target velocity');
    const area = v.flow / v.targetVelocity;
    if (v.shape === 'round') {
      const D = Math.sqrt(4 * area / Math.PI);
      return outcome([R('Required inside diameter', D * 1000, 'mm'), R('Flow area', area, 'm²'), R('Design velocity', v.targetVelocity, 'm/s'), R('Hydraulic diameter', D * 1000, 'mm')]);
    }
    positive(v.rectHeight, 'Rectangular height');
    const width = area / v.rectHeight;
    const perimeter = 2 * (width + v.rectHeight);
    const Dh = 4 * area / perimeter;
    const out = outcome([R('Required width at chosen height', width * 1000, 'mm'), R('Chosen height', v.rectHeight * 1000, 'mm'), R('Flow area', area, 'm²'), R('Hydraulic diameter', Dh * 1000, 'mm'), R('Aspect ratio width/height', width / v.rectHeight, '—')]);
    if (width / v.rectHeight > 4) out.warnings.push('Aspect ratio above about 4:1 is often inefficient for friction, leakage and space; consider a taller duct or multiple ducts.');
    return out;
  });

  S('duct-pressure-drop', v => {
    positive(v.flow, 'Airflow'); positive(v.diameter, 'Diameter'); nonNegative(v.length, 'Length');
    positive(v.density, 'Density'); positive(v.viscosity, 'Viscosity'); nonNegative(v.roughness, 'Roughness');
    const area = Math.PI * v.diameter ** 2 / 4, vel = v.flow / area;
    const Re = v.density * vel * v.diameter / v.viscosity;
    const f = frictionFactor(Re, (v.roughness / 1000) / v.diameter);
    const dp = f * (v.length / v.diameter) * v.density * vel * vel / 2;
    const out = outcome([
      R('Air velocity', vel, 'm/s'), R('Reynolds number', Re, '—'), R('Darcy friction factor', f, '—'),
      R('Pressure drop per metre', v.length > 0 ? dp / v.length : 0, 'Pa/m'), R('Total straight-duct pressure drop', dp, 'Pa')]);
    out.steps = [`Flow regime guide: ${flowRegime(Re)}. Turbulent friction uses the Haaland approximation with the entered roughness.`];
    return out;
  });

  S('airflow-cfm-converter', v => {
    nonNegative(v.flow, 'Airflow');
    return outcome([
      R('Airflow', v.flow, 'm³/s'), R('Airflow', v.flow * 3600, 'm³/h'), R('Airflow', v.flow * 1000, 'L/s'),
      R('Airflow', v.flow / 0.000471947, 'CFM'), R('Volumetric rate', v.flow / 0.0000630902, 'US gpm equivalent')]);
  });

  S('fan-static-pressure', v => {
    const fields = ['straightDuct','fittings','filter','coil','equipment','other'];
    fields.forEach(k => nonNegative(v[k], k));
    const subtotal = fields.reduce((sum, k) => sum + v[k], 0);
    const total = subtotal * (1 + nonNegative(v.safety, 'Allowance') / 100);
    return outcome([
      R('Required static pressure', total, 'Pa'), R('Required static pressure', total / 248.84, 'in. wg'),
      R('Required static pressure', total / 9.80665, 'mm wg'), R('Loss subtotal before allowance', subtotal, 'Pa')]);
  });

  S('hvac-pump-head', v => {
    finite(v.staticHead, 'Static head'); positive(v.density, 'Density');
    const fields = ['pipeLoss','valveFittingLoss','coilLoss','equipmentLoss','otherLoss'];
    fields.forEach(k => nonNegative(v[k], k));
    const frictionKpa = fields.reduce((sum, k) => sum + v[k], 0) * (1 + nonNegative(v.safety, 'Allowance') / 100);
    const frictionHead = frictionKpa * 1000 / (v.density * 9.80665);
    const total = v.staticHead + frictionHead;
    return outcome([
      R('Friction/equipment pressure after allowance', frictionKpa, 'kPa'), R('Friction head', frictionHead, 'm'),
      R('Total pump head', total, 'm'), R('Total pump head', total * 3.28084, 'ft'), R('Total equivalent pressure', total * v.density * 9.80665 / 1000, 'kPa')]);
  });

  S('chilled-water-pipe-sizing', v => {
    positive(v.flow, 'Flow'); positive(v.targetVelocity, 'Target velocity'); positive(v.selectedDiameter, 'Selected diameter');
    nonNegative(v.length, 'Length'); positive(v.density, 'Density'); positive(v.viscosity, 'Viscosity'); nonNegative(v.roughness, 'Roughness');
    const theoretical = Math.sqrt(4 * v.flow / (Math.PI * v.targetVelocity));
    const D = v.selectedDiameter / 1000;
    const area = Math.PI * D ** 2 / 4, vel = v.flow / area;
    const Re = v.density * vel * D / v.viscosity;
    const f = frictionFactor(Re, (v.roughness / 1000) / D);
    const dp = f * (v.length / D) * v.density * vel * vel / 2;
    return outcome([
      R('Theoretical diameter at target velocity', theoretical * 1000, 'mm'), R('Velocity in selected pipe', vel, 'm/s'),
      R('Reynolds number', Re, '—'), R('Darcy friction factor', f, '—'), R('Straight-pipe pressure drop', dp / 1000, 'kPa'),
      R('Pressure gradient', v.length > 0 ? dp / v.length : 0, 'Pa/m')]);
  });

  S('refrigeration-cop', v => {
    if (v.method === 'capacityPower') {
      nonNegative(v.coolingCapacity, 'Cooling capacity'); positive(v.compressorPower, 'Input power');
      const cop = v.coolingCapacity / v.compressorPower;
      return outcome([R('Refrigeration COP', cop, '—'), R('Equivalent heating COP (same energy balance)', cop + 1, '—'), R('Heat rejected', v.coolingCapacity + v.compressorPower, 'kW')]);
    }
    [v.h1, v.h2, v.h3].forEach(x => finite(x, 'Enthalpy'));
    const ql = v.h1 - v.h3, win = v.h2 - v.h1, qh = v.h2 - v.h3;
    if (win <= 0) throw new Error('Compressor specific work h2−h1 must be positive.');
    if (ql <= 0) throw new Error('Refrigerating effect h1−h4 (with h4=h3) must be positive; check state numbering.');
    const mf = nonNegative(v.massFlow, 'Mass flow');
    return outcome([
      R('Refrigeration COP', ql / win, '—'), R('Cooling capacity at mass flow', ql * mf, 'kW'),
      R('Compressor power at mass flow', win * mf, 'kW'), R('Heat rejected at mass flow', qh * mf, 'kW'),
      R('Specific refrigerating effect', ql, 'kJ/kg'), R('Specific compressor work', win, 'kJ/kg')]);
  });

  S('ton-of-refrigeration', v => {
    nonNegative(v.capacity, 'Capacity'); // canonical kW
    return outcome([R('Cooling capacity', v.capacity / 3.51685, 'TR'), R('Cooling capacity', v.capacity, 'kW'), R('Cooling capacity', v.capacity * 1000, 'W'), R('Cooling capacity', v.capacity * 3412.142, 'Btu/h')]);
  });

  S('hvac-energy-consumption', v => {
    nonNegative(v.power, 'Power'); nonNegative(v.quantity, 'Quantity'); nonNegative(v.hoursPerDay, 'Hours/day'); nonNegative(v.days, 'Days');
    if (v.duty < 0 || v.duty > 100) throw new Error('Duty factor must be between 0 and 100%.');
    const energy = v.power * v.quantity * v.hoursPerDay * v.days * (v.duty / 100);
    return outcome([
      R('Energy in period', energy, 'kWh'), R('Average energy per scheduled day', v.days > 0 ? energy / v.days : 0, 'kWh/day'),
      R('Electricity cost in period', energy * finite(v.tariff, 'Tariff'), 'currency'), R('Connected average load before duty', v.power * v.quantity, 'kW')]);
  });

  const ventilationOutcome = (litresPerSec, volume) => {
    const m3s = litresPerSec / 1000;
    const results = [R('Required outdoor airflow', litresPerSec, 'L/s'), R('Required outdoor airflow', m3s * 3600, 'm³/h'), R('Required outdoor airflow', m3s / 0.000471947, 'CFM')];
    if (volume > 0) results.push(R('Outdoor-air change rate', (m3s * 3600) / volume, 'ACH'));
    return outcome(results);
  };

  S('ventilation-air-requirement', v => {
    nonNegative(v.people, 'People'); nonNegative(v.peopleRate, 'People rate'); nonNegative(v.area, 'Area'); nonNegative(v.areaRate, 'Area rate');
    if (v.effectiveness <= 0 || v.effectiveness > 100) throw new Error('Ventilation effectiveness must be greater than 0 and no more than 100%.');
    const breathingZone = v.people * v.peopleRate + v.area * v.areaRate;
    const delivered = breathingZone / (v.effectiveness / 100);
    const out = ventilationOutcome(delivered, nonNegative(v.roomVolume, 'Room volume'));
    out.results.unshift(R('Breathing-zone outdoor air before Ev', breathingZone, 'L/s'));
    return out;
  });

  S('fresh-air-sizing', v => {
    nonNegative(v.people, 'People'); nonNegative(v.peopleRate, 'People rate'); nonNegative(v.area, 'Area'); nonNegative(v.areaRate, 'Area rate');
    const qp = v.people * v.peopleRate, qa = v.area * v.areaRate;
    const selected = v.method === 'people' ? qp : v.method === 'area' ? qa : v.method === 'combined' ? qp + qa : Math.max(qp, qa);
    const out = ventilationOutcome(selected, nonNegative(v.roomVolume, 'Room volume'));
    out.results.unshift(R('People-method flow', qp, 'L/s'), R('Area-method flow', qa, 'L/s'));
    out.steps = [`Selected method: ${v.method}.`];
    return out;
  });

  S('relative-humidity', v => {
    finite(v.dryBulb, 'Dry-bulb temperature');
    const psat = saturationPressureKpa(v.dryBulb);
    let pv;
    if (v.method === 'dewPoint') {
      finite(v.dewPoint, 'Dew point');
      if (v.dewPoint > v.dryBulb + 1e-9) throw new Error('Dew point cannot exceed dry-bulb temperature for unsaturated/saturated air.');
      pv = saturationPressureKpa(v.dewPoint);
    } else pv = positive(v.vaporPressure, 'Vapour pressure');
    const rh = pv / psat * 100;
    if (rh > 100.5) throw new Error('Inputs imply RH above 100%; check vapour pressure and temperature.');
    return outcome([R('Relative humidity', rh, '%'), R('Saturation pressure at dry bulb', psat, 'kPa'), R('Actual vapour pressure', pv, 'kPa'), R('Dew point', dewPointFromVaporPressureKpa(pv), '°C')]);
  });

  S('dew-point', v => {
    finite(v.dryBulb, 'Air temperature');
    if (v.relativeHumidity <= 0 || v.relativeHumidity > 100) throw new Error('Relative humidity must be greater than 0 and no more than 100%.');
    const pv = v.relativeHumidity / 100 * saturationPressureKpa(v.dryBulb);
    const dew = dewPointFromVaporPressureKpa(pv);
    return outcome([R('Dew-point temperature', dew, '°C'), R('Dew-point depression (T − Tdew)', v.dryBulb - dew, 'K'), R('Actual vapour pressure', pv, 'kPa')]);
  });
})(globalThis);
