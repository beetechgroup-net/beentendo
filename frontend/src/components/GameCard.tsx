import type { Game } from '../types';

interface GameCardProps {
  game: Game;
  onClick: () => void;
}

export const GameCard = ({ game, onClick }: GameCardProps) => {
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
