import { useEffect, useState } from 'react';
import type { Game, GamesResponse } from './types';
import { GameCard } from './components/GameCard';
import { GameModal } from './components/GameModal';

const DATA_SOURCE = import.meta.env.VITE_DATA_SOURCE || 'json';
const API_URL = DATA_SOURCE === 'json' ? './games.json' : 'http://localhost:8080/games';

const formatUpdateDate = (dateStr: string | null) => {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return dateStr;
  }
};

function App() {
  const [games, setGames] = useState<Game[]>([]);
  const [updateDate, setUpdateDate] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [onlyPromo, setOnlyPromo] = useState<boolean>(false);
  const [showMobileFilters, setShowMobileFilters] = useState<boolean>(false);
  
  // Controle de Modal
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  useEffect(() => {
    fetchGames();
  }, []);

  const fetchGames = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(API_URL);
      if (!response.ok) {
        throw new Error('Falha ao carregar a lista de jogos do servidor.');
      }
      const data: Game[] | GamesResponse = await response.json();
      if (Array.isArray(data)) {
        setGames(data);
        setUpdateDate(null);
      } else if (data && Array.isArray(data.games)) {
        setGames(data.games);
        setUpdateDate(data.updateDate || null);
      } else {
        setGames([]);
        setUpdateDate(null);
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro desconectado do servidor.');
    } finally {
      setLoading(false);
    }
  };

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setSelectedPlatforms([]);
    setOnlyPromo(false);
  };

  // Filtragem dos jogos
  const filteredGames = games.filter(game => {
    const matchesSearch = game.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const isSwitch2 = game.platform.toLowerCase().includes('switch 2') || game.platform.toLowerCase().includes('switch™ 2');
    const platformKey = isSwitch2 ? 'switch 2' : 'switch';
    
    const matchesPlatform = selectedPlatforms.length === 0 || selectedPlatforms.includes(platformKey);
    
    const latestPrice = game.prices && game.prices.length > 0
      ? game.prices[game.prices.length - 1]
      : null;
    const isPromo = latestPrice ? latestPrice.salePrice !== null : false;
    
    const matchesPromo = !onlyPromo || isPromo;
    
    return matchesSearch && matchesPlatform && matchesPromo;
  });

  // Estatísticas Rápidas
  const totalGames = games.length;
  const promoGamesCount = games.filter(game => {
    const latest = game.prices?.[game.prices.length - 1];
    return latest && latest.salePrice !== null;
  }).length;

  return (
    <>
      {/* Backdrops de Brilho HSL */}
      <div className="glow-container">
        <div className="glow-red"></div>
        <div className="glow-blue"></div>
      </div>

      <div className="app-container">
        {/* Header principal */}
        <header className="app-header">
          <div className="header-logo-group">
            <span className="logo-icon">🎮</span>
            <div>
              <h1 className="app-main-title">Beetendo Prices</h1>
              <p className="app-subtitle">Acompanhamento e histórico de preços dos mais vendidos</p>
            </div>
          </div>
          
          <div className="stats-row">
            <div className="stat-card">
              <span className="stat-value">{totalGames}</span>
              <span className="stat-label">Jogos Monitorados</span>
            </div>
            <div className="stat-card border-promo">
              <span className="stat-value text-promo">{promoGamesCount}</span>
              <span className="stat-label">Em Promoção</span>
            </div>
          </div>
        </header>

        {/* Layout Principal em duas colunas */}
        <div className="main-layout">
          {/* Botão de Toggle Filtros no Mobile */}
          <button 
            className="mobile-filters-toggle-btn"
            onClick={() => setShowMobileFilters(!showMobileFilters)}
          >
            <span>🔍 Filtrar e Buscar</span>
            <span>{showMobileFilters ? '▲ Ocultar' : '▼ Mostrar'}</span>
          </button>

          {/* Barra Lateral de Filtros */}
          <aside className={`filters-sidebar ${showMobileFilters ? 'mobile-open' : ''}`}>
            {/* Grupo de Busca */}
            <div className="filter-group">
              <h3 className="filter-group-title">Buscar</h3>
              <div className="search-wrapper">
                <span className="search-icon">🔍</span>
                <input 
                  type="text" 
                  placeholder="Nome do jogo..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>
            </div>

            {/* Grupo de Plataformas */}
            <div className="filter-group">
              <h3 className="filter-group-title">Plataformas</h3>
              <div className="filter-options">
                <label className="filter-checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={selectedPlatforms.includes('switch')}
                    onChange={() => togglePlatform('switch')}
                  />
                  <span className="custom-checkbox"></span>
                  <span>Nintendo Switch</span>
                </label>

                <label className="filter-checkbox-label switch2-checkbox">
                  <input 
                    type="checkbox" 
                    checked={selectedPlatforms.includes('switch 2')}
                    onChange={() => togglePlatform('switch 2')}
                  />
                  <span className="custom-checkbox"></span>
                  <span>Switch 2</span>
                </label>
              </div>
            </div>

            {/* Grupo de Promoções */}
            <div className="filter-group">
              <h3 className="filter-group-title">Ofertas</h3>
              <div className="filter-options">
                <label className="filter-checkbox-label promo-checkbox">
                  <input 
                    type="checkbox" 
                    checked={onlyPromo}
                    onChange={() => setOnlyPromo(!onlyPromo)}
                  />
                  <span className="custom-checkbox"></span>
                  <span className="text-promo">🔥 Em Promoção</span>
                </label>
              </div>
            </div>

            {/* Resumo de resultados e Limpar Filtros */}
            <div className="sidebar-footer">
              <div className="results-count">
                {filteredGames.length} {filteredGames.length === 1 ? 'jogo encontrado' : 'jogos encontrados'}
              </div>
              
              {(searchTerm || selectedPlatforms.length > 0 || onlyPromo) && (
                <button className="clear-filters-btn" onClick={clearAllFilters}>
                  🗑️ Limpar Filtros
                </button>
              )}

              {updateDate && (
                <div className="update-date-badge">
                  <span className="update-date-icon">🕒</span>
                  <span className="update-date-text">
                    Atualizado em <strong>{formatUpdateDate(updateDate)}</strong>
                  </span>
                </div>
              )}
            </div>
          </aside>

          {/* Área Principal de Exibição */}
          <section className="main-content">
            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Carregando os jogos da eShop...</p>
              </div>
            ) : error ? (
              <div className="error-state">
                <span className="error-icon">⚠️</span>
                <p className="error-message">{error}</p>
                <button onClick={fetchGames} className="retry-btn">Tentar Novamente</button>
              </div>
            ) : filteredGames.length === 0 ? (
              <div className="empty-state">
                <p>Nenhum jogo encontrado para os filtros selecionados.</p>
                {(searchTerm || selectedPlatforms.length > 0 || onlyPromo) && (
                  <button className="retry-btn" style={{ marginTop: '15px' }} onClick={clearAllFilters}>
                    Limpar Filtros
                  </button>
                )}
              </div>
            ) : (
              <main className="games-grid">
                {filteredGames.map(game => (
                  <GameCard 
                    key={game.id} 
                    game={game} 
                    onClick={() => setSelectedGame(game)} 
                  />
                ))}
              </main>
            )}
          </section>
        </div>

        {/* Modal de Detalhes */}
        {selectedGame && (
          <GameModal 
            game={selectedGame} 
            onClose={() => setSelectedGame(null)} 
          />
        )}

        {/* Rodapé da Aplicação */}
        <footer className="app-footer">
          {updateDate && (
            <p className="footer-update-info">
              🕒 Última atualização da listagem: <strong>{formatUpdateDate(updateDate)}</strong>
            </p>
          )}
          <p className="footer-copyright">Beetendo Prices &copy; {new Date().getFullYear()} - Dados da Nintendo eShop</p>
        </footer>
      </div>
    </>
  );
}

export default App;
