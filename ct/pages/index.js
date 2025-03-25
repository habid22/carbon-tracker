import { useState } from 'react';

export default function Home() {
  const [inputs, setInputs] = useState({
    weight: '',
    unit: 'kg',
    productType: 'general',
    manufacturerRegion: 'global',
    materials: []
  });
  
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const productCategories = [
    { value: 'electronics', label: '🖥️ Electronics' },
    { value: 'clothing', label: '👕 Clothing' },
    { value: 'furniture', label: '🛋️ Furniture' },
    { value: 'packaging', label: '📦 Packaging' },
    { value: 'general', label: '📦 General Product' }
  ];

  const materialOptions = [
    { value: 'plastic', label: 'Plastic' },
    { value: 'aluminum', label: 'Aluminum' },
    { value: 'steel', label: 'Steel' },
    { value: 'cotton', label: 'Cotton' },
    { value: 'wood', label: 'Wood' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/carbon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputs)
      });

      const data = await res.json();
      
      if (res.ok) {
        setResult(data);
      } else {
        setError(data.error || 'Calculation error');
      }
    } catch (err) {
      setError('Network error');
    }
    setLoading(false);
  };

  return (
    <div className="container">
      <h1>Advanced Carbon Calculator</h1>
      
      <form onSubmit={handleSubmit}>
        {/* Weight Input */}
        <div className="input-group">
          <label>Product Weight:</label>
          <div className="input-row">
            <input
              type="number"
              value={inputs.weight}
              onChange={(e) => setInputs({...inputs, weight: e.target.value})}
              placeholder="Enter weight"
              step="0.1"
              required
            />
            <select
              value={inputs.unit}
              onChange={(e) => setInputs({...inputs, unit: e.target.value})}
            >
              <option value="kg">kg</option>
              <option value="g">g</option>
              <option value="lb">lb</option>
              <option value="oz">oz</option>
            </select>
          </div>
        </div>

        {/* Product Type */}
        <div className="input-group">
          <label>Product Category:</label>
          <div className="category-grid">
            {productCategories.map((cat) => (
              <button
                type="button"
                key={cat.value}
                className={inputs.productType === cat.value ? 'active' : ''}
                onClick={() => setInputs({...inputs, productType: cat.value})}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Materials */}
        <div className="input-group">
          <label>Primary Materials:</label>
          <div className="material-grid">
            {materialOptions.map((mat) => (
              <label key={mat.value} className="material-option">
                <input
                  type="checkbox"
                  checked={inputs.materials.includes(mat.value)}
                  onChange={(e) => {
                    const materials = e.target.checked
                      ? [...inputs.materials, mat.value]
                      : inputs.materials.filter(m => m !== mat.value);
                    setInputs({...inputs, materials});
                  }}
                />
                {mat.label}
              </label>
            ))}
          </div>
        </div>

        {/* Manufacturer Region */}
        <div className="input-group">
          <label>Manufacturing Region:</label>
          <select
            value={inputs.manufacturerRegion}
            onChange={(e) => setInputs({...inputs, manufacturerRegion: e.target.value})}
          >
            <option value="north-america">North America</option>
            <option value="europe">Europe</option>
            <option value="asia">Asia</option>
            <option value="global">Global Average</option>
          </select>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Calculating...' : 'Calculate Footprint'}
        </button>
      </form>

      {result && (
        <div className="results">
          <h2>Carbon Analysis</h2>
          <div className="score-card" style={{borderColor: result.score.color}}>
            <div className="main-score">
              {result.carbonFootprint.display}
              <div className="score-rating">{result.score.rating}</div>
            </div>
            <div className="breakdown">
              <div className="breakdown-item">
                <span>Manufacturing</span>
                <span>{result.breakdown.manufacturing.toFixed(2)} kg</span>
              </div>
              <div className="breakdown-item">
                <span>Transport</span>
                <span>{result.breakdown.transportation.toFixed(2)} kg</span>
              </div>
              <div className="breakdown-item">
                <span>Materials</span>
                <span>{result.breakdown.materials.toFixed(2)} kg</span>
              </div>
            </div>
          </div>
          
          <div className="assumptions">
            <h3>Key Factors</h3>
            <ul>
              <li>Product Type: {result.factors.productType}</li>
              <li>Manufacturing Region: {result.factors.manufacturerRegion}</li>
              <li>Materials: {result.factors.materials.join(', ') || 'N/A'}</li>
            </ul>
          </div>
        </div>
      )}

      {error && <div className="error">{error}</div>}

      <style jsx>{`
        .container {
          max-width: 800px;
          margin: 2rem auto;
          padding: 0 1rem;
        }
        
        .input-group {
          margin-bottom: 1.5rem;
        }
        
        .input-row {
          display: flex;
          gap: 1rem;
        }
        
        .category-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 0.5rem;
        }
        
        button.active {
          background: #0070f3;
          color: white;
        }
        
        .results {
          margin-top: 2rem;
          padding: 1.5rem;
          background: #f8f9fa;
          border-radius: 8px;
        }
        
        .score-card {
          border-left: 4px solid;
          padding: 1rem;
          margin: 1rem 0;
        }
        
        .breakdown-item {
          display: flex;
          justify-content: space-between;
          margin: 0.5rem 0;
        }
      `}</style>
    </div>
  );
}