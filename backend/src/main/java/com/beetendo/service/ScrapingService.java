package com.beetendo.service;

import com.beetendo.entity.Game;
import com.beetendo.entity.PriceRecord;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;
import org.jsoup.Jsoup;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

@ApplicationScoped
public class ScrapingService {

    private static final Logger LOG = Logger.getLogger(ScrapingService.class);
    private static final String ALL_GAMES_URL = "https://u3b6gr4ua3-dsn.algolia.net/1/indexes/store_game_pt_br/query?x-algolia-agent=Algolia%20for%20JavaScript%20(4.26.0)%3B%20Browser";
    private static final String NINTENDO_PRICE_API_URL = "https://api.ec.nintendo.com/v1/price?country=BR&lang=pt&ids=";

    @Inject
    ObjectMapper objectMapper;

    @org.eclipse.microprofile.config.inject.ConfigProperty(name = "scraping.dump.path", defaultValue = "../frontend/public/games.json")
    String dumpPath;

    public void runScraping() {
        LOG.info("Iniciando rotina de scraping...");

        // 1. Scraping de promoções e catálogo via Algolia API
        scrapeFromAlgolia("topLevelFilters:Promoções", "Promoções", 100);
        scrapeFromAlgolia("", "Todos", 100);

        // 2. Sincronização individual dos preços dos jogos existentes no banco de dados
        syncExistingGamePrices();

        // 3. Exporta banco de dados para JSON para consumo pelo frontend
        exportDatabaseToJson();
    }

    private void scrapeFromAlgolia(String filters, String sourceLabel, Integer pageLimit) {
        LOG.infof("Iniciando scraping via Algolia para %s com filtros '%s'...", sourceLabel, filters);

        int currentPage = 0; // Algolia é 0-indexed para páginas
        int maxPages = pageLimit != null ? pageLimit : 50;
        Set<String> processedNsuids = new HashSet<>();

        while (currentPage < maxPages) {
            LOG.infof("Buscando página Algolia %d (0-indexed) para %s...", currentPage, sourceLabel);
            
            try {
                // Monta o payload JSON da requisição
                Map<String, Object> payloadMap = new HashMap<>();
                payloadMap.put("filters", filters);
                payloadMap.put("hitsPerPage", 100);
                payloadMap.put("analytics", true);
                payloadMap.put("facetingAfterDistinct", true);
                payloadMap.put("clickAnalytics", true);
                payloadMap.put("highlightPreTag", "^*^^");
                payloadMap.put("highlightPostTag", "^*");
                payloadMap.put("attributesToHighlight", Collections.singletonList("description"));
                payloadMap.put("facets", Collections.singletonList("*"));
                payloadMap.put("maxValuesPerFacet", 100);
                payloadMap.put("page", currentPage);

                String payloadJson = objectMapper.writeValueAsString(payloadMap);

                // Realiza a requisição POST para o Algolia usando Jsoup
                String responseBody = Jsoup.connect(ALL_GAMES_URL)
                        .method(org.jsoup.Connection.Method.POST)
                        .header("Content-Type", "application/json")
                        .header("X-Algolia-API-Key", "a29c6927638bfd8cee23993e51e721c9")
                        .header("X-Algolia-Application-Id", "U3B6GR4UA3")
                        .requestBody(payloadJson)
                        .ignoreContentType(true)
                        .timeout(30000)
                        .execute()
                        .body();

                JsonNode rootNode = objectMapper.readTree(responseBody);
                JsonNode hits = rootNode.get("hits");
                
                if (hits == null || !hits.isArray() || hits.size() == 0) {
                    LOG.infof("Nenhum jogo retornado na página %d. Finalizando busca.", currentPage);
                    break;
                }

                LOG.infof("Página %d: Encontrados %d itens no Algolia para %s.", currentPage + 1, hits.size(), sourceLabel);

                int processedCount = 0;
                for (JsonNode item : hits) {
                    String nsuid = item.has("nsuid") ? item.get("nsuid").asText() : null;
                    if (nsuid != null && !nsuid.trim().isEmpty()) {
                        if (processedNsuids.contains(nsuid)) {
                            continue;
                        }
                        processedNsuids.add(nsuid);
                    }

                    try {
                        io.quarkus.narayana.jta.QuarkusTransaction.requiringNew().run(() -> processGameItemFromJson(item));
                        processedCount++;
                    } catch (Exception e) {
                        String gameName = item.has("title") ? item.get("title").asText() : (item.has("name") ? item.get("name").asText() : "Desconhecido");
                        LOG.errorf("Erro ao processar item de Algolia %s: %s. Detalhes: %s", sourceLabel, gameName, e.getMessage(), e);
                    }
                }

                LOG.infof("Página %d finalizada. Novos itens processados nesta página: %d", currentPage + 1, processedCount);

                currentPage++;
            } catch (Exception e) {
                LOG.errorf("Erro na busca da página %d do Algolia para %s: %s", currentPage, sourceLabel, e.getMessage(), e);
                break;
            }
        }
        LOG.infof("Scraping via Algolia de %s finalizado. Total de itens únicos processados: %d", sourceLabel, processedNsuids.size());
    }

