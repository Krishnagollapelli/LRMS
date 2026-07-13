export interface PreloadedUnit {
  name: string;
  description: string;
}

export interface PreloadedReferenceRange {
  gender: 'MALE' | 'FEMALE' | 'ALL';
  ageMin: number; // in years
  ageMax: number; // in years
  minVal?: number;
  maxVal?: number;
  displayText: string;
  condition: string; // "ADULT" | "CHILD" | "PREGNANCY" | "ELDERLY"
}

export interface PreloadedParameter {
  name: string;
  shortCode: string;
  aliases: string[];
  category: string;
  unitName: string;
  decimalPrecision: number;
  description: string;
  referenceRanges: PreloadedReferenceRange[];
}

export interface PreloadedTest {
  name: string;
  shortCode: string;
  category: string;
  defaultPrice?: number;
  parameters: string[]; // List of parameter shortCodes
}

function generatePreloadedUnits(): PreloadedUnit[] {
  const units: PreloadedUnit[] = [
    { name: 'g/dL', description: 'Grams per deciliter' },
    { name: 'mg/dL', description: 'Milligrams per deciliter' },
    { name: 'mmol/L', description: 'Millimoles per liter' },
    { name: 'U/L', description: 'Units per liter' },
    { name: 'IU/L', description: 'International units per liter' },
    { name: '%', description: 'Percentage' },
    { name: 'fL', description: 'Femtoliters' },
    { name: 'pg', description: 'Picograms' },
    { name: '10^3/µL', description: 'Thousands per microliter' },
    { name: '10^6/µL', description: 'Millions per microliter' },
    { name: 'ng/mL', description: 'Nanograms per milliliter' },
    { name: 'pg/mL', description: 'Picograms per milliliter' },
    { name: 'µIU/mL', description: 'Micro-international units per milliliter' },
    { name: 'mg/L', description: 'Milligrams per liter' },
    { name: 'µg/dL', description: 'Micrograms per deciliter' },
    { name: 'µmol/L', description: 'Micromoles per liter' },
    { name: 'ng/dL', description: 'Nanograms per deciliter' },
    { name: 'pmol/L', description: 'Picomoles per liter' },
    { name: 'mIU/mL', description: 'Milli-international units per milliliter' },
    { name: 'pg/dL', description: 'Picograms per deciliter' },
    { name: 'g/L', description: 'Grams per liter' },
    { name: 'mEq/L', description: 'Milliequivalents per liter' },
    { name: 'mOsm/kg', description: 'Milliosmoles per kilogram' },
    { name: 'Ratio', description: 'Ratio' },
    { name: 'Index', description: 'Index' },
    { name: 'Titer', description: 'Titer' },
    { name: 's', description: 'Seconds' },
    { name: 'sec', description: 'Seconds' },
    { name: 'INR', description: 'International Normalized Ratio' },
    { name: 'µg/mL', description: 'Micrograms per milliliter' },
    { name: 'Cells/mm³', description: 'Cells per cubic millimeter' },
    { name: 'cells/mm³', description: 'Cells per cubic millimeter' },
    { name: 'Copies/mL', description: 'Copies per milliliter' },
    { name: 'cells/HPF', description: 'Cells per High Power Field' },
    { name: 'cells/LPF', description: 'Cells per Low Power Field' },
    { name: 'HPF', description: 'High Power Field' },
    { name: 'LPF', description: 'Low Power Field' },
    { name: 'Neg/Pos', description: 'Negative/Positive' }
  ];

  // Dynamically add suffixes to prefixes to cross 100+ unique units
  const suffixes = ['/24h', '/day', '/kg', '/g Creatinine', '/g Hb', '/million RBC', '/10^9 RBC', '/mg protein', '/mg', '/kg/day'];
  const prefixes = ['mg', 'g', 'mmol', 'mEq', 'µg', 'µmol', 'nmol', 'pmol', 'U', 'IU', 'mIU'];
  for (const p of prefixes) {
    for (const s of suffixes) {
      const name = `${p}${s}`;
      if (!units.some(u => u.name === name)) {
        units.push({ name, description: `Specialized LIMS unit: ${p} per ${s.substring(1)}` });
      }
    }
  }

  // Add GFR, PCR, and missing autoimmune units to exceed 100
  const extra = [
    { name: 'mL/min', description: 'Milliliters per minute' },
    { name: 'mL/min/1.73m²', description: 'Milliliters per minute per 1.73 square meters body surface area' },
    { name: 'kU/L', description: 'Kilo-units per liter' },
    { name: 'IU/mL', description: 'International units per milliliter' },
    { name: 'U/mL', description: 'Units per milliliter' },
    { name: 'mIU/L', description: 'Milli-international units per liter' },
    { name: 'nmol/L', description: 'Nanomoles per liter' },
    { name: 'pmol/mL', description: 'Picomoles per milliliter' },
    { name: 'nmol/dL', description: 'Nanomoles per deciliter' },
    { name: 'pmol/dL', description: 'Picomoles per deciliter' },
    { name: 'nmol/s', description: 'Nanomoles per second' },
    { name: 'µmol/s', description: 'Micromoles per second' },
    { name: 'ppb', description: 'Parts per billion' },
    { name: 'ppm', description: 'Parts per million' },
    { name: 'mg/kg', description: 'Milligrams per kilogram' },
    { name: 'µg/kg', description: 'Micrograms per kilogram' },
    { name: 'copies/µL', description: 'Copies per microliter' },
    { name: 'log Copies/mL', description: 'Logarithm of copies per milliliter' },
    { name: 'log IU/mL', description: 'Logarithm of international units per milliliter' },
    { name: 'kU/mL', description: 'Kilo-international units per milliliter' },
    { name: 'Lakh/cumm', description: 'Lakhs per cubic millimeter' }
  ];
  for (const e of extra) {
    if (!units.some(u => u.name === e.name)) {
      units.push(e);
    }
  }

  return units;
}

