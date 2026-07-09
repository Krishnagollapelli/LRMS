import { prisma } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import bcrypt from 'bcryptjs';
import Fuse from 'fuse.js';
import {
  PRELOADED_UNITS,
  PRELOADED_PARAMETERS,
  PRELOADED_TESTS,
  PreloadedParameter
} from './preloadedData.js';
import { AIResolveResult } from 'shared';

export class KnowledgeEngineService {
  private parameterFuseInstance: Fuse<any> | null = null;
  private testFuseInstance: Fuse<any> | null = null;

  constructor() {
    // We will initialize the search index after seeding or on first request
  }

  /**
   * Seed the database with the preloaded medical dictionary if empty
   */
  async seedDatabase(force = false) {
    try {
      const existingAdmin = await prisma.user.findFirst({ where: { username: 'admin' } });
      if (!existingAdmin) {
        await prisma.user.create({
          data: {
            username: 'admin',
            password: bcrypt.hashSync('admin123', 10),
            name: 'Default Administrator',
            role: 'ADMIN',
            isActive: true
          }
        });
        logger.info('Default admin user created (admin / admin123).');
      } else {
        await prisma.user.update({
          where: { id: existingAdmin.id },
          data: {
            password: bcrypt.hashSync('admin123', 10),
            isActive: true
          }
        });
        logger.info('Default admin user password validated/reset to admin123.');
      }

      const selfDoctor = await prisma.doctor.findFirst({ where: { id: 'self-doctor' } });
      if (!selfDoctor) {
        await prisma.doctor.create({
          data: {
            id: 'self-doctor',
            name: 'Self',
            qualification: 'N/A',
            hospital: 'N/A',
            registrationNumber: 'N/A',
            phone: 'N/A',
            isActive: true
          }
        });
        logger.info('Default doctor "Self" created.');
      }

      const unitCount = await prisma.unit.count();
      if (unitCount > 0 && !force) {
        logger.info('Database already contains medical structures. Seeding skipped.');
        await this.rebuildSearchIndex();
        return;
      }

      if (force) {
        logger.info('Force seeding requested. Clearing patient, reports, and MKE database tables...');
        await prisma.billing.deleteMany({});
        await prisma.deliveryHistory.deleteMany({});
        await prisma.reportResult.deleteMany({});
        await prisma.reportTest.deleteMany({});
        await prisma.report.deleteMany({});
        await prisma.visit.deleteMany({});
        await prisma.referenceRange.deleteMany({});
        await prisma.testParameter.deleteMany({});
        await prisma.analyzerProfile.deleteMany({});
        await prisma.test.deleteMany({});
        await prisma.parameter.deleteMany({});
        await prisma.unit.deleteMany({});
      }

      logger.info('Initializing Medical Knowledge Engine database seeding...');

      // 1. Seed Units
      const unitMap = new Map<string, string>();
      for (const unit of PRELOADED_UNITS) {
        const createdUnit = await prisma.unit.create({
          data: {
            name: unit.name,
            description: unit.description,
            isActive: true
          }
        });
        unitMap.set(unit.name, createdUnit.id);
      }
      logger.info(`Seeded ${PRELOADED_UNITS.length} measurement units.`);

      // 2. Seed Parameters and Reference Ranges
      const parameterMap = new Map<string, string>();
      for (const param of PRELOADED_PARAMETERS) {
        const unitId = unitMap.get(param.unitName);
        if (!unitId) continue;

        const createdParam = await prisma.parameter.create({
          data: {
            name: param.name,
            shortCode: param.shortCode,
            aliases: param.aliases.join(','),
            category: param.category,
            unitId: unitId,
            decimalPrecision: param.decimalPrecision,
            description: param.description,
            isActive: true
          }
        });

        parameterMap.set(param.shortCode, createdParam.id);

        // Seed reference ranges
        if (param.referenceRanges && param.referenceRanges.length > 0) {
          await prisma.referenceRange.createMany({
            data: param.referenceRanges.map(range => ({
              parameterId: createdParam.id,
              gender: range.gender,
              ageMin: range.ageMin,
              ageMax: range.ageMax,
              minVal: range.minVal ?? null,
              maxVal: range.maxVal ?? null,
              displayText: range.displayText,
              condition: range.condition
            }))
          });
        }
      }
      logger.info(`Seeded ${PRELOADED_PARAMETERS.length} master medical parameters.`);

      // 3. Seed Test Templates
      for (const test of PRELOADED_TESTS) {
        const createdTest = await prisma.test.create({
          data: {
            name: test.name,
            shortCode: test.shortCode,
            category: test.category,
            defaultPrice: test.defaultPrice || 0,
            isActive: true
          }
        });

        // Map parameter configs
        const testParametersData = test.parameters
          .map((code, index) => {
            const parameterId = parameterMap.get(code);
            return parameterId ? { parameterId, sortOrder: index + 1 } : null;
          })
          .filter((item): item is { parameterId: string; sortOrder: number } => item !== null);

        for (const tp of testParametersData) {
          await prisma.testParameter.create({
            data: {
              testId: createdTest.id,
              parameterId: tp.parameterId,
              sortOrder: tp.sortOrder
            }
          });
        }
      }
      logger.info(`Seeded ${PRELOADED_TESTS.length} default test templates.`);

      // 4. Seed Analyzer Profiles
      const analyzerProfiles = [
        { name: 'Mindray', model: 'BC-5000', connectionType: 'TCP' as const },
        { name: 'Sysmex', model: 'XP-300', connectionType: 'SERIAL' as const },
        { name: 'Horiba', model: 'Pentra 60', connectionType: 'SERIAL' as const },
        { name: 'Erba', model: 'Chem 7', connectionType: 'FILE' as const },
        { name: 'Abbott', model: 'Alinity', connectionType: 'TCP' as const },
        { name: 'Roche', model: 'Cobas c311', connectionType: 'TCP' as const },
        { name: 'Beckman Coulter', model: 'Access 2', connectionType: 'TCP' as const },
        { name: 'Siemens', model: 'Dimension EXL', connectionType: 'TCP' as const }
      ];

      for (const ap of analyzerProfiles) {
        const mappings: any[] = [];
        if (ap.name === 'Mindray' || ap.name === 'Sysmex' || ap.name === 'Horiba') {
          const hemCodes = ['Hb', 'RBC', 'WBC', 'PLT', 'HCT', 'MCV', 'MCH', 'MCHC'];
          for (const code of hemCodes) {
            const paramId = parameterMap.get(code);
            if (paramId) {
              mappings.push({
                parameterId: paramId,
                parameterName: code === 'Hb' ? 'Hemoglobin' : code,
                machineCode: code === 'Hb' ? 'HGB' : code.toUpperCase()
              });
            }
          }
        }

        await prisma.analyzerProfile.create({
          data: {
            name: ap.name,
            model: ap.model,
            connectionType: ap.connectionType,
            config: JSON.stringify(mappings),
            isActive: true
          }
        });
      }
      logger.info(`Seeded ${analyzerProfiles.length} analyzer profiles with default channel mappings.`);
      logger.info('Medical Knowledge Engine database seeding completed successfully.');

      await this.rebuildSearchIndex();
    } catch (error) {
      logger.error('Error seeding Medical Knowledge Engine database:', error);
    }
  }