    private void processGameItemFromJson(JsonNode item) {
        String name = null;
        if (item.hasNonNull("title")) {
            name = item.get("title").asText();
        } else if (item.hasNonNull("name")) {
            name = item.get("name").asText();
        }

        if (name == null || name.trim().isEmpty()) {
            return;
        }

        String nsuid = item.has("nsuid") ? item.get("nsuid").asText() : null;

        String platformLabel = "";
        JsonNode platformNode = item.get("platform");
        if (platformNode != null) {
            if (platformNode.isObject() && platformNode.has("label")) {
                platformLabel = platformNode.get("label").asText();
            } else if (!platformNode.isObject()) {
                platformLabel = platformNode.asText();
            }
        }

        String platform = platformLabel.toLowerCase().contains("switch 2") || platformLabel.toLowerCase().contains("switch™ 2") 
                ? "switch 2" 
                : "switch";

        String coverImage = null;
        JsonNode imgNode = item.get("productImage");
        if (imgNode != null) {
            if (imgNode.isTextual()) {
                coverImage = "https://assets.nintendo.com/image/upload/f_auto,q_auto,w_400/" + imgNode.asText();
            } else if (imgNode.isObject() && imgNode.has("publicId")) {
                coverImage = "https://assets.nintendo.com/image/upload/f_auto,q_auto,w_400/" + imgNode.get("publicId").asText();
            }
        }

        BigDecimal regularPrice = BigDecimal.ZERO;
        BigDecimal salePrice = null;

        // 1. Tenta ler do formato Algolia ("price")
        JsonNode priceNode = item.get("price");
        if (priceNode != null && priceNode.isObject()) {
            if (priceNode.hasNonNull("regPrice")) {
                regularPrice = new BigDecimal(priceNode.get("regPrice").asText());
            }
            if (priceNode.has("discounted") && priceNode.get("discounted").asBoolean()) {
                if (priceNode.hasNonNull("finalPrice")) {
                    salePrice = new BigDecimal(priceNode.get("finalPrice").asText());
                } else if (priceNode.hasNonNull("salePrice")) {
                    salePrice = new BigDecimal(priceNode.get("salePrice").asText());
                }
            }
        } else {
            // 2. Tenta do formato NextProps/JSoup ("prices")
            JsonNode pricesNode = item.get("prices");
            if (pricesNode != null) {
                if (pricesNode.hasNonNull("regularPrice")) {
                    regularPrice = new BigDecimal(pricesNode.get("regularPrice").asText());
                }
                if (pricesNode.has("discounted") && pricesNode.get("discounted").asBoolean()) {
                    if (pricesNode.hasNonNull("finalPrice")) {
                        salePrice = new BigDecimal(pricesNode.get("finalPrice").asText());
                    }
                }
            }
        }

        // 3. Fallback para eshopDetails caso regularPrice continue zero
        if (regularPrice.compareTo(BigDecimal.ZERO) == 0) {
            JsonNode eshopDetails = item.get("eshopDetails");
            if (eshopDetails != null && eshopDetails.isObject()) {
                if (eshopDetails.hasNonNull("regularPrice")) {
                    regularPrice = new BigDecimal(eshopDetails.get("regularPrice").asText());
                }
                if (eshopDetails.hasNonNull("discountPrice")) {
                    salePrice = new BigDecimal(eshopDetails.get("discountPrice").asText());
                }
            }
        }

        // Itens de Promoção da eShop BR vêm sempre em BRL
        persistOrUpdateGame(nsuid, name, platform, coverImage, regularPrice, salePrice, "BRL");
    }

