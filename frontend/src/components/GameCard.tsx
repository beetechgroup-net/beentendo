import type { Game } from '../types';

interface GameCardProps {
  game: Game;
  isFavorite: boolean;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onClick: () => void;
}

export const GameCard = ({ game, isFavorite, onToggleFavorite, onClick }: GameCardProps) => {
  // O último preço da lista (mais recente)
  const latestPrice = game.prices && game.prices.length > 0
    ? game.prices[game.prices.length - 1]
    : null;

  if (!latestPrice) return null;

  const currencyCode = latestPrice.currency || 'BRL';
  const isPromo = latestPrice.salePrice !== null;
  const regularPrice = latestPrice.regularPrice;
  const currentPrice = isPromo ? latestPrice.salePrice! : regularPrice;

  // Calcula a porcentagem do desconto
  const discountPercent = isPromo
    ? Math.round((1 - currentPrice / regularPrice) * 100)
    : 0;

  // Formata o preço em Real Brasileiro ou Dólar Americano
  const formatPrice = (value: number) => {
    const locale = currencyCode === 'USD' ? 'en-US' : 'pt-BR';
    return value.toLocaleString(locale, { style: 'currency', currency: currencyCode });
  };

  const isSwitch2 = game.platform.toLowerCase().includes('switch 2') || game.platform.toLowerCase().includes('switch™ 2');

  return (
    <div className="game-card" onClick={onClick}>
      <div className="card-image-container">
        <button 
          type="button"
          className={`card-favorite-btn ${isFavorite ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(e);
          }}
          aria-label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          title={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        >
          <svg viewBox="0 0 24 24" className="star-icon">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
          </svg>
        </button>

        {game.coverImage ? (
          <img src={game.coverImage} alt={game.name} className="card-image" loading="lazy" />
        ) : (
          <div className="card-image-placeholder">Sem Capa</div>
        )}
        {isPromo && (
          <div className="discount-badge">
            -{discountPercent}%
          </div>
        )}
      </div>

      <div className="card-content">
        <span className={`platform-badge ${isSwitch2 ? 'platform-switch2' : 'platform-switch'}`}>
          {isSwitch2 ? 'Switch 2' : 'Switch'}
        </span>
        
        <h3 className="game-title" title={game.name}>
          {game.name}
        </h3>

        <div className="price-container">
          {isPromo ? (
            <div className="price-group">
              <span className="price-old">{formatPrice(regularPrice)}</span>
              <span className="price-new">{formatPrice(currentPrice)}</span>
            </div>
          ) : (
            <span className="price-normal">{formatPrice(regularPrice)}</span>
          )}
        </div>
      </div>
    </div>
  );
};
