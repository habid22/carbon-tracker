import { NextApiRequest, NextApiResponse } from 'next';
import * as cheerio from 'cheerio';
import got from 'got';
import { createClient } from 'redis';

// Initialize Redis
const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});
await redis.connect();

// Emission factors (grams CO2e)
const EMISSION_FACTORS = {
  categories: {
    electronics: 85,    // per kg
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
    air: 0.5,     // per kg/km
    sea: 0.01,
    road: 0.2
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });
    
    // Check cache
    const cached = await redis.get(`footprint:${url}`);
    if (cached) return res.json(JSON.parse(cached));

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
        'User-Agent': 'Mozilla/5.0 (compatible; EcoFootprintBot/1.0; +https://ecofootprint.app)'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(body);
    const productData = await extractProductData($);
    const footprint = calculateFootprint(productData);

    // Cache for 1 hour
    await redis.setEx(`footprint:${url}`, 3600, JSON.stringify(footprint));

    res.status(200).json(footprint);
  } catch (error) {
    console.error('Error:', error.message);
    const status = error.response?.statusCode || 500;
    res.status(status).json({ 
      error: error.response?.statusMessage || 'Failed to analyze product' 
    });
  }
}

async function extractProductData($) {
  // Try structured data first
  const ldJson = parseStructuredData($);
  if (ldJson) return ldJson;

  // Fallback to meta tags
  return {
    name: $('meta[property="og:title"]').attr('content') || $('title').text().trim(),
    price: parseFloat(
      $('meta[property="product:price:amount"]').attr('content') || '0'
    ),
    weight: parseFloat(
      $('meta[property="product:weight:value"]').attr('content') || '1'
    ),
    category: ($('meta[property="product:category"]').attr('content') || 'general')
      .toLowerCase(),
    material: ($('meta[property="product:material"]').attr('content') || 'composite')
      .toLowerCase(),
    origin: $('meta[property="product:origin"]').attr('content') || 'CN'
  };
}

function parseStructuredData($) {
  try {
    const scripts = $('script[type="application/ld+json"]');
    for (const script of scripts) {
      const json = JSON.parse(script.children[0].data.replace(/\\/g, ''));
      if (json['@type'] === 'Product') {
        return {
          name: json.name,
          price: json.offers?.price || 0,
          weight: json.weight?.value || 1,
          category: (json.category || 'general').toLowerCase(),
          material: (json.material || 'composite').toLowerCase(),
          origin: json.countryOfOrigin || 'CN'
        };
      }
    }
  } catch (e) {
    return null;
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