    private void persistOrUpdateGame(String nsuid, String name, String platform, String coverImage, BigDecimal regularPrice, BigDecimal salePrice, String currency) {
        Game game = null;
        if (nsuid != null && !nsuid.trim().isEmpty()) {
            game = Game.find("nsuid", nsuid).firstResult();
        } else {
            game = Game.find("name = ?1 and platform = ?2", name, platform).firstResult();
        }

        LocalDateTime now = LocalDateTime.now();

        if (game == null) {
            game = new Game();
            game.nsuid = nsuid;
            game.name = name;
            game.platform = platform;
            game.coverImage = coverImage;
            game.persist();

            saveNewPrice(game, regularPrice, salePrice, currency, now);
            LOG.infof("[NOVO JOGO] %s (%s) cadastrado via catálogo com preço %s %s", name, platform, currency, regularPrice);
        } else {
            if (coverImage != null && !coverImage.equals(game.coverImage)) {
                game.coverImage = coverImage;
                game.persist();
            }

            PriceRecord lastRecord = PriceRecord.find("game = ?1 and currency = ?2 order by recordedAt desc", game, currency).firstResult();
            if (lastRecord == null || hasPriceChanged(lastRecord, regularPrice, salePrice)) {
                saveNewPrice(game, regularPrice, salePrice, currency, now);
                LOG.infof("[ATUALIZACAO] Novo preço registrado para %s (%s) em %s: Normal: %s | Promocional: %s", 
                        name, platform, currency, regularPrice, salePrice != null ? salePrice : "N/A");
            }
        }
    }

    private void saveNewPrice(Game game, BigDecimal regularPrice, BigDecimal salePrice, String currency, LocalDateTime recordedAt) {
        PriceRecord priceRecord = new PriceRecord();
        priceRecord.game = game;
        priceRecord.regularPrice = regularPrice;
        priceRecord.salePrice = salePrice;
        priceRecord.currency = currency;
        priceRecord.recordedAt = recordedAt;
        priceRecord.persist();
    }

    private boolean hasPriceChanged(PriceRecord lastRecord, BigDecimal newRegPrice, BigDecimal newSalePrice) {
        if (lastRecord.regularPrice == null || lastRecord.regularPrice.compareTo(newRegPrice) != 0) {
            return true;
        }

        if (lastRecord.salePrice == null && newSalePrice != null) {
            return true;
        }
        if (lastRecord.salePrice != null && newSalePrice == null) {
            return true;
        }
        if (lastRecord.salePrice != null && newSalePrice != null && lastRecord.salePrice.compareTo(newSalePrice) != 0) {
            return true;
        }

        return false;
    }

