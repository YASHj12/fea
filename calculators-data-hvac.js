// FORM / FEA calculators — HVAC catalog metadata.
(function (root) {
  'use strict';
  const U = root.CalcUnits;
  const N = (key, label, def, unit, extra = {}) => ({ key, label, type: 'number', default: def, ...(Array.isArray(unit) ? { units: unit } : { unit }), ...extra });
  const S = (key, label, def, options, extra = {}) => ({ key, label, type: 'select', default: def, options, ...extra });
  const C = def => root.CALCULATORS.push(def);

  C({ id: 'cooling-load', category: 'hvac', name: 'Cooling Load Calculator', icon: 'Qc',
    purpose: 'Build a transparent sensible cooling-load estimate from envelope, people, equipment, window and ventilation terms.',
    formula: 'Qtotal = Qenvelope + Qpeople + Qequipment + Qwindow + Qventilation', ref: 'https://tensorcalculator.com/cooling-load-calculator', tags: 'hvac cooling load room sensible ton refrigeration',
    checks: 'A screening estimate, not an hourly building-load model. Solar orientation, latent load, thermal mass and schedules can change the result.',
    inputs: [ N('roomArea', 'Room/envelope area used for conduction', 50, U.areaM2), N('envelopeU', 'Average envelope U-value', 1.2, U.heatFluxCoeff),
      N('deltaT', 'Outdoor–indoor temperature difference', 12, U.tempDiffK), N('people', 'Number of people', 6, 'people'),
      N('peopleWatts', 'Heat per person', 120, U.powerW), N('appliances', 'Equipment/appliance heat', 800, U.powerW),
      N('windowArea', 'Window area', 8, U.areaM2), N('solarFactor', 'Window solar gain factor', 180, 'W/m²'),
      N('ventilation', 'Ventilation rate', 300, U.flowM3h), N('safety', 'Design allowance', 10, U.percent) ] });

  C({ id: 'heating-load', category: 'hvac', name: 'Heating Load Calculator', icon: 'Qh',
    purpose: 'Estimate heating demand from envelope UA loss plus ventilation/infiltration sensible loss and a design allowance.',
    formula: 'Q ≈ ΣUAΔT + ρcpQvΔT', ref: 'https://tensorcalculator.com/heating-load-calculator', tags: 'hvac heating load u value infiltration',
    checks: 'Confirm design weather, thermal bridges, infiltration path, warm-up strategy and any internal gains credited in code calculations.',
    inputs: [ N('envelopeArea', 'Total envelope area', 180, U.areaM2), N('uValue', 'Average U-value', .55, U.heatFluxCoeff),
      N('indoorTemp', 'Indoor design temperature', 21, U.tempC), N('outdoorTemp', 'Outdoor design temperature', -3, U.tempC),
      N('ventilation', 'Ventilation + infiltration airflow', 180, U.flowM3h), N('safety', 'Design allowance', 10, U.percent) ] });

  C({ id: 'psychrometric', category: 'hvac', name: 'Psychrometric Calculator', icon: 'ω',
    purpose: 'Calculate moist-air vapour pressure, humidity ratio, dew point, wet-bulb estimate, enthalpy and specific volume.',
    formula: 'w = 0.622Pv/(P−Pv) · h = 1.006T + w(2501 + 1.86T) kJ/kg dry air', ref: 'https://tensorcalculator.com/psychrometric-calculator', tags: 'psychrometric humidity enthalpy dew point wet bulb moist air',
    checks: 'Wet-bulb uses a common approximation for screening. Barometric pressure materially changes humidity ratio and density.',
    inputs: [ N('dryBulb', 'Dry-bulb temperature', 30, U.tempC), N('relativeHumidity', 'Relative humidity', 55, U.percent),
      N('pressure', 'Barometric pressure', 101.325, U.pressureKpa) ] });

  C({ id: 'duct-sizing', category: 'hvac', name: 'Duct Sizing Calculator', icon: '▭',
    purpose: 'Size a round duct diameter, or a rectangular duct width for a chosen height, from airflow and target velocity.',
    formula: 'Q = VA · round A = πD²/4 · Dh = 4A/P', ref: 'https://tensorcalculator.com/duct-sizing-calculator', tags: 'duct sizing velocity airflow round rectangular',
    checks: 'Check noise, actual standard duct sizes, aspect ratio, fittings, leakage and pressure balance after first-pass sizing.',
    inputs: [ S('shape', 'Duct shape', 'round', ['round', 'rectangular']), N('flow', 'Airflow rate Q', .85, U.flowM3s),
      N('targetVelocity', 'Target velocity', 6, U.velocity), N('rectHeight', 'Rectangular duct height (if rectangular)', .3, U.lengthM) ] });

  C({ id: 'duct-pressure-drop', category: 'hvac', name: 'Duct Pressure Drop Calculator', icon: 'Δp',
    purpose: 'Estimate straight round-duct velocity, Reynolds number, Haaland friction factor and Darcy–Weisbach pressure loss.',
    formula: 'Δp = f(L/D)(ρV²/2) · V = Q/A', ref: 'https://tensorcalculator.com/duct-pressure-drop-calculator', tags: 'duct darcy friction pressure drop airflow',
    checks: 'Straight-duct friction only. Add elbows, branches, dampers, transitions, filters, coils and terminals separately.',
    inputs: [ N('flow', 'Airflow rate Q', .85, U.flowM3s), N('diameter', 'Duct diameter D', .45, U.lengthM),
      N('length', 'Duct length L', 25, U.lengthM), N('density', 'Air density ρ', 1.2, U.density),
      N('viscosity', 'Air viscosity μ', 1.81e-5, U.dynViscosity), N('roughness', 'Duct roughness ε', .09, U.lengthMm) ] });

  C({ id: 'airflow-cfm-converter', category: 'hvac', name: 'Airflow CFM Calculator', icon: 'CFM',
    purpose: 'Convert volumetric airflow among m³/s, m³/h, L/s, CFM and US gpm-equivalent volume rate.',
    formula: '1 m³/s = 1000 L/s ≈ 2118.88 CFM', ref: 'https://tensorcalculator.com/airflow-cfm-calculator', tags: 'airflow conversion cfm litres second cubic metre',
    checks: 'Conversion only; it does not determine delivered airflow or account for density changes between actual and standard conditions.',
    inputs: [ N('flow', 'Airflow value', 1200, U.flowM3s, { defaultUnit: 'CFM' }) ] });

  C({ id: 'fan-static-pressure', category: 'hvac', name: 'Fan Static Pressure Calculator', icon: 'Fan',
    purpose: 'Add duct, fitting, filter, coil and equipment pressure losses into a required fan static-pressure estimate.',
    formula: 'Δptotal ≈ ΣΔplosses × (1 + allowance)', ref: 'https://tensorcalculator.com/fan-static-pressure-calculator', tags: 'fan static pressure duct losses filter coil',
    checks: 'Compare with the manufacturer fan curve at the actual airflow and air density. Do not simply add unrelated catalogue maxima.',
    inputs: [ N('straightDuct', 'Straight duct loss', 85, U.pressurePa), N('fittings', 'Fittings/transitions loss', 55, U.pressurePa),
      N('filter', 'Filter loss (design/dirty)', 120, U.pressurePa), N('coil', 'Coil loss', 90, U.pressurePa),
      N('equipment', 'Equipment/terminal loss', 70, U.pressurePa), N('other', 'Other losses', 25, U.pressurePa),
      N('safety', 'Allowance', 10, U.percent) ] });

  C({ id: 'hvac-pump-head', category: 'hvac', name: 'Pump Head Calculator', icon: 'Hp',
    purpose: 'Combine net static head and HVAC water-side pressure losses into total pump head and equivalent pressure.',
    formula: 'Htotal = Hstatic + Δptotal/(ρg)', ref: 'https://tensorcalculator.com/hvac-pump-head-calculator', tags: 'pump head hvac pipe coil hydronic',
    checks: 'Closed loops may have near-zero net static head. Use the index circuit/system curve and pump curve for selection.',
    inputs: [ N('staticHead', 'Net static head', 0, U.lengthM), N('pipeLoss', 'Pipe friction loss', 45, U.pressureKpa),
      N('valveFittingLoss', 'Valves/fittings loss', 30, U.pressureKpa), N('coilLoss', 'Coil loss', 35, U.pressureKpa),
      N('equipmentLoss', 'Equipment loss', 50, U.pressureKpa), N('otherLoss', 'Other losses', 10, U.pressureKpa),
      N('density', 'Fluid density ρ', 998, U.density), N('safety', 'Allowance on friction losses', 10, U.percent) ] });

  C({ id: 'chilled-water-pipe-sizing', category: 'hvac', name: 'Chilled Water Pipe Sizing Calculator', icon: 'CHW',
    purpose: 'Find theoretical inside diameter from flow and target velocity, then check a selected actual diameter for velocity and pressure drop.',
    formula: 'Q = VA · Δp = f(L/D)(ρV²/2)', ref: 'https://tensorcalculator.com/chilled-water-pipe-calculator', tags: 'chilled water pipe sizing velocity pressure drop',
    checks: 'Use actual pipe inside diameter, fluid/glycol properties at temperature, noise/erosion limits and balancing requirements.',
    inputs: [ N('flow', 'Design flow Q', 12, U.flowM3s, { defaultUnit: 'L/s' }), N('targetVelocity', 'Target velocity', 1.5, U.velocity),
      N('selectedDiameter', 'Selected actual inside diameter', 102, U.lengthMm), N('length', 'Straight length for pressure check', 60, U.lengthM),
      N('density', 'Fluid density ρ', 999, U.density), N('viscosity', 'Dynamic viscosity μ', .0013, U.dynViscosity), N('roughness', 'Pipe roughness ε', .045, U.lengthMm) ] });

  C({ id: 'refrigeration-cop', category: 'hvac', name: 'Refrigeration Cycle COP Calculator', icon: 'COP',
    purpose: 'Calculate refrigeration COP from capacity and power, or from vapour-compression cycle enthalpies.',
    formula: 'COPR = QL/Win · enthalpy form: (h1−h4)/(h2−h1)', ref: 'https://tensorcalculator.com/refrigeration-cycle-cop-calculator', tags: 'refrigeration cop compressor enthalpy cooling',
    checks: 'Compare only at matching evaporating/condensing conditions. Real systems include pressure drops, superheat, subcooling, motor and fan power.',
    inputs: [ S('method', 'Input method', 'capacityPower', ['capacityPower', 'enthalpies']),
      N('coolingCapacity', 'Cooling capacity QL', 35, U.powerKw), N('compressorPower', 'Compressor/input power Win', 9, U.powerKw),
      N('h1', 'h1 compressor inlet', 405, 'kJ/kg'), N('h2', 'h2 compressor outlet', 435, 'kJ/kg'),
      N('h3', 'h3 expansion-valve inlet', 255, 'kJ/kg'), N('massFlow', 'Refrigerant mass flow (optional)', .22, 'kg/s') ] });

  C({ id: 'ton-of-refrigeration', category: 'hvac', name: 'Ton of Refrigeration Calculator', icon: 'TR',
    purpose: 'Convert cooling capacity among tons of refrigeration, kW, W and Btu/h.',
    formula: '1 TR ≈ 3.51685 kW ≈ 12,000 Btu/h', ref: 'https://tensorcalculator.com/ton-of-refrigeration-calculator', tags: 'ton refrigeration tr btu kw conversion',
    checks: 'Capacity conversion only; it does not calculate a building cooling load.',
    inputs: [ N('capacity', 'Cooling capacity', 10, U.powerKw, { defaultUnit: 'TR' }) ] });

  C({ id: 'hvac-energy-consumption', category: 'hvac', name: 'HVAC Energy Consumption Calculator', icon: 'kWh',
    purpose: 'Estimate HVAC electrical energy and cost from average power, quantity, schedule, duty factor and tariff.',
    formula: 'E = P × quantity × hours/day × days × duty · Cost = E × tariff', ref: 'https://tensorcalculator.com/hvac-energy-consumption-calculator', tags: 'hvac energy kwh cost operating hours duty',
    checks: 'Use average operating power, not nameplate peak alone. Part-load controls, cycling, seasonality and demand charges can dominate bills.',
    inputs: [ N('power', 'Average power per unit', 3.5, U.powerKw), N('quantity', 'Quantity', 2, 'units', { step: 1 }),
      N('hoursPerDay', 'Operating hours per day', 10, 'h/day'), N('days', 'Days in period', 30, 'days'),
      N('duty', 'Duty/load factor', 65, U.percent), N('tariff', 'Electricity tariff', 9, 'currency/kWh') ] });

  C({ id: 'ventilation-air-requirement', category: 'hvac', name: 'Ventilation Air Requirement Calculator', icon: 'OA',
    purpose: 'Estimate outdoor airflow from combined people and area rates, adjusted by ventilation effectiveness, plus optional ACH.',
    formula: 'Q = (P·Rp + A·Ra)/Ev', ref: 'https://tensorcalculator.com/ventilation-air-requirement-calculator', tags: 'ventilation outdoor air occupancy area ASHRAE rate',
    checks: 'Rates and effectiveness must come from the applicable ventilation standard and occupancy classification.',
    inputs: [ N('people', 'Occupants', 40, 'people'), N('peopleRate', 'Rate per person Rp', 2.5, 'L/(s·person)'),
      N('area', 'Floor area', 200, U.areaM2), N('areaRate', 'Rate per area Ra', .3, 'L/(s·m²)'),
      N('effectiveness', 'Ventilation effectiveness Ev', 80, U.percent), N('roomVolume', 'Room volume for ACH (optional)', 600, U.volumeM3) ] });

  C({ id: 'fresh-air-sizing', category: 'hvac', name: 'Fresh Air Sizing Calculator', icon: 'FA',
    purpose: 'Size fresh air using people-only, area-only, combined or governing-maximum method, with ACH when volume is supplied.',
    formula: 'Qpeople = P·Rp · Qarea = A·Ra · methods: sum or maximum', ref: 'https://tensorcalculator.com/fresh-air-sizing-calculator', tags: 'fresh air sizing people area outdoor airflow ach',
    checks: 'This is a rate estimate. Room mixing, contaminant sources, pressurisation and diffuser effectiveness need separate checks.',
    inputs: [ S('method', 'Sizing method', 'maximum', ['people', 'area', 'combined', 'maximum']),
      N('people', 'Occupants', 25, 'people'), N('peopleRate', 'Rate per person', 5, 'L/(s·person)'),
      N('area', 'Floor area', 120, U.areaM2), N('areaRate', 'Rate per area', .6, 'L/(s·m²)'), N('roomVolume', 'Room volume for ACH (optional)', 360, U.volumeM3) ] });

  C({ id: 'relative-humidity', category: 'hvac', name: 'Relative Humidity Calculator', icon: 'RH%',
    purpose: 'Find relative humidity from dry-bulb/dew-point temperatures or from vapour and saturation pressures.',
    formula: 'RH = 100 × Pv/Psat(T)', ref: 'https://tensorcalculator.com/relative-humidity-calculator', tags: 'relative humidity dew point saturation vapor pressure',
    checks: 'Do not mix dry-bulb, wet-bulb and dew-point temperatures. Saturation pressure is evaluated at dry-bulb temperature.',
    inputs: [ S('method', 'Input method', 'dewPoint', ['dewPoint', 'vaporPressure']), N('dryBulb', 'Dry-bulb temperature', 30, U.tempC),
      N('dewPoint', 'Dew-point temperature', 18, U.tempC), N('vaporPressure', 'Actual vapour pressure Pv', 2.1, U.pressureKpa) ] });

  C({ id: 'dew-point', category: 'hvac', name: 'Dew Point Calculator', icon: 'Tdew',
    purpose: 'Calculate dew-point temperature from air temperature and relative humidity, plus the dew-point depression.',
    formula: 'Magnus saturation relation inverted from Pv = RH×Psat(T)', ref: 'https://tensorcalculator.com/dew-point-calculator', tags: 'dew point condensation humidity temperature',
    checks: 'Condensation occurs on surfaces at or below local dew point; surface temperature and thermal bridges still need checking.',
    inputs: [ N('dryBulb', 'Air temperature', 30, U.tempC), N('relativeHumidity', 'Relative humidity', 55, U.percent) ] });
})(globalThis);