  /**
   * Rebuild the Fuse.js search index for parameters
   */
  async rebuildParameterIndex() {
    try {
      const parameters = await prisma.parameter.findMany({
        where: { isActive: true, deletedAt: null },
        include: { unit: true }
      });

      const items = parameters.map(p => ({
        id: p.id,
        name: p.name,
        shortCode: p.shortCode,
        aliases: p.aliases ? p.aliases.split(',') : [],
        category: p.category,
        unit: p.unit.name,
        decimalPrecision: p.decimalPrecision,
        description: p.description
      }));

      this.parameterFuseInstance = new Fuse(items, {
        keys: [
          { name: 'shortCode', weight: 0.5 },
          { name: 'name', weight: 0.3 },
          { name: 'aliases', weight: 0.2 }
        ],
        threshold: 0.3,
        ignoreLocation: true
      });
      logger.debug('Fuse.js parameters index successfully built.');
    } catch (error) {
      logger.error('Failed to build Fuse.js parameters search index:', error);
    }
  }

  /**
   * Rebuild the Fuse.js search index for tests
   */
  async rebuildTestIndex() {
    try {
      const tests = await prisma.test.findMany({
        where: { isActive: true, deletedAt: null }
      });

      const items = tests.map(t => ({
        id: t.id,
        name: t.name,
        shortCode: t.shortCode,
        category: t.category
      }));

      this.testFuseInstance = new Fuse(items, {
        keys: [
          { name: 'shortCode', weight: 0.5 },
          { name: 'name', weight: 0.3 },
          { name: 'category', weight: 0.2 }
        ],
        threshold: 0.3,
        ignoreLocation: true
      });
      logger.debug('Fuse.js tests index successfully built.');
    } catch (error) {
      logger.error('Failed to build Fuse.js tests search index:', error);
    }
  }

