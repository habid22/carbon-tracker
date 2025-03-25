const EMISSION_FACTORS = {
  productTypes: {
    electronics: 12.5,  // kg CO₂e/kg
    clothing: 3.2,
    furniture: 7.8,
    packaging: 2.1,
    general: 5.0
  },

  regions: {
    manufacturing: {
      'north-america': 1.1,
      europe: 0.9,
      asia: 1.3,
      global: 1.0
    },
    transportation: {
      'north-america': 0.8,  // kg CO₂e/kg
      europe: 0.6,
      asia: 1.2,
      global: 1.0
    }
  },

  materials: {
    plastic: 3.5,  // kg CO₂e/kg
    aluminum: 8.2,
    steel: 2.9,
    cotton: 2.1,
    wood: 0.8,
    glass: 0.7,
    rubber: 2.3
  },

  energyMix: {
    'north-america': 0.45,  // kg CO₂e/kWh
    europe: 0.35,
    asia: 0.55,
    global: 0.42
  }
};

const SCORE_THRESHOLDS = {
  EXCELLENT: 5,
  GOOD: 10,
  FAIR: 15,
  POOR: Infinity
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { weight, unit, productType, manufacturerRegion, materials } = req.body;

    // Validate inputs
    if (!weight || !unit || !productType || !manufacturerRegion) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Convert weight to kg
    const weightKg = convertToKg(parseFloat(weight), unit);

    // Base manufacturing impact
    const baseFactor = EMISSION_FACTORS.productTypes[productType] || 5.0;
    
    // Regional manufacturing multiplier
    const regionMultiplier = EMISSION_FACTORS.regions.manufacturing[manufacturerRegion] || 1.0;
    
    // Material impact
    const materialImpact = materials.reduce((acc, material) => 
      acc + (EMISSION_FACTORS.materials[material] || 0), 0);

    // Transportation impact
    const transportFactor = EMISSION_FACTORS.regions.transportation[manufacturerRegion] || 1.0;

    // Energy mix impact
    const energyFactor = EMISSION_FACTORS.energyMix[manufacturerRegion] || 0.42;

    // Detailed calculations
    const manufacturing = weightKg * baseFactor * regionMultiplier;
    const materialsTotal = weightKg * materialImpact;
    const transportation = weightKg * transportFactor;
    const energyImpact = manufacturing * energyFactor;

    const totalCO2 = manufacturing + materialsTotal + transportation + energyImpact;

    // Generate score
    const score = getCarbonScore(totalCO2);

    return res.status(200).json({
      carbonFootprint: {
        value: totalCO2,
        display: `${totalCO2.toFixed(2)} kg CO₂e`
      },
      breakdown: {
        manufacturing: parseFloat(manufacturing.toFixed(2)),
        materials: parseFloat(materialsTotal.toFixed(2)),
        transportation: parseFloat(transportation.toFixed(2)),
        energy: parseFloat(energyImpact.toFixed(2))
      },
      factors: {
        productType,
        manufacturerRegion,
        materials,
        energyMix: energyFactor
      },
      score
    });

  } catch (error) {
    return res.status(400).json({
      error: error.message || 'Calculation error',
      details: error.details
    });
  }
}

function convertToKg(value, unit) {
  if (isNaN(value)) throw new Error('Invalid weight value');
  
  const conversions = {
    kg: v => v,
    g: v => v / 1000,
    lb: v => v * 0.453592,
    oz: v => v * 0.0283495
  };

  if (!conversions[unit]) throw new Error(`Invalid unit: ${unit}`);
  return conversions[unit](value);
}

function getCarbonScore(totalCO2) {
  const levels = [
    { rating: 'EXCELLENT', max: SCORE_THRESHOLDS.EXCELLENT, color: '#4CAF50' },
    { rating: 'GOOD', max: SCORE_THRESHOLDS.GOOD, color: '#8BC34A' },
    { rating: 'FAIR', max: SCORE_THRESHOLDS.FAIR, color: '#FFC107' },
    { rating: 'POOR', max: SCORE_THRESHOLDS.POOR, color: '#F44336' }
  ];

  const currentLevel = levels.find(l => totalCO2 <= l.max);
  const prevMax = levels[levels.indexOf(currentLevel) - 1]?.max || 0;
  
  const percentage = Math.round(
    ((totalCO2 - prevMax) / (currentLevel.max - prevMax)) * 100
  );

  return {
    rating: currentLevel.rating,
    color: currentLevel.color,
    percentage: Math.min(Math.max(percentage, 0), 100), // Clamp between 0-100
    scale: levels.map(l => ({
      rating: l.rating,
      threshold: l.max,
      color: l.color
    }))
  };
}