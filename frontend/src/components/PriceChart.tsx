import { useState } from 'react';
import type { PriceRecord } from '../types';

interface PriceChartProps {
  prices: PriceRecord[];
}

export const PriceChart = ({ prices }: PriceChartProps) => {
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    price: number;
    date: string;
    isPromo: boolean;
  } | null>(null);

  if (!prices || prices.length === 0) {
    return <div className="no-chart-data">Sem histórico de preço registrado.</div>;
  }

  // Prepara os dados (calcula o preço ativo para cada ponto)
  const data = prices.map(p => ({
    date: new Date(p.recordedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
    price: p.salePrice !== null ? p.salePrice : p.regularPrice,
    isPromo: p.salePrice !== null,
    rawDate: p.recordedAt
  }));

  // Dimensões do gráfico
  const width = 600;
  const height = 220;
  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Encontra os valores máximos e mínimos para escala
  const allPrices = prices.flatMap(p => [p.regularPrice, p.salePrice].filter(v => v !== null) as number[]);
  const maxPrice = Math.max(...allPrices, 10) * 1.1; // 10% margem no topo
  const minPrice = Math.max(0, Math.min(...allPrices) * 0.9); // 10% margem abaixo, mínimo 0

  const priceRange = maxPrice - minPrice;

  // Mapeia os pontos do gráfico para coordenadas SVG
  const points = data.map((d, index) => {
    const x = paddingLeft + (data.length > 1 ? (index / (data.length - 1)) * chartWidth : chartWidth / 2);
    // Y vai de cima para baixo no SVG
    const y = paddingTop + chartHeight - ((d.price - minPrice) / (priceRange || 1)) * chartHeight;
    return { x, y, price: d.price, date: d.date, isPromo: d.isPromo };
  });

  // Cria a string do Path para a linha
  const pathD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  // Cria a string do Path para a área sombreada
  const areaD = points.length > 0 
    ? `${pathD} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`
    : '';

  // Níveis do eixo Y (3 linhas de grade horizontais)
  const yTicks = [minPrice, minPrice + priceRange / 2, maxPrice];

  const currencyCode = prices[0]?.currency || 'BRL';
  const currencySymbol = currencyCode === 'USD' ? '$' : 'R$';

  return (
    <div className="chart-container" style={{ position: 'relative', width: '100%' }}>
      <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)', marginBottom: '16px', fontSize: '1.1rem', fontWeight: 600 }}>
        Histórico de Preço ({currencySymbol})
      </h3>
      
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="auto" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-red)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--accent-red)" stopOpacity="0.0" />
          </linearGradient>
        </defs>
 
        {/* Linhas de Grade e Eixo Y */}
        {yTicks.map((val, idx) => {
          const y = paddingTop + chartHeight - ((val - minPrice) / (priceRange || 1)) * chartHeight;
          return (
            <g key={idx} opacity="0.4">
              <line 
                x1={paddingLeft} 
                y1={y} 
                x2={width - paddingRight} 
                y2={y} 
                stroke="var(--color-text-muted)" 
                strokeWidth="1" 
                strokeDasharray="4 4" 
              />
              <text 
                x={paddingLeft - 10} 
                y={y + 4} 
                fill="var(--color-text-secondary)" 
                fontSize="10" 
                textAnchor="end"
                fontFamily="var(--font-body)"
              >
                {currencySymbol} {val.toFixed(0)}
              </text>
            </g>
          );
        })}

        {/* Eixo X - Primeira e última data */}
        {data.length > 0 && (
          <g fill="var(--color-text-secondary)" fontSize="9" fontFamily="var(--font-body)" opacity="0.8">
            <text x={paddingLeft} y={height - 15} textAnchor="start">
              {data[0].date.split(',')[0]}
            </text>
            {data.length > 1 && (
              <text x={width - paddingRight} y={height - 15} textAnchor="end">
                {data[data.length - 1].date.split(',')[0]}
              </text>
            )}
          </g>
        )}

        {/* Área Sombreada com Gradiente */}
        {areaD && <path d={areaD} fill="url(#chartGradient)" />}

        {/* Linha do Gráfico */}
        {pathD && (
          <path 
            d={pathD} 
            fill="none" 
            stroke="var(--accent-red)" 
            strokeWidth="3" 
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Pontos interativos e áreas de hover */}
        {points.map((p, i) => (
          <g key={i}>
            <circle 
              cx={p.x} 
              cy={p.y} 
              r={hoveredPoint?.date === p.date ? 6 : 4} 
              fill={p.isPromo ? 'var(--accent-green)' : 'var(--accent-red)'}
              stroke="var(--bg-app)"
              strokeWidth="2"
            />
            {/* Círculo invisível maior para facilitar o hover com o mouse */}
            <circle 
              cx={p.x} 
              cy={p.y} 
              r="15" 
              fill="transparent" 
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredPoint(p)}
              onMouseLeave={() => setHoveredPoint(null)}
            />
          </g>
        ))}
      </svg>

      {/* Tooltip Renderizado Dinamicamente */}
      {hoveredPoint && (
        <div className="chart-tooltip" style={{
          position: 'absolute',
          left: `${(hoveredPoint.x / width) * 100}%`,
          top: `${(hoveredPoint.y / height) * 100 - 15}%`,
          transform: 'translate(-50%, -100%)',
          backgroundColor: '#1e293b',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '6px',
          padding: '6px 10px',
          fontSize: '0.75rem',
          zIndex: 10,
          pointerEvents: 'none',
          boxShadow: 'var(--glass-shadow)',
          whiteSpace: 'nowrap',
          transition: 'all 0.1s ease'
        }}>
          <div style={{ fontWeight: 600, color: '#f8fafc' }}>
            {currencySymbol} {hoveredPoint.price.toFixed(2)}
            {hoveredPoint.isPromo && <span style={{ color: 'var(--accent-green)', marginLeft: '6px' }}>(Promo)</span>}
          </div>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.65rem', marginTop: '2px' }}>
            {hoveredPoint.date}
          </div>
        </div>
      )}
    </div>
  );
};
