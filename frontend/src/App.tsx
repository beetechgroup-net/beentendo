import { useEffect, useState } from 'react';
import type { Game } from './types';
import { GameCard } from './components/GameCard';
import { GameModal } from './components/GameModal';

const DATA_SOURCE = import.meta.env.VITE_DATA_SOURCE || 'json';
const API_URL = DATA_SOURCE === 'json' ? '/games.json' : 'http://localhost:8080/games';

function App() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [platformFilter, setPlatformFilter] = useState<'all' | 'switch' | 'switch 2'>('all');
  
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
      const data = await response.json();
      setGames(data);
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro desconectado do servidor.');
    } finally {
      setLoading(false);
    }
  };

  // Filtragem dos jogos
  const filteredGames = games.filter(game => {
    const matchesSearch = game.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPlatform = platformFilter === 'all' || 
      (platformFilter === 'switch' && game.platform.toLowerCase() === 'switch') ||
      (platformFilter === 'switch 2' && game.platform.toLowerCase() === 'switch 2');
      
    return matchesSearch && matchesPlatform;
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

        {/* Barra de Filtros e Busca */}
        <div className="filters-container">
          <div className="search-wrapper">
            <span className="search-icon">🔍</span>
            <input 
              type="text" 
              placeholder="Buscar jogo pelo nome..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="platform-filters">
            <button 
              className={`filter-btn ${platformFilter === 'all' ? 'active' : ''}`}
              onClick={() => setPlatformFilter('all')}
            >
              Todos
            </button>
            <button 
              className={`filter-btn ${platformFilter === 'switch' ? 'active' : ''}`}
              onClick={() => setPlatformFilter('switch')}
            >
              Nintendo Switch
            </button>
            <button 
              className={`filter-btn ${platformFilter === 'switch 2' ? 'active' : ''}`}
              onClick={() => setPlatformFilter('switch 2')}
            >
              Switch 2
            </button>
          </div>
        </div>

        {/* Container Principal de Listagem */}
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

        {/* Modal de Detalhes */}
        {selectedGame && (
          <GameModal 
            game={selectedGame} 
            onClose={() => setSelectedGame(null)} 
          />
        )}
      </div>
    </>
  );
}

export default App;