  async rebuildSearchIndex() {
    await this.rebuildParameterIndex();
    await this.rebuildTestIndex();
  }

  /**
   * Search parameters locally using fuzzy/autocomplete search
   */
  async searchParameters(query: string) {
    if (!this.parameterFuseInstance) {
      await this.rebuildParameterIndex();
    }
    if (!query || query.trim() === '') {
      const params = await prisma.parameter.findMany({
        where: { isActive: true, deletedAt: null },
        include: { unit: true, referenceRanges: true },
        take: 20,
        orderBy: { name: 'asc' }
      });
      return params;
    }

    const fuseResults = this.parameterFuseInstance ? this.parameterFuseInstance.search(query) : [];
    const ids = fuseResults.slice(0, 15).map(r => r.item.id);

    if (ids.length === 0) {
      return [];
    }

    const params = await prisma.parameter.findMany({
      where: { id: { in: ids } },
      include: { unit: true, referenceRanges: true }
    });

    return ids.map(id => params.find(p => p.id === id)).filter((p): p is typeof params[0] => !!p);
  }

  /**
   * Search test templates locally using fuzzy/autocomplete search
   */
  async searchTests(query: string) {
    if (!this.testFuseInstance) {
      await this.rebuildTestIndex();
    }
    if (!query || query.trim() === '') {
      const tests = await prisma.test.findMany({
        where: { isActive: true, deletedAt: null },
        include: {
          testParameters: {
            include: {
              parameter: {
                include: { unit: true }
              }
            }
          }
        },
        take: 20,
        orderBy: { name: 'asc' }
      });
      const formatted = tests.map(t => ({
        id: t.id,
        name: t.name,
        shortCode: t.shortCode,
        category: t.category,
        isActive: t.isActive,
        createdAt: t.createdAt,
        parameters: t.testParameters
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(tp => tp.parameter)
      }));
      return formatted;
    }

    const fuseResults = this.testFuseInstance ? this.testFuseInstance.search(query) : [];
    const ids = fuseResults.slice(0, 15).map(r => r.item.id);

    if (ids.length === 0) {
      return [];
    }

    const tests = await prisma.test.findMany({
      where: { id: { in: ids } },
      include: {
        testParameters: {
          include: {
            parameter: {
              include: { unit: true }
            }
          }
        }
      }
    });

    const ordered = ids.map(id => tests.find(t => t.id === id)).filter((t): t is typeof tests[0] => !!t);
    return ordered.map(t => ({
      id: t.id,
      name: t.name,
      shortCode: t.shortCode,
      category: t.category,
      isActive: t.isActive,
      createdAt: t.createdAt,
      parameters: t.testParameters
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(tp => tp.parameter)
    }));
  }

  /**
   * Detect potential duplicates by checking names and aliases
   */
  async detectDuplicateParameter(name: string, shortCode: string, aliases: string[] = []) {
    const searchTerms = [
      name.toLowerCase().trim(),
      shortCode.toLowerCase().trim(),
      ...aliases.map(a => a.toLowerCase().trim())
    ];

    const allParams = await prisma.parameter.findMany({
      where: { deletedAt: null },
      include: { unit: true, referenceRanges: true }
    });

    const duplicates = allParams.filter(param => {
      const dbName = param.name.toLowerCase().trim();
      const dbCode = param.shortCode.toLowerCase().trim();
      const dbAliases = param.aliases ? param.aliases.split(',').map(a => a.toLowerCase().trim()) : [];

      // Check name match, shortCode match, or overlap in aliases
      return (
        searchTerms.includes(dbName) ||
        searchTerms.includes(dbCode) ||
        dbAliases.some(alias => searchTerms.includes(alias)) ||
        aliases.some(alias => dbName === alias.toLowerCase().trim() || dbCode === alias.toLowerCase().trim())
      );
    });

    return duplicates;
  }