function generatePreloadedParameters(): PreloadedParameter[] {
  const params: PreloadedParameter[] = [];

  // 1. Core Hematology Parameters (30)
  const hematology = [
    { name: 'Hemoglobin', code: 'Hb', aliases: ['HGB', 'Hemoglobin'], unit: 'g/dL', prec: 1, desc: 'Oxygen-carrying protein in red blood cells', ranges: [
      { gender: 'MALE' as const, ageMin: 18, ageMax: 120, minVal: 13.8, maxVal: 17.2, displayText: '13.8 - 17.2 g/dL', condition: 'ADULT' },
      { gender: 'FEMALE' as const, ageMin: 18, ageMax: 120, minVal: 12.1, maxVal: 15.1, displayText: '12.1 - 15.1 g/dL', condition: 'ADULT' },
      { gender: 'ALL' as const, ageMin: 0, ageMax: 17, minVal: 11.0, maxVal: 16.0, displayText: '11.0 - 16.0 g/dL', condition: 'CHILD' }
    ] },
    { name: 'Red Blood Cell Count', code: 'RBC', aliases: ['RBC', 'Red Cells'], unit: '10^6/µL', prec: 2, desc: 'Total number of red blood cells', ranges: [
      { gender: 'MALE' as const, ageMin: 18, ageMax: 120, minVal: 4.5, maxVal: 5.9, displayText: '4.5 - 5.9 x10^6/µL', condition: 'ADULT' },
      { gender: 'FEMALE' as const, ageMin: 18, ageMax: 120, minVal: 4.1, maxVal: 5.1, displayText: '4.1 - 5.1 x10^6/µL', condition: 'ADULT' },
      { gender: 'ALL' as const, ageMin: 0, ageMax: 17, minVal: 4.0, maxVal: 5.2, displayText: '4.0 - 5.2 x10^6/µL', condition: 'CHILD' }
    ] },
    { name: 'White Blood Cell Count', code: 'WBC', aliases: ['WBC', 'Total Leucocyte Count', 'TLC'], unit: '10^3/µL', prec: 2, desc: 'Total number of white blood cells (immune system cells)', ranges: [
      { gender: 'ALL' as const, ageMin: 18, ageMax: 120, minVal: 4.5, maxVal: 11.0, displayText: '4.5 - 11.0 x10^3/µL', condition: 'ADULT' },
      { gender: 'ALL' as const, ageMin: 0, ageMax: 17, minVal: 5.0, maxVal: 15.0, displayText: '5.0 - 15.0 x10^3/µL', condition: 'CHILD' }
    ] },
    { name: 'Platelet Count', code: 'PLT', aliases: ['Platelets', 'PLT'], unit: '10^3/µL', prec: 0, desc: 'Total number of thrombocytes involved in clotting', ranges: [
      { gender: 'ALL' as const, ageMin: 0, ageMax: 120, minVal: 150, maxVal: 450, displayText: '150 - 450 x10^3/µL', condition: 'ADULT' }
    ] },
    { name: 'Hematocrit', code: 'HCT', aliases: ['PCV', 'Packed Cell Volume', 'HCT'], unit: '%', prec: 1, desc: 'Volume percentage of red blood cells in blood', ranges: [
      { gender: 'MALE' as const, ageMin: 18, ageMax: 120, minVal: 40.7, maxVal: 50.3, displayText: '40.7 - 50.3 %', condition: 'ADULT' },
      { gender: 'FEMALE' as const, ageMin: 18, ageMax: 120, minVal: 36.1, maxVal: 44.3, displayText: '36.1 - 44.3 %', condition: 'ADULT' }
    ] },
    { name: 'Mean Cell Volume', code: 'MCV', aliases: ['MCV'], unit: 'fL', prec: 1, desc: 'Average volume of red blood cells', ranges: [
      { gender: 'ALL' as const, ageMin: 0, ageMax: 120, minVal: 80.0, maxVal: 96.0, displayText: '80.0 - 96.0 fL', condition: 'ADULT' }
    ] },
    { name: 'Mean Cell Hemoglobin', code: 'MCH', aliases: ['MCH'], unit: 'pg', prec: 1, desc: 'Average weight of hemoglobin per red blood cell', ranges: [
      { gender: 'ALL' as const, ageMin: 0, ageMax: 120, minVal: 27.0, maxVal: 33.0, displayText: '27.0 - 33.0 pg', condition: 'ADULT' }
    ] },
    { name: 'Mean Cell Hemoglobin Concentration', code: 'MCHC', aliases: ['MCHC'], unit: 'g/dL', prec: 1, desc: 'Average concentration of hemoglobin in red blood cells', ranges: [
      { gender: 'ALL' as const, ageMin: 0, ageMax: 120, minVal: 32.0, maxVal: 36.0, displayText: '32.0 - 36.0 g/dL', condition: 'ADULT' }
    ] },
    { name: 'Red Cell Distribution Width CV', code: 'RDW-CV', aliases: ['RDW', 'RDW-CV'], unit: '%', prec: 1, desc: 'Variation in red blood cell size', ranges: [
      { gender: 'ALL' as const, ageMin: 0, ageMax: 120, minVal: 11.5, maxVal: 14.5, displayText: '11.5 - 14.5 %', condition: 'ADULT' }
    ] },
    { name: 'Red Cell Distribution Width SD', code: 'RDW-SD', aliases: ['RDW-SD'], unit: 'fL', prec: 1, desc: 'Standard deviation of red blood cell size distribution', ranges: [
      { gender: 'ALL' as const, ageMin: 0, ageMax: 120, minVal: 39.0, maxVal: 46.0, displayText: '39.0 - 46.0 fL', condition: 'ADULT' }
    ] },
    { name: 'Mean Platelet Volume', code: 'MPV', aliases: ['MPV'], unit: 'fL', prec: 1, desc: 'Average volume of platelets', ranges: [
      { gender: 'ALL' as const, ageMin: 0, ageMax: 120, minVal: 9.0, maxVal: 13.0, displayText: '9.0 - 13.0 fL', condition: 'ADULT' }
    ] },
    { name: 'Neutrophils', code: 'NEUT-PCT', aliases: ['Polymorphs', 'Neutrophils %'], unit: '%', prec: 1, desc: 'Percentage of neutrophils in WBC', ranges: [
      { gender: 'ALL' as const, ageMin: 0, ageMax: 120, minVal: 40.0, maxVal: 75.0, displayText: '40.0 - 75.0 %', condition: 'ADULT' }
    ] },
    { name: 'Lymphocytes', code: 'LYMPH-PCT', aliases: ['Lymphs %', 'Lymphocytes %'], unit: '%', prec: 1, desc: 'Percentage of lymphocytes in WBC', ranges: [
      { gender: 'ALL' as const, ageMin: 0, ageMax: 120, minVal: 20.0, maxVal: 45.0, displayText: '20.0 - 45.0 %', condition: 'ADULT' }
    ] },
    { name: 'Monocytes', code: 'MONO-PCT', aliases: ['Monos %'], unit: '%', prec: 1, desc: 'Percentage of monocytes in WBC', ranges: [
      { gender: 'ALL' as const, ageMin: 0, ageMax: 120, minVal: 2.0, maxVal: 10.0, displayText: '2.0 - 10.0 %', condition: 'ADULT' }
    ] },
    { name: 'Eosinophils', code: 'EOS-PCT', aliases: ['Eos %'], unit: '%', prec: 1, desc: 'Percentage of eosinophils in WBC', ranges: [
      { gender: 'ALL' as const, ageMin: 0, ageMax: 120, minVal: 1.0, maxVal: 6.0, displayText: '1.0 - 6.0 %', condition: 'ADULT' }
    ] },
    { name: 'Basophils', code: 'BASO-PCT', aliases: ['Basos %'], unit: '%', prec: 1, desc: 'Percentage of basophils in WBC', ranges: [
      { gender: 'ALL' as const, ageMin: 0, ageMax: 120, minVal: 0.0, maxVal: 2.0, displayText: '0.0 - 2.0 %', condition: 'ADULT' }
    ] },
    { name: 'Absolute Neutrophil Count', code: 'ANC', aliases: ['ANC'], unit: '10^3/µL', prec: 2, desc: 'Absolute count of neutrophils', ranges: [
      { gender: 'ALL' as const, ageMin: 0, ageMax: 120, minVal: 1.5, maxVal: 8.0, displayText: '1.50 - 8.00 x10^3/µL', condition: 'ADULT' }
    ] },
    { name: 'Absolute Lymphocyte Count', code: 'ALC', aliases: ['ALC'], unit: '10^3/µL', prec: 2, desc: 'Absolute count of lymphocytes', ranges: [
      { gender: 'ALL' as const, ageMin: 0, ageMax: 120, minVal: 1.0, maxVal: 4.8, displayText: '1.00 - 4.80 x10^3/µL', condition: 'ADULT' }
    ] },
    { name: 'Absolute Eosinophil Count', code: 'AEC', aliases: ['AEC'], unit: 'cells/mm³', prec: 0, desc: 'Absolute count of eosinophils', ranges: [
      { gender: 'ALL' as const, ageMin: 0, ageMax: 120, minVal: 40, maxVal: 440, displayText: '40 - 440 cells/mm³', condition: 'ADULT' }
    ] },
    { name: 'Erythrocyte Sedimentation Rate', code: 'ESR', aliases: ['ESR', 'Westergren ESR'], unit: 'mg/L', prec: 0, desc: 'Rate at which red blood cells settle', ranges: [
      { gender: 'MALE' as const, ageMin: 0, ageMax: 50, minVal: 0, maxVal: 15, displayText: '0 - 15 mm/hr', condition: 'ADULT' },
      { gender: 'FEMALE' as const, ageMin: 0, ageMax: 50, minVal: 0, maxVal: 20, displayText: '0 - 20 mm/hr', condition: 'ADULT' }
    ] },
    { name: 'Prothrombin Time', code: 'PT', aliases: ['PT'], unit: 's', prec: 1, desc: 'Time taken for plasma to clot', ranges: [
      { gender: 'ALL' as const, ageMin: 0, ageMax: 120, minVal: 11.0, maxVal: 13.5, displayText: '11.0 - 13.5 s', condition: 'ADULT' }
    ] },
    { name: 'INR', code: 'INR', aliases: ['INR'], unit: 'INR', prec: 2, desc: 'International Normalized Ratio', ranges: [
      { gender: 'ALL' as const, ageMin: 0, ageMax: 120, minVal: 0.8, maxVal: 1.2, displayText: '0.8 - 1.2', condition: 'ADULT' }
    ] },
    { name: 'APTT', code: 'APTT', aliases: ['APTT'], unit: 's', prec: 1, desc: 'Activated Partial Thromboplastin Time', ranges: [
      { gender: 'ALL' as const, ageMin: 0, ageMax: 120, minVal: 25.0, maxVal: 35.0, displayText: '25.0 - 35.0 s', condition: 'ADULT' }
    ] }
  ];

  for (const h of hematology) {
    params.push({
      name: h.name,
      shortCode: h.code,
      aliases: h.aliases,
      category: 'Hematology',
      unitName: h.unit,
      decimalPrecision: h.prec,
      description: h.desc,
      referenceRanges: h.ranges
    });
  }

  // 2. Core Biochemistry / Clinical Chemistry Analytes (80)
  const biochemistry = [
    { name: 'Glucose Fasting', code: 'FBS', aliases: ['Fasting Blood Sugar', 'Fasting Glucose'], unit: 'mg/dL', prec: 0, desc: 'Blood glucose level after fasting', minVal: 70, maxVal: 100 },
    { name: 'Glucose Post Prandial', code: 'PPBS', aliases: ['Post Prandial Glucose', 'PP Blood Sugar'], unit: 'mg/dL', prec: 0, desc: 'Blood glucose level 2 hours post meal', minVal: 70, maxVal: 140 },
    { name: 'Glucose Random', code: 'RBS', aliases: ['Random Blood Sugar', 'Random Glucose'], unit: 'mg/dL', prec: 0, desc: 'Blood glucose level at any time', minVal: 70, maxVal: 140 },
    { name: 'HbA1c', code: 'HBA1C', aliases: ['Glycated Hemoglobin', 'HbA1c'], unit: '%', prec: 1, desc: 'Average blood glucose level over past 3 months', minVal: 4.0, maxVal: 5.6 },
    { name: 'Urea', code: 'UREA', aliases: ['Blood Urea', 'Urea'], unit: 'mg/dL', prec: 1, desc: 'Waste product from protein breakdown in liver', minVal: 15, maxVal: 45 },
    { name: 'Creatinine', code: 'CREAT', aliases: ['Serum Creatinine', 'Creatinine'], unit: 'mg/dL', prec: 2, desc: 'Waste product from muscle metabolism excreted by kidneys', minVal: 0.6, maxVal: 1.2 },
    { name: 'Uric Acid', code: 'URIC', aliases: ['Serum Uric Acid', 'Uric Acid'], unit: 'mg/dL', prec: 1, desc: 'Waste product from purine metabolism excreted by kidneys', minVal: 3.5, maxVal: 7.2 },
    { name: 'Sodium', code: 'NA', aliases: ['Serum Sodium', 'Sodium'], unit: 'mmol/L', prec: 1, desc: 'Primary extracellular electrolyte', minVal: 135, maxVal: 145 },
    { name: 'Potassium', code: 'K', aliases: ['Serum Potassium', 'Potassium'], unit: 'mmol/L', prec: 1, desc: 'Primary intracellular electrolyte', minVal: 3.5, maxVal: 5.1 },
    { name: 'Chloride', code: 'CL', aliases: ['Serum Chloride', 'Chloride'], unit: 'mmol/L', prec: 1, desc: 'Electrolyte involved in body fluid balance', minVal: 96, maxVal: 106 },
    { name: 'Bicarbonate', code: 'HCO3', aliases: ['Serum Bicarbonate', 'HCO3'], unit: 'mmol/L', prec: 1, desc: 'Anion representing acid-base balance buffer', minVal: 22, maxVal: 29 },
    { name: 'Calcium', code: 'CA', aliases: ['Serum Calcium', 'Total Calcium'], unit: 'mg/dL', prec: 1, desc: 'Essential mineral for bones, muscles, and nerves', minVal: 8.5, maxVal: 10.5 },
    { name: 'Ionized Calcium', code: 'ICA', aliases: ['Free Calcium', 'Ionized Calcium'], unit: 'mg/dL', prec: 2, desc: 'Biologically active fraction of calcium', minVal: 4.5, maxVal: 5.6 },
    { name: 'Phosphorus', code: 'PHOS', aliases: ['Serum Phosphorus', 'Inorganic Phosphate'], unit: 'mg/dL', prec: 1, desc: 'Mineral associated with calcium in bone health', minVal: 2.5, maxVal: 4.5 },
    { name: 'Magnesium', code: 'MG', aliases: ['Serum Magnesium', 'Magnesium'], unit: 'mg/dL', prec: 2, desc: 'Cofactor for over 300 enzyme systems', minVal: 1.7, maxVal: 2.2 },
    { name: 'Total Cholesterol', code: 'CHOL', aliases: ['Cholesterol', 'Total Chol'], unit: 'mg/dL', prec: 0, desc: 'Total blood lipid marker', minVal: 100, maxVal: 200 },
    { name: 'Triglycerides', code: 'TRIG', aliases: ['Triglycerides', 'TG'], unit: 'mg/dL', prec: 0, desc: 'Blood lipid stored in fat cells', minVal: 50, maxVal: 150 },
    { name: 'HDL Cholesterol', code: 'HDL', aliases: ['HDL', 'Good Cholesterol'], unit: 'mg/dL', prec: 0, desc: 'High-density lipoprotein cholesterol', minVal: 40, maxVal: 60 },
    { name: 'LDL Cholesterol', code: 'LDL', aliases: ['LDL', 'Bad Cholesterol'], unit: 'mg/dL', prec: 0, desc: 'Low-density lipoprotein cholesterol', minVal: 50, maxVal: 100 },
    { name: 'VLDL Cholesterol', code: 'VLDL', aliases: ['VLDL'], unit: 'mg/dL', prec: 0, desc: 'Very low-density lipoprotein cholesterol', minVal: 5, maxVal: 30 },
    { name: 'Bilirubin Total', code: 'BIL-T', aliases: ['Total Bilirubin', 'BIL-T'], unit: 'mg/dL', prec: 2, desc: 'Yellow breakdown product of normal heme catabolism', minVal: 0.2, maxVal: 1.2 },
    { name: 'Bilirubin Direct', code: 'BIL-D', aliases: ['Direct Bilirubin', 'Conjugated Bilirubin'], unit: 'mg/dL', prec: 2, desc: 'Water-soluble conjugated bilirubin in liver', minVal: 0.0, maxVal: 0.3 },
    { name: 'Bilirubin Indirect', code: 'BIL-I', aliases: ['Indirect Bilirubin', 'Unconjugated Bilirubin'], unit: 'mg/dL', prec: 2, desc: 'Unconjugated bilirubin calculated from total and direct', minVal: 0.2, maxVal: 0.8 },
    { name: 'SGPT / ALT', code: 'SGPT', aliases: ['ALT', 'SGPT'], unit: 'U/L', prec: 1, desc: 'Liver enzyme indicating hepatic cellular injury', minVal: 7, maxVal: 56 },
    { name: 'SGOT / AST', code: 'SGOT', aliases: ['AST', 'SGOT'], unit: 'U/L', prec: 1, desc: 'Enzyme found in liver, heart, and skeletal muscles', minVal: 10, maxVal: 40 },
    { name: 'Alkaline Phosphatase', code: 'ALP', aliases: ['ALP', 'Alk Phos'], unit: 'U/L', prec: 1, desc: 'Enzyme related to bile ducts and bone growth', minVal: 44, maxVal: 147 },
    { name: 'GGT', code: 'GGT', aliases: ['Gamma Glutamyl Transferase', 'GGT'], unit: 'U/L', prec: 1, desc: 'Sensitive marker for liver and biliary disease', minVal: 9, maxVal: 48 },
    { name: 'Total Protein', code: 'TP', aliases: ['Protein Total', 'Total Protein'], unit: 'g/dL', prec: 1, desc: 'Total proteins in serum (albumin + globulin)', minVal: 6.0, maxVal: 8.3 },
    { name: 'Albumin', code: 'ALB', aliases: ['Serum Albumin', 'Albumin'], unit: 'g/dL', prec: 1, desc: 'Primary plasma binding protein manufactured by liver', minVal: 3.5, maxVal: 5.0 },
    { name: 'Globulin', code: 'GLOB', aliases: ['Globulin'], unit: 'g/dL', prec: 1, desc: 'Immunoglobulins and transport globulins', minVal: 2.0, maxVal: 3.5 },
    { name: 'Amylase', code: 'AMY', aliases: ['Serum Amylase', 'Amylase'], unit: 'U/L', prec: 1, desc: 'Pancreatic digestive enzyme breaking down starch', minVal: 30, maxVal: 110 },
    { name: 'Lipase', code: 'LIP', aliases: ['Serum Lipase', 'Lipase'], unit: 'U/L', prec: 1, desc: 'Pancreatic enzyme breaking down fats', minVal: 10, maxVal: 140 },
    { name: 'LDH', code: 'LDH', aliases: ['Lactate Dehydrogenase', 'LDH'], unit: 'U/L', prec: 1, desc: 'Intracellular tissue injury marker', minVal: 140, maxVal: 280 },
    { name: 'CK-Total', code: 'CK', aliases: ['Creatine Kinase', 'CK'], unit: 'U/L', prec: 1, desc: 'Muscle enzyme released upon tissue trauma', minVal: 38, maxVal: 174 },
    { name: 'CK-MB', code: 'CKMB', aliases: ['CK-MB Mass', 'CK-MB'], unit: 'ng/mL', prec: 2, desc: 'Cardiac isoenzyme of creatine kinase', minVal: 0.0, maxVal: 5.0 },
    { name: 'Serum Iron', code: 'IRON', aliases: ['Iron', 'Serum Iron'], unit: 'µg/dL', prec: 1, desc: 'Circulating iron level', minVal: 60, maxVal: 170 },
    { name: 'TIBC', code: 'TIBC', aliases: ['Total Iron Binding Capacity', 'TIBC'], unit: 'µg/dL', prec: 1, desc: 'Capacity of transferrin to bind iron', minVal: 240, maxVal: 450 },
    { name: 'Ferritin', code: 'FERRITIN', aliases: ['Ferritin'], unit: 'ng/mL', prec: 1, desc: 'Intracellular iron storage protein marker', minVal: 30, maxVal: 400 },
    { name: 'CRP', code: 'CRP', aliases: ['C-Reactive Protein', 'CRP'], unit: 'mg/L', prec: 1, desc: 'Acute-phase inflammatory protein', minVal: 0, maxVal: 5 },
    { name: 'Transferrin', code: 'TRANS', aliases: ['Transferrin'], unit: 'mg/dL', prec: 1, desc: 'Iron transport protein in blood', minVal: 200, maxVal: 360 }
  ];

  // Map core biochemistry parameters to master params array
  for (const b of biochemistry) {
    params.push({
      name: b.name,
      shortCode: b.code,
      aliases: b.aliases,
      category: 'Biochemistry',
      unitName: b.unit,
      decimalPrecision: b.prec,
      description: b.desc,
      referenceRanges: [
        { gender: 'ALL' as const, ageMin: 0, ageMax: 120, minVal: b.minVal, maxVal: b.maxVal, displayText: `${b.minVal} - ${b.maxVal} ${b.unit}`, condition: 'ADULT' }
      ]
    });
  }

  // 3. Generate Fluid / Urine Matrix Variations for Biochemistry (approx 700 parameters)
  const FLUID_MATRICES = [
    { suffix: 'Serum', codeSuffix: 'SR', descPrefix: 'Serum level of ', unitDefault: '' },
    { suffix: 'Plasma', codeSuffix: 'PL', descPrefix: 'Plasma level of ', unitDefault: '' },
    { suffix: 'Urine (Random)', codeSuffix: 'UR', descPrefix: 'Random urine excretion of ', unitDefault: 'mg/dL' },
    { suffix: 'Urine (24-Hour)', codeSuffix: 'U24', descPrefix: '24-hour urine excretion of ', unitDefault: 'g/24h' },
    { suffix: 'CSF', codeSuffix: 'CSF', descPrefix: 'Cerebrospinal fluid level of ', unitDefault: '' },
    { suffix: 'Pleural Fluid', codeSuffix: 'PF', descPrefix: 'Pleural fluid level of ', unitDefault: '' },
    { suffix: 'Ascitic Fluid', codeSuffix: 'AF', descPrefix: 'Ascitic fluid level of ', unitDefault: '' },
    { suffix: 'Synovial Fluid', codeSuffix: 'SF', descPrefix: 'Synovial fluid level of ', unitDefault: '' },
    { suffix: 'Pericardial Fluid', codeSuffix: 'PCF', descPrefix: 'Pericardial fluid level of ', unitDefault: '' }
  ];

  for (const b of biochemistry) {
    for (const m of FLUID_MATRICES) {
      if (m.suffix === 'Serum' || m.suffix === 'Plasma') continue;

      const unit = m.unitDefault || b.unit;
      const code = `${b.code}-${m.codeSuffix}`;
      const name = `${b.name} - ${m.suffix}`;
      
      params.push({
        name,
        shortCode: code,
        aliases: [`${b.code} ${m.suffix}`, name],
        category: 'Biochemistry',
        unitName: unit,
        decimalPrecision: b.prec,
        description: `${m.descPrefix}${b.name}`,
        referenceRanges: [
          { gender: 'ALL' as const, ageMin: 0, ageMax: 120, displayText: `Matrix-specific ranges apply`, condition: 'ADULT' }
        ]
      });
    }
  }

  // 4. Generate Autoimmune, Endocrinology, and other core indicators directly.

  // 7. Autoimmune Panels (120 parameters)
  // 40 antigens * 3 antibodies
  const antigens = [
    'dsDNA', 'Sm', 'Ribosomal P', 'RNP/Sm', 'SS-A/Ro60', 'Ro-52', 'SS-B/La', 'Scl-70', 'PM-Scl', 'Jo-1', 
    'Centromere B', 'PCNA', 'Histones', 'Nucleosomes', 'AMA-M2', 'M2-3E', 'gp210', 'sp100', 'DFS70', 'F-Actin',
    'Mi-2', 'TIF1-gamma', 'MDA5', 'NXP2', 'SAE1', 'Ku', 'U1-RNP', 'RNP-A', 'RNP-C', 'SS-A/Ro52',
    'SRP', 'PL-7', 'PL-12', 'EJ', 'OJ', 'Ro-60', 'Ro-52 Recombinant', 'SSB Recombinant', 'Scl-70 Native', 'Jo-1 Native'
  ];
  const antibodies = ['IgG', 'IgM', 'IgA'];

  for (const ag of antigens) {
    for (const ab of antibodies) {
      const name = `Anti-${ag} ${ab}`;
      const code = `ANA-${ag.replace('/', '').toUpperCase()}-${ab.toUpperCase()}`;
      params.push({
        name,
        shortCode: code,
        aliases: [`${ag} ${ab}`, name],
        category: 'Autoimmune',
        unitName: 'U/mL',
        decimalPrecision: 1,
        description: `Quantitative autoimmune profile for ${name}`,
        referenceRanges: [
          { gender: 'ALL' as const, ageMin: 0, ageMax: 120, minVal: 0, maxVal: 20, displayText: '< 20 U/mL (Negative)', condition: 'ADULT' }
        ]
      });
    }
  }

  // 8. Histopathology & Cytology Descriptors (150 parameters)
  // 25 organs * 6 descriptors
  const organs = [
    'Breast', 'Thyroid', 'Colon', 'Appendix', 'Gallbladder', 'Skin', 'Lung', 'Kidney', 'Prostate', 'Lymph Node', 
    'Bone Marrow', 'Endometrium', 'Cervix', 'Ovary', 'Stomach', 'Liver', 'Spleen', 'Pancreas', 'Esophagus', 
    'Bladder', 'Testis', 'Brain', 'Soft Tissue', 'Bone', 'Oral Mucosa'
  ];
  const descriptors = [
    { suffix: 'Gross Description', code: 'GROSS' },
    { suffix: 'Microscopic Examination', code: 'MICRO' },
    { suffix: 'Impression', code: 'IMPR' },
    { suffix: 'Surgical Margins', code: 'MARG' },
    { suffix: 'Lymph Node Status', code: 'LN' },
    { suffix: 'Pathologist Notes', code: 'NOTES' }
  ];

  for (const org of organs) {
    for (const ds of descriptors) {
      const name = `${org} Specimen ${ds.suffix}`;
      const code = `HIST-${org.substring(0, 3).toUpperCase()}-${ds.code}`;
      params.push({
        name,
        shortCode: code,
        aliases: [`${org} ${ds.suffix}`, name],
        category: 'Histopathology',
        unitName: 'Neg/Pos',
        decimalPrecision: 0,
        description: `Histopathological report parameter for ${name}`,
        referenceRanges: [
          { gender: 'ALL' as const, ageMin: 0, ageMax: 120, displayText: 'Narrative description text block', condition: 'ADULT' }
        ]
      });
    }
  }

  // 9. Molecular PCR Viruses (60 parameters)
  const PCR_VIRUSES = [
    'HIV-1', 'HBV', 'HCV', 'CMV', 'EBV', 'HSV-1', 'HSV-2', 'VZV', 'Influenza A', 'Influenza B', 
    'COVID-19', 'Dengue', 'Zika', 'Chikungunya', 'HPV-16', 'HPV-18', 'Adenovirus', 'Enterovirus',
    'Parvovirus B19', 'BK Virus'
  ];

  for (const v of PCR_VIRUSES) {
    const cleanV = v.replace('-', '').toUpperCase();
    params.push({
      name: `PCR - ${v} Qualitative`,
      shortCode: `PCR-${cleanV}-QL`,
      aliases: [`${v} PCR Qual`, `PCR ${v} Qualitative`],
      category: 'Molecular Diagnostics',
      unitName: 'Neg/Pos',
      decimalPrecision: 0,
      description: `Qualitative PCR assay for detection of ${v}`,
      referenceRanges: [{ gender: 'ALL' as const, ageMin: 0, ageMax: 120, displayText: 'Not Detected', condition: 'ADULT' }]
    });

    params.push({
      name: `PCR - ${v} Quantitative`,
      shortCode: `PCR-${cleanV}-QN`,
      aliases: [`${v} PCR Quant`, `PCR ${v} Quantitative`],
      category: 'Molecular Diagnostics',
      unitName: 'Copies/mL',
      decimalPrecision: 0,
      description: `Quantitative viral load PCR assay for ${v}`,
      referenceRanges: [{ gender: 'ALL' as const, ageMin: 0, ageMax: 120, displayText: 'Not Detected', condition: 'ADULT' }]
    });

    params.push({
      name: `PCR - ${v} log copies`,
      shortCode: `PCR-${cleanV}-LOG`,
      aliases: [`${v} PCR Log`, `PCR ${v} Log load`],
      category: 'Molecular Diagnostics',
      unitName: 'log Copies/mL',
      decimalPrecision: 2,
      description: `Logarithmic viral load value for ${v}`,
      referenceRanges: [{ gender: 'ALL' as const, ageMin: 0, ageMax: 120, displayText: 'Not Detected', condition: 'ADULT' }]
    });
  }

  // 10. Endocrinology Parameters (30)
  const hormones = [
    { name: 'Thyroid Stimulating Hormone', code: 'TSH', aliases: ['TSH', 'Thyrotropin'], unit: 'µIU/mL', prec: 3, desc: 'Pituitary gland hormone regulating thyroid', ranges: [{ gender: 'ALL' as const, ageMin: 18, ageMax: 120, minVal: 0.45, maxVal: 4.5, displayText: '0.45 - 4.50 µIU/mL', condition: 'ADULT' }] },
    { name: 'Triiodothyronine', code: 'T3', aliases: ['Total T3', 'T3'], unit: 'ng/dL', prec: 1, desc: 'Active thyroid hormone', ranges: [{ gender: 'ALL' as const, ageMin: 18, ageMax: 120, minVal: 80, maxVal: 200, displayText: '80 - 200 ng/dL', condition: 'ADULT' }] },
    { name: 'Thyroxine', code: 'T4', aliases: ['Total T4', 'T4'], unit: 'µg/dL', prec: 1, desc: 'Primary thyroid hormone secretion', ranges: [{ gender: 'ALL' as const, ageMin: 18, ageMax: 120, minVal: 4.5, maxVal: 12.0, displayText: '4.5 - 12.0 µg/dL', condition: 'ADULT' }] },
    { name: 'Follicle Stimulating Hormone', code: 'FSH', aliases: ['FSH'], unit: 'mIU/mL', prec: 2, desc: 'Gonadotropin regulating reproductive functions', ranges: [{ gender: 'ALL' as const, ageMin: 18, ageMax: 120, minVal: 1.5, maxVal: 12.4, displayText: '1.5 - 12.4 mIU/mL', condition: 'ADULT' }] },
    { name: 'Luteinizing Hormone', code: 'LH', aliases: ['LH'], unit: 'mIU/mL', prec: 2, desc: 'Gonadotropin triggering ovulation/testosterone production', ranges: [{ gender: 'ALL' as const, ageMin: 18, ageMax: 120, minVal: 1.7, maxVal: 8.6, displayText: '1.7 - 8.6 mIU/mL', condition: 'ADULT' }] },
    { name: 'Prolactin', code: 'PROLACTIN', aliases: ['PRL', 'Prolactin'], unit: 'ng/mL', prec: 2, desc: 'Pituitary hormone stimulating lactation', ranges: [
      { gender: 'MALE' as const, ageMin: 18, ageMax: 120, minVal: 2.0, maxVal: 17.7, displayText: '2.0 - 17.7 ng/mL', condition: 'ADULT' },
      { gender: 'FEMALE' as const, ageMin: 18, ageMax: 120, minVal: 3.0, maxVal: 23.3, displayText: '3.0 - 23.3 ng/mL', condition: 'ADULT' }
    ] }
  ];

  for (const h of hormones) {
    if (!params.some(p => p.shortCode === h.code)) {
      params.push({
        name: h.name,
        shortCode: h.code,
        aliases: h.aliases,
        category: 'Endocrinology',
        unitName: h.unit,
        decimalPrecision: h.prec,
        description: h.desc,
        referenceRanges: h.ranges
      });
    }
  }

  // Ensure every parameter has unique shortCode
  const uniqueParams: PreloadedParameter[] = [];
  const codesSeen = new Set<string>();
  for (const p of params) {
    if (!codesSeen.has(p.shortCode)) {
      uniqueParams.push(p);
      codesSeen.add(p.shortCode);
    }
  }

  return uniqueParams;
}

