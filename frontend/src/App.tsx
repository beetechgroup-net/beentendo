import { useEffect, useState } from 'react';
import type { Game, GamesResponse, SortField, SortOrder } from './types';
import { GameCard } from './components/GameCard';
import { GameModal } from './components/GameModal';

const DATA_SOURCE = import.meta.env.VITE_DATA_SOURCE || 'backend';
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const API_URL = DATA_SOURCE === 'json' ? './games.json' : `${API_BASE_URL.replace(/\/$/, '')}/games`;

const getGameCurrentPrice = (game: Game): number => {
  const latest = game.prices && game.prices.length > 0 ? game.prices[game.prices.length - 1] : null;
  if (!latest) return 0;
  return latest.salePrice !== null ? Number(latest.salePrice) : Number(latest.regularPrice);
};

const getGameDiscountPercent = (game: Game): number => {
  const latest = game.prices && game.prices.length > 0 ? game.prices[game.prices.length - 1] : null;
  if (!latest || latest.salePrice === null || !latest.regularPrice || Number(latest.regularPrice) <= 0) return 0;
  return Math.round((1 - Number(latest.salePrice) / Number(latest.regularPrice)) * 100);
};

const getGameDiscountValue = (game: Game): number => {
  const latest = game.prices && game.prices.length > 0 ? game.prices[game.prices.length - 1] : null;
  if (!latest || latest.salePrice === null || !latest.regularPrice) return 0;
  return Math.max(0, Number(latest.regularPrice) - Number(latest.salePrice));
};

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
  
  // Favoritos
  const [favorites, setFavorites] = useState<number[]>(() => {
    try {
      const stored = localStorage.getItem('beetendo_favorites');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Filtros
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [onlyPromo, setOnlyPromo] = useState<boolean>(false);
  const [onlyFavorites, setOnlyFavorites] = useState<boolean>(false);
  const [showMobileFilters, setShowMobileFilters] = useState<boolean>(false);
  
  // Ordenação
  const [sortBy, setSortBy] = useState<SortField>('none');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  
  // Controle de Modal
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  useEffect(() => {
    fetchGames();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('beetendo_favorites', JSON.stringify(favorites));
    } catch (err) {
      console.error('Erro ao salvar favoritos no localStorage:', err);
    }
  }, [favorites]);

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

  const toggleFavorite = (gameId: number) => {
    setFavorites(prev =>
      prev.includes(gameId)
        ? prev.filter(id => id !== gameId)
        : [...prev, gameId]
    );
  };

  const handleSortByChange = (field: SortField) => {
    setSortBy(field);
    if (field === 'price') {
      setSortOrder('asc');
    } else if (field === 'discountPercent' || field === 'discountValue') {
      setSortOrder('desc');
    }
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    if (sortBy === 'none') {
      setSortBy('price');
    }
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setSelectedPlatforms([]);
    setOnlyPromo(false);
    setOnlyFavorites(false);
    setSortBy('none');
    setSortOrder('asc');
  };

  const hasActiveFilters =
    searchTerm !== '' ||
    selectedPlatforms.length > 0 ||
    onlyPromo ||
    onlyFavorites ||
    sortBy !== 'none';

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
    const matchesFavorites = !onlyFavorites || favorites.includes(game.id);
    
    return matchesSearch && matchesPlatform && matchesPromo && matchesFavorites;
  });

  // Ordenação dos jogos filtrados
  const sortedGames = [...filteredGames].sort((a, b) => {
    if (sortBy === 'none') return 0;

    let valA = 0;
    let valB = 0;

    if (sortBy === 'price') {
      valA = getGameCurrentPrice(a);
      valB = getGameCurrentPrice(b);
    } else if (sortBy === 'discountPercent') {
      valA = getGameDiscountPercent(a);
      valB = getGameDiscountPercent(b);
    } else if (sortBy === 'discountValue') {
      valA = getGameDiscountValue(a);
      valB = getGameDiscountValue(b);
    }

    if (valA !== valB) {
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    }

    return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
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
            <div className="stat-card border-favorite">
              <span className="stat-value text-favorite">{favorites.length}</span>
              <span className="stat-label">Favoritos</span>
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

            {/* Grupo de Ordenação */}
            <div className="filter-group">
              <h3 className="filter-group-title">Ordenar</h3>
              <div className="sidebar-sort-container">
                <div className="sort-input-row">
                  <div className="custom-select-wrapper">
                    <select
                      className="custom-select"
                      value={sortBy}
                      onChange={(e) => handleSortByChange(e.target.value as SortField)}
                      aria-label="Critério de ordenação"
                    >
                      <option value="none">Padrão</option>
                      <option value="price">Preço</option>
                      <option value="discountPercent">% de Desconto</option>
                      <option value="discountValue">Valor do Desconto</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    className="sort-direction-btn-green"
                    onClick={toggleSortOrder}
                    title={sortOrder === 'asc' ? 'Ordem: Crescente (Clique para mudar para Decrescente)' : 'Ordem: Decrescente (Clique para mudar para Crescente)'}
                    aria-label={`Ordem atual: ${sortOrder === 'asc' ? 'Ascendente' : 'Descendente'}. Clique para alternar.`}
                  >
                    <span className="sort-direction-icon">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    <span>{sortOrder === 'asc' ? 'ASC' : 'DESC'}</span>
                  </button>
                </div>
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

            {/* Grupo de Filtros Especiais */}
            <div className="filter-group">
              <h3 className="filter-group-title">Filtros Especiais</h3>
              <div className="filter-options">
                <label className="filter-checkbox-label favorite-checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={onlyFavorites}
                    onChange={() => setOnlyFavorites(!onlyFavorites)}
                  />
                  <span className="custom-checkbox favorite-custom-checkbox"></span>
                  <span className="text-favorite">⭐ Favoritos ({favorites.length})</span>
                </label>

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
                {sortedGames.length} {sortedGames.length === 1 ? 'jogo encontrado' : 'jogos encontrados'}
              </div>
              
              {hasActiveFilters && (
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
            ) : sortedGames.length === 0 ? (
              <div className="empty-state">
                <p>Nenhum jogo encontrado para os filtros selecionados.</p>
                {hasActiveFilters && (
                  <button className="retry-btn" style={{ marginTop: '15px' }} onClick={clearAllFilters}>
                    Limpar Filtros
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="games-toolbar">
                  <div className="toolbar-count">
                    Mostrando <strong>{sortedGames.length}</strong> {sortedGames.length === 1 ? 'jogo' : 'jogos'}
                  </div>
                  <div className="toolbar-sort-group">
                    <label htmlFor="toolbar-sort-select" className="toolbar-sort-label">Ordenar:</label>
                    <div className="sort-input-row">
                      <div className="custom-select-wrapper">
                        <select
                          id="toolbar-sort-select"
                          className="custom-select"
                          value={sortBy}
                          onChange={(e) => handleSortByChange(e.target.value as SortField)}
                          aria-label="Ordenar jogos rapidamente"
                        >
                          <option value="none">Padrão</option>
                          <option value="price">Preço</option>
                          <option value="discountPercent">% de Desconto</option>
                          <option value="discountValue">Valor do Desconto</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        className="sort-direction-btn-green"
                        onClick={toggleSortOrder}
                        title={sortOrder === 'asc' ? 'Ordem: Crescente (Clique para mudar para Decrescente)' : 'Ordem: Decrescente (Clique para mudar para Crescente)'}
                        aria-label={`Ordem atual: ${sortOrder === 'asc' ? 'Ascendente' : 'Descendente'}. Clique para alternar.`}
                      >
                        <span className="sort-direction-icon">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                        <span>{sortOrder === 'asc' ? 'ASC' : 'DESC'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <main className="games-grid">
                  {sortedGames.map(game => (
                    <GameCard 
                      key={game.id} 
                      game={game} 
                      isFavorite={favorites.includes(game.id)}
                      onToggleFavorite={() => toggleFavorite(game.id)}
                      onClick={() => setSelectedGame(game)} 
                    />
                  ))}
                </main>
              </>
            )}
          </section>
        </div>

        {/* Modal de Detalhes */}
        {selectedGame && (
          <GameModal 
            game={selectedGame} 
            isFavorite={favorites.includes(selectedGame.id)}
            onToggleFavorite={() => toggleFavorite(selectedGame.id)}
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