  /**
   * Select reference range based on demographics
   */
  async resolveReferenceRange(parameterId: string, ageYears?: number | null, gender?: string | null, condition?: string) {
    const ranges = await prisma.referenceRange.findMany({
      where: { parameterId, deletedAt: null }
    });

    if (ranges.length === 0) return null;

    // Normalize gender inputs with fallback
    const normalizedGender = ((gender || 'ALL').toUpperCase()) as 'MALE' | 'FEMALE' | 'OTHER' | 'ALL';
    const age = ageYears ?? 30; // Default to typical adult (30 years) if missing

    // 1. Check Specific Conditions (e.g. PREGNANCY, ELDERLY)
    if (condition && condition !== 'ADULT' && condition !== 'CHILD') {
      const match = ranges.find(r => r.condition.toUpperCase() === condition.toUpperCase());
      if (match) return match;
    }

    // 2. Elderly filter (Age >= 65)
    if (age >= 65) {
      const elderlyRange = ranges.find(r => r.condition === 'ELDERLY');
      if (elderlyRange) return elderlyRange;
    }

    // 3. Child filter (Age < 18)
    if (age < 18) {
      const childRange = ranges.find(r => 
        r.condition === 'CHILD' && 
        age >= r.ageMin && 
        age <= r.ageMax &&
        (r.gender === 'ALL' || r.gender === normalizedGender)
      );
      if (childRange) return childRange;

      // Fallback child range if not matched by specific age limits
      const genericChild = ranges.find(r => r.condition === 'CHILD');
      if (genericChild) return genericChild;
    }

    // 4. Adult specific gender ranges
    const genderRange = ranges.find(r => 
      r.condition === 'ADULT' && 
      r.gender === normalizedGender
    );
    if (genderRange) return genderRange;

    // 5. General fallback
    const genericRange = ranges.find(r => r.gender === 'ALL');
    if (genericRange) return genericRange;

    // 6. Hard fallback to the first active range
    return ranges[0];
  }

