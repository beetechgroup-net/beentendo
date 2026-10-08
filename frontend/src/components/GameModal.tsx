import type { Game } from '../types';
import { PriceChart } from './PriceChart';

interface GameModalProps {
  game: Game;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onClose: () => void;
}

export const GameModal = ({ game, isFavorite, onToggleFavorite, onClose }: GameModalProps) => {
  const latestPrice = game.prices && game.prices.length > 0
    ? game.prices[game.prices.length - 1]
    : null;

  if (!latestPrice) return null;

  const currencyCode = latestPrice.currency || 'BRL';
  const isPromo = latestPrice.salePrice !== null;
  const currentPrice = isPromo ? latestPrice.salePrice! : latestPrice.regularPrice;
  const regularPrice = latestPrice.regularPrice;

  const discountPercent = isPromo
    ? Math.round((1 - currentPrice / regularPrice) * 100)
    : 0;

  const formatPrice = (value: number, code: string = 'BRL') => {
    const locale = code === 'USD' ? 'en-US' : 'pt-BR';
    return value.toLocaleString(locale, { style: 'currency', currency: code });
  };

  const isSwitch2 = game.platform.toLowerCase().includes('switch 2') || game.platform.toLowerCase().includes('switch™ 2');

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Fechar">
          &times;
        </button>

        <div className="modal-grid">
          {/* Lado Esquerdo - Detalhes Rápidos */}
          <div className="modal-sidebar">
            <div className="modal-image-wrapper">
              {game.coverImage ? (
                <img src={game.coverImage} alt={game.name} className="modal-image" />
              ) : (
                <div className="modal-image-placeholder">Sem Capa</div>
              )}
            </div>
            
            <div className="modal-meta">
              <div className="modal-meta-header">
                <span className={`platform-badge ${isSwitch2 ? 'platform-switch2' : 'platform-switch'}`}>
                  {isSwitch2 ? 'Switch 2' : 'Switch'}
                </span>
                <button
                  type="button"
                  className={`modal-favorite-btn ${isFavorite ? 'active' : ''}`}
                  onClick={onToggleFavorite}
                  aria-label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                  title={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                >
                  <svg viewBox="0 0 24 24" className="star-icon">
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
                  <span>{isFavorite ? 'Favoritado' : 'Favoritar'}</span>
                </button>
              </div>

              <h2 className="modal-game-title">{game.name}</h2>
              {game.nsuid && <div className="modal-nsuid">NSUID: {game.nsuid}</div>}

              <div className="modal-price-block">
                <div className="price-label">Preço Atual</div>
                <div className="modal-price-row">
                  <span className="modal-price-active">{formatPrice(currentPrice, currencyCode)}</span>
                  {isPromo && (
                    <span className="modal-discount-percent">
                      -{discountPercent}% OFF
                    </span>
                  )}
                </div>
                {isPromo && (
                  <div className="modal-regular-price">
                    Preço normal: <span className="strikethrough">{formatPrice(regularPrice, currencyCode)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Lado Direito - Histórico e Gráficos */}
          <div className="modal-main">
            {/* Gráfico SVG */}
            <div className="modal-chart-section">
              <PriceChart prices={game.prices} />
            </div>

            {/* Tabela de Preços */}
            <div className="price-history-section">
              <h4 className="history-title">Registro de Alterações</h4>
              <div className="table-wrapper">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Preço Regular</th>
                      <th>Preço Promocional</th>
                      <th>Data do Registro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...game.prices].reverse().map((record) => (
                      <tr key={record.id}>
                        <td>{formatPrice(record.regularPrice, record.currency)}</td>
                        <td className={record.salePrice ? 'text-promo' : ''}>
                          {record.salePrice ? formatPrice(record.salePrice, record.currency) : 'Sem Promoção'}
                        </td>
                        <td>{formatDate(record.recordedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
