import { createClient } from 'redis';
import * as cheerio from 'cheerio';
import got from 'got';

// Initialize Redis
const redis = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    reconnectStrategy: (retries) => Math.min(retries * 100, 3000)
  }
});

await redis.connect().catch(() => {
  console.log('Redis connection failed - using fallback');
});

// Emission factors (grams CO2e)
const EMISSION_FACTORS = {
  categories: {
    electronics: 85,
    clothing: 15,
    furniture: 30,
    appliances: 120,
    general: 50
  },
  materials: {
    plastic: 6,
    cotton: 4,
    metal: 8,
    glass: 10,
    composite: 15
  },
  shipping: {
    air: 0.5,
    sea: 0.01,
    road: 0.2
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });
    
    let cached;
    if (redis.isOpen) {
      cached = await redis.get(`footprint:${url}`);
      if (cached) return res.json(JSON.parse(cached));
    }

    // Validate and parse URL
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch (e) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Scrape product data
    const { body } = await got(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EcoFootprintBot/1.0)'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(body);
    const productData = await extractProductData($);
    const footprint = calculateFootprint(productData);

    if (redis.isOpen) {
      await redis.setEx(`footprint:${url}`, 3600, JSON.stringify(footprint));
    }

    res.status(200).json(footprint);
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: 'Failed to analyze product' });
  }
}

function calculateFootprint(product) {
  const assumptions = [];
  
  // Manufacturing emissions
  const categoryFactor = EMISSION_FACTORS.categories[product.category] || 50;
  const manufacturing = product.weight * categoryFactor;
  assumptions.push(`Manufacturing: ${categoryFactor}g/kg for ${product.category}`);

  // Material emissions
  const materialFactor = EMISSION_FACTORS.materials[product.material] || 15;
  const materials = product.weight * materialFactor;
  assumptions.push(`Material: ${materialFactor}g/kg for ${product.material}`);

  // Shipping emissions
  const shippingMode = getShippingMode(product.origin);
  const shippingDistance = estimateShippingDistance(product.origin);
  const shipping = product.weight * EMISSION_FACTORS.shipping[shippingMode] * shippingDistance;
  assumptions.push(`${shippingMode} shipping from ${product.origin} (${shippingDistance}km)`);

  const total = Math.round(manufacturing + materials + shipping);

  return {
    productName: product.name,
    carbonFootprint: total,
    breakdown: {
      manufacturing: Math.round(manufacturing),
      materials: Math.round(materials),
      transportation: Math.round(shipping)
    },
    assumptions
  };
}

// Helper functions
function getShippingMode(origin) {
  const seaCountries = ['CN', 'IN', 'VN', 'ID', 'MY'];
  return seaCountries.includes(origin) ? 'sea' : 'air';
}

function estimateShippingDistance(origin) {
  // Distances from common manufacturing countries to US/EU
  const distances = {
    CN: 8000, // China
    IN: 7000, // India
    DE: 500,  // Germany
    US: 1500, // USA domestic
    VN: 9000  // Vietnam
  };
  return distances[origin] || 5000;
}