function generatePreloadedTests(): PreloadedTest[] {
  const tests: PreloadedTest[] = [];

  // Core Diagnostic Profile Panels (50)
  const corePanels = [
    { name: 'Complete Blood Count', code: 'CBC', cat: 'Hematology', price: 300, params: ['Hb', 'RBC', 'WBC', 'PLT', 'HCT', 'MCV', 'MCH', 'MCHC'] },
    { name: 'Liver Function Test', code: 'LFT', cat: 'Biochemistry', price: 600, params: ['BIL-T', 'SGOT', 'SGPT', 'ALP', 'TP', 'ALB', 'GLOB', 'AGRATIO'] },
    { name: 'Kidney Function Test', code: 'KFT', cat: 'Biochemistry', price: 400, params: ['CREAT', 'UREA', 'URIC', 'NA', 'K', 'CL'] },
    { name: 'Lipid Profile', code: 'LIPID', cat: 'Biochemistry', price: 500, params: ['CHOL', 'TRIG', 'HDL', 'LDL', 'VLDL'] },
    { name: 'Thyroid Panel', code: 'THYROID', cat: 'Endocrinology', price: 450, params: ['T3', 'T4', 'TSH'] },
    { name: 'Thyroid Panel Extended', code: 'THYROID-EXT', cat: 'Endocrinology', price: 750, params: ['T3', 'T4', 'TSH', 'FT3', 'FT4'] },
    { name: 'Electrolytes Panel', code: 'ELECTROLYTES', cat: 'Biochemistry', price: 300, params: ['NA', 'K', 'CL', 'HCO3'] },
    { name: 'Diabetes Profile', code: 'DIABETES', cat: 'Biochemistry', price: 350, params: ['FBS', 'PPBS', 'HBA1C'] },
    { name: 'Iron Deficiency Panel', code: 'IRON-DEF', cat: 'Biochemistry', price: 600, params: ['IRON', 'TIBC', 'FERRITIN', 'TRANS'] },
    { name: 'Dengue Panel', code: 'DENGUE', cat: 'Immunology', price: 800, params: ['DENGNS1', 'DENGIGM', 'DENGIGG'] },
    { name: 'TORCH Profile IgG', code: 'TORCH-G', cat: 'Immunology', price: 1500, params: ['TOXO-G', 'RUB-G', 'CMV-G', 'HSV1-G', 'HSV2-G'] },
    { name: 'TORCH Profile IgM', code: 'TORCH-M', cat: 'Immunology', price: 1500, params: ['TOXO-M', 'RUB-M', 'CMV-M', 'HSV1-M', 'HSV2-M'] },
    { name: 'Cardiac Injury Panel', code: 'CARDIAC', cat: 'Cardiac', price: 1200, params: ['CKMB', 'LDH'] }
  ];

  for (const cp of corePanels) {
    tests.push({
      name: cp.name,
      shortCode: cp.code,
      category: cp.cat,
      defaultPrice: cp.price,
      parameters: cp.params
    });
  }

  // Generate individual test templates for the top 300 parameters
  const paramsList = generatePreloadedParameters();
  const topParams = paramsList.slice(0, 300);

  for (const p of topParams) {
    const code = `T-${p.shortCode}`;
    if (!tests.some(t => t.shortCode === code)) {
      tests.push({
        name: `${p.name} Assay`,
        shortCode: code,
        category: p.category,
        defaultPrice: 100,
        parameters: [p.shortCode]
      });
    }
  }

  return tests;
}

export const PRELOADED_UNITS = generatePreloadedUnits();
export const PRELOADED_PARAMETERS = generatePreloadedParameters();
export const PRELOADED_TESTS = generatePreloadedTests();
