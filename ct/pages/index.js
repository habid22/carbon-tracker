import { useState } from 'react';
import axios from 'axios';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

export default function Home() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url) return;
    
    setLoading(true);
    setError('');
    
    try {
      const { data } = await axios.post('/api/calculate', { url });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to calculate footprint');
    }
    setLoading(false);
  };

  return (
    <div className="container">
      <h1>🌱 EcoFootprint Calculator</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter product URL (e.g., Amazon, eBay)"
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Analyzing...' : 'Calculate'}
        </button>
      </form>

      {error && <div className="error-box">{error}</div>}

      {loading ? (
        <div className="skeleton-container">
          <Skeleton height={30} width={200} />
          <Skeleton height={100} count={3} />
        </div>
      ) : result && (
        <div className="results">
          <h2>{result.productName || 'Unknown Product'}</h2>
          
          <div className="carbon-score">
            <div className="score-badge">
              {result.carbonFootprint} gCO₂e
            </div>
            <p className="impact-label">
              {getImpactLabel(result.carbonFootprint)}
            </p>
          </div>

          <div className="breakdown">
            <h3>Emission Breakdown</h3>
            <div className="breakdown-grid">
              <div className="breakdown-item">
                <span>Manufacturing</span>
                <span>{result.breakdown.manufacturing}g</span>
              </div>
              <div className="breakdown-item">
                <span>Transportation</span>
                <span>{result.breakdown.transportation}g</span>
              </div>
              <div className="breakdown-item">
                <span>Materials</span>
                <span>{result.breakdown.materials}g</span>
              </div>
            </div>
          </div>

          {result.assumptions.length > 0 && (
            <div className="assumptions">
              <h3>Calculation Assumptions</h3>
              <ul>
                {result.assumptions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="disclaimer">
            * Estimates based on industry averages and publicly available data
          </p>
        </div>
      )}
    </div>
  );
}

function getImpactLabel(score) {
  if (score < 500) return 'Low Impact 🌿';
  if (score < 2000) return 'Moderate Impact ⚠️';
  if (score < 5000) return 'High Impact 🔥';
  return 'Very High Impact 🚨';
}