    public void syncExistingGamePrices() {
        LOG.info("Iniciando verificação individual de preços dos jogos existentes no banco de dados...");
        
        List<Game> existingGames = io.quarkus.narayana.jta.QuarkusTransaction.requiringNew()
                .call(() -> Game.list("nsuid is not null"));

        if (existingGames == null || existingGames.isEmpty()) {
            LOG.info("Nenhum jogo com NSUID encontrado para verificar.");
            return;
        }

        LOG.infof("Total de jogos no banco de dados para verificação de preço: %d", existingGames.size());

        int batchSize = 50;
        int updatedPricesCount = 0;
        int totalGames = existingGames.size();
        int processedGamesCount = 0;

        for (int i = 0; i < existingGames.size(); i += batchSize) {
            int end = Math.min(i + batchSize, existingGames.size());
            List<Game> batchGames = existingGames.subList(i, end);

            Map<String, Game> gameMapByNsuid = new HashMap<>();
            List<String> nsuids = new ArrayList<>();
            for (Game g : batchGames) {
                if (g.nsuid != null && !g.nsuid.trim().isEmpty()) {
                    nsuids.add(g.nsuid.trim());
                    gameMapByNsuid.put(g.nsuid.trim(), g);
                }
            }

            if (nsuids.isEmpty()) {
                continue;
            }

            String idsParam = String.join(",", nsuids);
            String requestUrl = NINTENDO_PRICE_API_URL + idsParam;

            try {
                String responseBody = Jsoup.connect(requestUrl)
                        .method(org.jsoup.Connection.Method.GET)
                        .header("Accept", "application/json")
                        .header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
                        .ignoreContentType(true)
                        .timeout(30000)
                        .execute()
                        .body();

                JsonNode rootNode = objectMapper.readTree(responseBody);
                JsonNode pricesNode = rootNode.get("prices");

                if (pricesNode != null && pricesNode.isArray()) {
                    for (JsonNode priceItem : pricesNode) {
                        if (!priceItem.hasNonNull("title_id")) {
                            continue;
                        }

                        processedGamesCount++;
                        final int currentProgress = processedGamesCount;
                        final double percent = ((double) currentProgress / totalGames) * 100;

                        String titleIdStr = priceItem.get("title_id").asText();
                        Game game = gameMapByNsuid.get(titleIdStr);

                        if (game == null) {
                            continue;
                        }

                        BigDecimal regularPrice = BigDecimal.ZERO;
                        BigDecimal salePrice = null;

                        if (priceItem.hasNonNull("regular_price") && priceItem.get("regular_price").hasNonNull("raw_value")) {
                            regularPrice = new BigDecimal(priceItem.get("regular_price").get("raw_value").asText());
                        }

                        if (priceItem.hasNonNull("discount_price") && priceItem.get("discount_price").hasNonNull("raw_value")) {
                            salePrice = new BigDecimal(priceItem.get("discount_price").get("raw_value").asText());
                        }

                        final BigDecimal finalRegPrice = regularPrice;
                        final BigDecimal finalSalePrice = salePrice;

                        Boolean updated = io.quarkus.narayana.jta.QuarkusTransaction.requiringNew().call(() -> {
                            Game loadedGame = Game.findById(game.id);
                            if (loadedGame == null) return false;

                            PriceRecord lastRecord = PriceRecord.find("game = ?1 and currency = ?2 order by recordedAt desc", loadedGame, "BRL").firstResult();

                            if (lastRecord == null || hasPriceChanged(lastRecord, finalRegPrice, finalSalePrice)) {
                                saveNewPrice(loadedGame, finalRegPrice, finalSalePrice, "BRL", LocalDateTime.now());
                                LOG.infof("[VERIFICACAO INDIVIDUAL] [%d de %d (%.1f%%)] Atualização de preço (NSUID %s): Normal: %s | Promocional: %s",
                                        currentProgress, totalGames, percent, loadedGame.nsuid, finalRegPrice, finalSalePrice != null ? finalSalePrice : "N/A (Sem Promoção)");
                                return true;
                            }
                            return false;
                        });

                        if (Boolean.TRUE.equals(updated)) {
                            updatedPricesCount++;
                        }
                    }
                }

            } catch (Exception e) {
                LOG.errorf("Erro ao consultar API de preços da Nintendo para lote de jogos: %s", e.getMessage(), e);
            }
        }

        LOG.infof("Sincronização de preços finalizada. Registros de preço atualizados/inseridos: %d", updatedPricesCount);
    }

    private void exportDatabaseToJson() {
        LOG.infof("Exportando banco de dados de jogos para %s...", dumpPath);
        try {
            List<Game> games = io.quarkus.narayana.jta.QuarkusTransaction.requiringNew().call(() -> Game.listAll());
            java.io.File file = new java.io.File(dumpPath);
            java.io.File parentFile = file.getParentFile();
            if (parentFile != null && !parentFile.exists()) {
                parentFile.mkdirs();
            }
            Map<String, Object> output = new LinkedHashMap<>();
            output.put("updateDate", LocalDateTime.now().toString());
            output.put("games", games);
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(file, output);
            LOG.infof("Exportação concluída com sucesso! Total de jogos exportados: %d", games.size());
        } catch (Exception e) {
            LOG.error("Erro ao exportar banco de dados para JSON: " + e.getMessage(), e);
        }
    }
}