  /**
   * Normalize custom unit entry
   */
  /**
   * Normalize custom unit entry
   */
  async normalizeUnit(unitInput: string, geminiApiKey?: string): Promise<{ standardName: string; originalName: string; isDifferent: boolean; isNew: boolean }> {
    const trimmedInput = unitInput.trim();
    if (!trimmedInput) return { standardName: '', originalName: '', isDifferent: false, isNew: false };

    // 1. Search in unit table case-insensitively
    const allUnits = await prisma.unit.findMany();
    const exactDbMatch = allUnits.find(u => u.name.toLowerCase() === trimmedInput.toLowerCase());
    if (exactDbMatch) {
      return {
        standardName: exactDbMatch.name,
        originalName: trimmedInput,
        isDifferent: exactDbMatch.name !== trimmedInput,
        isNew: false
      };
    }

    // 2. Suggest based on common case changes (e.g., standardizing capitalization / common aliases)
    let standardForm = trimmedInput
      .replace(/gm\/dl/i, 'g/dL')
      .replace(/grams\/dl/i, 'g/dL')
      .replace(/million\/cumm/i, '×10⁶/µL')
      .replace(/10\^6\/ul/i, '×10⁶/µL')
      .replace(/g\/dl/i, 'g/dL')
      .replace(/mg\/dl/i, 'mg/dL')
      .replace(/mmol\/l/i, 'mmol/L')
      .replace(/iu\/l/i, 'IU/L')
      .replace(/u\/l/i, 'U/L')
      .replace(/fl/i, 'fL')
      .replace(/pg/i, 'pg')
      .replace(/ug\/dl/i, 'µg/dL')
      .replace(/mcg\/dl/i, 'µg/dL')
      .replace(/micrograms\/deciliter/i, 'µg/dL')
      .replace(/picograms/i, 'pg')
      .replace(/femtoliters/i, 'fL')
      .replace(/mg\/l/i, 'mg/L')
      .replace(/milligrams\/liter/i, 'mg/L')
      .replace(/percent/i, '%')
      .replace(/percentage/i, '%');

    // Check if the standardized name already exists in the database
    const standardizedDbMatch = allUnits.find(u => u.name.toLowerCase() === standardForm.toLowerCase());
    if (standardizedDbMatch) {
      return {
        standardName: standardizedDbMatch.name,
        originalName: trimmedInput,
        isDifferent: standardizedDbMatch.name !== trimmedInput,
        isNew: false
      };
    }

    // 3. Fall back to Gemini AI if API Key is available
    const apiKey = geminiApiKey || process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `You are a medical laboratory unit standardizer. Standardize this lab unit: "${trimmedInput}".
Return ONLY the standard unit representation (e.g., g/dL, ×10⁶/µL, fL, pg, mg/dL, mmol/L, U/L, %). 
Do not enclose in markdown fences. Do not write any explanations. Only return the standardized unit string.`
                }]
              }]
            })
          }
        );

        if (response.ok) {
          const json = await response.json() as any;
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (text) {
            standardForm = text;
            // Double check if Gemini standardized name exists in the database
            const geminiDbMatch = allUnits.find(u => u.name.toLowerCase() === standardForm.toLowerCase());
            if (geminiDbMatch) {
              return {
                standardName: geminiDbMatch.name,
                originalName: trimmedInput,
                isDifferent: geminiDbMatch.name !== trimmedInput,
                isNew: false
              };
            }
          }
        }
      } catch (e) {
        logger.error('Gemini unit normalization failed:', e);
      }
    }

    // Ensure we capitalize standardForm nicely if standardizing offline
    if (standardForm === trimmedInput) {
      standardForm = standardForm.trim();
    }

    return {
      standardName: standardForm,
      originalName: trimmedInput,
      isDifferent: standardForm.toLowerCase() !== trimmedInput.toLowerCase(),
      isNew: true
    };
  }

  /**
   * AI Resolver querying Gemini or falling back to a structured simulation engine
   */
  async resolveParameterAI(query: string, geminiApiKey?: string): Promise<AIResolveResult> {
    const cleanedQuery = query.trim();
    const lowerQuery = cleanedQuery.toLowerCase();

    // 1. Search Local Parameter Library first
    const allParams = await prisma.parameter.findMany({
      where: { deletedAt: null },
      include: { unit: true, referenceRanges: true }
    });

    const localMatch = allParams.find(p => {
      const dbName = p.name.toLowerCase().trim();
      const dbCode = p.shortCode.toLowerCase().trim();
      const dbAliases = p.aliases ? p.aliases.split(',').map(a => a.toLowerCase().trim()) : [];
      return dbName === lowerQuery || dbCode === lowerQuery || dbAliases.includes(lowerQuery);
    });

    if (localMatch) {
      logger.info(`AI Resolver: Found matching parameter "${localMatch.name}" in Local Parameter Library.`);
      return {
        name: localMatch.name,
        shortCode: localMatch.shortCode,
        unit: localMatch.unit.name,
        category: localMatch.category,
        aliases: localMatch.aliases ? localMatch.aliases.split(',').map(a => a.trim()) : [],
        description: localMatch.description || '',
        referenceRanges: localMatch.referenceRanges.map(r => ({
          gender: r.gender as any,
          ageMin: r.ageMin,
          ageMax: r.ageMax,
          minVal: r.minVal ?? undefined,
          maxVal: r.maxVal ?? undefined,
          condition: r.condition,
          displayText: r.displayText
        }))
      };
    }

    // 2. Search Built-in Fallback Medical Dictionary
    const BUILT_IN_DICTIONARY: Record<string, AIResolveResult> = {
      'hemoglobin': {
        name: 'Hemoglobin',
        shortCode: 'Hb',
        unit: 'g/dL',
        category: 'Hematology',
        aliases: ['Hb', 'Hgb', 'Blood Hemoglobin'],
        description: 'Iron-containing oxygen-transport metalloprotein in red blood cells.',
        referenceRanges: [
          { gender: 'MALE', ageMin: 18, ageMax: 120, minVal: 13.5, maxVal: 17.5, condition: 'ADULT', displayText: '13.5 - 17.5 g/dL' },
          { gender: 'FEMALE', ageMin: 18, ageMax: 120, minVal: 12.0, maxVal: 15.5, condition: 'ADULT', displayText: '12.0 - 15.5 g/dL' }
        ]
      },
      'hb': {
        name: 'Hemoglobin',
        shortCode: 'Hb',
        unit: 'g/dL',
        category: 'Hematology',
        aliases: ['Hb', 'Hgb', 'Blood Hemoglobin'],
        description: 'Iron-containing oxygen-transport metalloprotein in red blood cells.',
        referenceRanges: [
          { gender: 'MALE', ageMin: 18, ageMax: 120, minVal: 13.5, maxVal: 17.5, condition: 'ADULT', displayText: '13.5 - 17.5 g/dL' },
          { gender: 'FEMALE', ageMin: 18, ageMax: 120, minVal: 12.0, maxVal: 15.5, condition: 'ADULT', displayText: '12.0 - 15.5 g/dL' }
        ]
      },
      'wbc': {
        name: 'White Blood Cell Count',
        shortCode: 'WBC',
        unit: '10^3/µL',
        category: 'Hematology',
        aliases: ['Total Leucocyte Count', 'TLC'],
        description: 'Cells of the immune system involved in protecting the body against infectious disease.',
        referenceRanges: [
          { gender: 'ALL', ageMin: 0, ageMax: 120, minVal: 4.0, maxVal: 11.0, condition: 'ADULT', displayText: '4.0 - 11.0 10^3/µL' }
        ]
      },
      'platelets': {
        name: 'Platelet Count',
        shortCode: 'PLT',
        unit: '10^3/µL',
        category: 'Hematology',
        aliases: ['Thrombocyte Count', 'PLT'],
        description: 'Blood cells responsible for blood clotting and stopping bleeding.',
        referenceRanges: [
          { gender: 'ALL', ageMin: 0, ageMax: 120, minVal: 150, maxVal: 450, condition: 'ADULT', displayText: '150 - 450 10^3/µL' }
        ]
      },
      'plt': {
        name: 'Platelet Count',
        shortCode: 'PLT',
        unit: '10^3/µL',
        category: 'Hematology',
        aliases: ['Thrombocyte Count', 'PLT'],
        description: 'Blood cells responsible for blood clotting and stopping bleeding.',
        referenceRanges: [
          { gender: 'ALL', ageMin: 0, ageMax: 120, minVal: 150, maxVal: 450, condition: 'ADULT', displayText: '150 - 450 10^3/µL' }
        ]
      },
      'rbc': {
        name: 'Red Blood Cell Count',
        shortCode: 'RBC',
        unit: '×10⁶/µL',
        category: 'Hematology',
        aliases: ['Erythrocyte Count'],
        description: 'Number of red blood cells per microliter of blood.',
        referenceRanges: [
          { gender: 'MALE', ageMin: 0, ageMax: 120, minVal: 4.5, maxVal: 5.9, condition: 'ADULT', displayText: '4.5 - 5.9 ×10⁶/µL' },
          { gender: 'FEMALE', ageMin: 0, ageMax: 120, minVal: 4.1, maxVal: 5.1, condition: 'ADULT', displayText: '4.1 - 5.1 ×10⁶/µL' }
        ]
      },
      'tsh': {
        name: 'Thyroid Stimulating Hormone',
        shortCode: 'TSH',
        unit: 'µIU/mL',
        category: 'Endocrinology',
        aliases: ['Thyrotropin'],
        description: 'Pituitary hormone that stimulates the thyroid gland to produce thyroxine.',
        referenceRanges: [
          { gender: 'ALL', ageMin: 18, ageMax: 120, minVal: 0.45, maxVal: 4.5, condition: 'ADULT', displayText: '0.45 - 4.5 µIU/mL' }
        ]
      },
      'cholesterol': {
        name: 'Total Cholesterol',
        shortCode: 'CHOL',
        unit: 'mg/dL',
        category: 'Biochemistry',
        aliases: ['Cholesterin', 'Total Cholesterol'],
        description: 'Structural component of cell membranes and precursor of steroid hormones.',
        referenceRanges: [
          { gender: 'ALL', ageMin: 0, ageMax: 120, minVal: 100, maxVal: 200, condition: 'ADULT', displayText: '< 200 mg/dL' }
        ]
      },
      'fbs': {
        name: 'Fasting Blood Sugar',
        shortCode: 'FBS',
        unit: 'mg/dL',
        category: 'Biochemistry',
        aliases: ['Fasting Blood Glucose', 'FBG'],
        description: 'Concentration of glucose in blood after fasting for at least 8 hours.',
        referenceRanges: [
          { gender: 'ALL', ageMin: 0, ageMax: 120, minVal: 70, maxVal: 100, condition: 'ADULT', displayText: '70 - 100 mg/dL' }
        ]
      },
      'hba1c': {
        name: 'HbA1c (Glycated Hemoglobin)',
        shortCode: 'HBA1C',
        unit: '%',
        category: 'Biochemistry',
        aliases: ['A1c', 'Glycohemoglobin'],
        description: 'Average level of blood sugar over the past 2 to 3 months.',
        referenceRanges: [
          { gender: 'ALL', ageMin: 0, ageMax: 120, minVal: 4.0, maxVal: 5.6, condition: 'ADULT', displayText: '4.0 - 5.6 %' }
        ]
      },
      'sgpt': {
        name: 'SGPT (ALT)',
        shortCode: 'SGPT',
        unit: 'U/L',
        category: 'Biochemistry',
        aliases: ['Alanine Aminotransferase', 'ALT'],
        description: 'Enzyme found mostly in the cells of the liver and kidneys, indicator of liver damage.',
        referenceRanges: [
          { gender: 'MALE', ageMin: 0, ageMax: 120, minVal: 10, maxVal: 50, condition: 'ADULT', displayText: '10 - 50 U/L' },
          { gender: 'FEMALE', ageMin: 0, ageMax: 120, minVal: 7, maxVal: 35, condition: 'ADULT', displayText: '7 - 35 U/L' }
        ]
      },
      'alt': {
        name: 'SGPT (ALT)',
        shortCode: 'SGPT',
        unit: 'U/L',
        category: 'Biochemistry',
        aliases: ['Alanine Aminotransferase', 'ALT'],
        description: 'Enzyme found mostly in the cells of the liver and kidneys, indicator of liver damage.',
        referenceRanges: [
          { gender: 'MALE', ageMin: 0, ageMax: 120, minVal: 10, maxVal: 50, condition: 'ADULT', displayText: '10 - 50 U/L' },
          { gender: 'FEMALE', ageMin: 0, ageMax: 120, minVal: 7, maxVal: 35, condition: 'ADULT', displayText: '7 - 35 U/L' }
        ]
      },
      'sgot': {
        name: 'SGOT (AST)',
        shortCode: 'SGOT',
        unit: 'U/L',
        category: 'Biochemistry',
        aliases: ['Aspartate Aminotransferase', 'AST'],
        description: 'Enzyme found mostly in heart and liver cells, indicator of liver or tissue damage.',
        referenceRanges: [
          { gender: 'ALL', ageMin: 0, ageMax: 120, minVal: 8, maxVal: 48, condition: 'ADULT', displayText: '8 - 48 U/L' }
        ]
      },
      'ast': {
        name: 'SGOT (AST)',
        shortCode: 'SGOT',
        unit: 'U/L',
        category: 'Biochemistry',
        aliases: ['Aspartate Aminotransferase', 'AST'],
        description: 'Enzyme found mostly in heart and liver cells, indicator of liver or tissue damage.',
        referenceRanges: [
          { gender: 'ALL', ageMin: 0, ageMax: 120, minVal: 8, maxVal: 48, condition: 'ADULT', displayText: '8 - 48 U/L' }
        ]
      },
      'bilirubin': {
        name: 'Total Bilirubin',
        shortCode: 'BIL-T',
        unit: 'mg/dL',
        category: 'Biochemistry',
        aliases: ['Bilirubin Total'],
        description: 'Yellow pigment generated during breakdown of red blood cells.',
        referenceRanges: [
          { gender: 'ALL', ageMin: 0, ageMax: 120, minVal: 0.2, maxVal: 1.2, condition: 'ADULT', displayText: '0.2 - 1.2 mg/dL' }
        ]
      },
      'creatinine': {
        name: 'Serum Creatinine',
        shortCode: 'CREAT',
        unit: 'mg/dL',
        category: 'Biochemistry',
        aliases: ['Creatinine'],
        description: 'Waste product produced by muscles, filtered out of the blood by the kidneys.',
        referenceRanges: [
          { gender: 'MALE', ageMin: 18, ageMax: 120, minVal: 0.7, maxVal: 1.3, condition: 'ADULT', displayText: '0.7 - 1.3 mg/dL' },
          { gender: 'FEMALE', ageMin: 18, ageMax: 120, minVal: 0.6, maxVal: 1.1, condition: 'ADULT', displayText: '0.6 - 1.1 mg/dL' }
        ]
      },
      'urea': {
        name: 'Blood Urea',
        shortCode: 'UREA',
        unit: 'mg/dL',
        category: 'Biochemistry',
        aliases: ['Urea'],
        description: 'Waste product of protein metabolism cleared by the kidneys.',
        referenceRanges: [
          { gender: 'ALL', ageMin: 0, ageMax: 120, minVal: 15, maxVal: 45, condition: 'ADULT', displayText: '15 - 45 mg/dL' }
        ]
      }
    };

    const directMatchKey = Object.keys(BUILT_IN_DICTIONARY).find(k => k === lowerQuery || BUILT_IN_DICTIONARY[k].name.toLowerCase() === lowerQuery || BUILT_IN_DICTIONARY[k].aliases.map(a => a.toLowerCase()).includes(lowerQuery));
    if (directMatchKey) {
      logger.info(`AI Resolver: Found matching parameter "${BUILT_IN_DICTIONARY[directMatchKey].name}" in offline fallback dictionary.`);
      return BUILT_IN_DICTIONARY[directMatchKey];
    }

    if (lowerQuery.includes('vitamin d') || lowerQuery.includes('25-oh')) {
      logger.info(`AI Resolver: Using offline fallback for Vitamin D.`);
      return {
        name: 'Vitamin D (25-Hydroxy)',
        shortCode: 'VIT-D',
        unit: 'ng/mL',
        category: 'Biochemistry',
        aliases: ['25-OH Vitamin D', 'Calcidiol'],
        description: 'Primary storage form of Vitamin D in the body, key for calcium absorption.',
        referenceRanges: [
          { gender: 'ALL', ageMin: 0, ageMax: 120, minVal: 30, maxVal: 100, condition: 'ADULT', displayText: '30 - 100 ng/mL' }
        ]
      };
    }

    if (lowerQuery.includes('vitamin b12') || lowerQuery.includes('cobalamin')) {
      logger.info(`AI Resolver: Using offline fallback for Vitamin B12.`);
      return {
        name: 'Vitamin B12',
        shortCode: 'VIT-B12',
        unit: 'pg/mL',
        category: 'Biochemistry',
        aliases: ['Cobalamin', 'Cyanocobalamin'],
        description: 'Essential nutrient for nerve tissue health, brain function, and red blood cell production.',
        referenceRanges: [
          { gender: 'ALL', ageMin: 0, ageMax: 120, minVal: 200, maxVal: 900, condition: 'ADULT', displayText: '200 - 900 pg/mL' }
        ]
      };
    }

    if (lowerQuery.includes('widal') || lowerQuery.includes('typhi')) {
      logger.info(`AI Resolver: Using offline fallback for Widal Test.`);
      return {
        name: 'Widal Test (Typhoid)',
        shortCode: 'WIDAL',
        unit: 'Titer',
        category: 'Immunology',
        aliases: ['Typhoid Antibody Test', 'Salmonella Agglutination'],
        description: 'Agglutination test for diagnosing typhoid fever.',
        referenceRanges: [
          { gender: 'ALL', ageMin: 0, ageMax: 120, condition: 'ADULT', displayText: 'Negative (< 1:80)' }
        ]
      };
    }

    // 3. Call Gemini AI v1 API Key if active
    const apiKey = geminiApiKey || process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `You are a medical lab parameter database. Resolve this parameter query: "${cleanedQuery}".
Return ONLY a valid JSON object matching this schema. Do not enclose in markdown code fences or write any explanations.

Schema:
{
  "name": "Standard Parameter Name",
  "shortCode": "Short Code (e.g. Hb)",
  "unit": "Standard unit (e.g. g/dL, mg/dL)",
  "category": "Hematology | Biochemistry | Endocrinology | Immunology | Urine Analysis",
  "aliases": ["Alternative name 1", "Alternative name 2"],
  "description": "Brief description of the test parameter",
  "referenceRanges": [
    {
      "gender": "MALE | FEMALE | ALL",
      "ageMin": 0,
      "ageMax": 120,
      "minVal": 13.5,
      "maxVal": 17.5,
      "condition": "ADULT",
      "displayText": "13.5 - 17.5 g/dL"
    }
  ]
}`
                    }
                  ]
                }
              ],
              generationConfig: {
                responseMimeType: 'application/json'
              }
            })
          }
        );

        if (response.ok) {
          const json = (await response.json()) as any;
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const data = JSON.parse(text) as AIResolveResult;
            logger.info(`AI Resolver successfully fetched parameter detail for "${cleanedQuery}" via Gemini API.`);
            return data;
          }
        } else {
          let errorMsg = 'Unknown Gemini API error';
          try {
            const errJson = (await response.json()) as any;
            errorMsg = errJson.error?.message || errorMsg;
          } catch (e) {}
          logger.error(`Gemini API request failed with status ${response.status}: ${errorMsg}. Falling back to simulation.`);
        }
      } catch (error) {
        logger.error('Gemini API call failed with exception:', error);
      }
    }

    // 4. Fallback Generic simulated output
    logger.info(`AI Resolver: Using fallback simulator for query "${cleanedQuery}".`);
    const words = cleanedQuery.split(' ');
    const shortCode = words.map(w => w[0]?.toUpperCase() || '').join('').slice(0, 5);
    const capitalizedName = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

    return {
      name: capitalizedName,
      shortCode: shortCode || 'PARAM',
      unit: 'mg/dL',
      category: 'Biochemistry',
      aliases: [cleanedQuery.toUpperCase()],
      description: `Lab parameter for assessing ${capitalizedName} levels in blood sample.`,
      referenceRanges: [
        { gender: 'ALL', ageMin: 18, ageMax: 120, minVal: 10.0, maxVal: 50.0, condition: 'ADULT', displayText: '10.0 - 50.0 mg/dL' },
        { gender: 'ALL', ageMin: 0, ageMax: 17, minVal: 8.0, maxVal: 40.0, condition: 'CHILD', displayText: '8.0 - 40.0 mg/dL' }
      ]
    };
  }
}
