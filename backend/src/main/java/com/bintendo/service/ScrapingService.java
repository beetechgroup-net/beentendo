package com.bintendo.service;

import com.bintendo.entity.Game;
import com.bintendo.entity.PriceRecord;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.LocalDateTime;
import java.util.*;

@ApplicationScoped
public class ScrapingService {

    private static final Logger LOG = Logger.getLogger(ScrapingService.class);
    private static final String BEST_SELLERS_URL = "https://www.nintendo.com/pt-br/store/sales-and-deals/best-sellers/";
    private static final String GAMES_BEST_SELLERS_URL = "https://www.nintendo.com/pt-br/store/games/best-sellers/";
    
    // Price API Config
    private static final String PRICE_API_URL_TEMPLATE = "https://api.ec.nintendo.com/v1/price?country=BR&lang=pt&ids=%s";

    @Inject
    ObjectMapper objectMapper;

    @org.eclipse.microprofile.config.inject.ConfigProperty(name = "scraping.dump.path", defaultValue = "../frontend/public/games.json")
    String dumpPath;

    private static class GameMetadata {
        String nsuid;
        String name;
        String platform;
        String coverImage;

        GameMetadata(String nsuid, String name, String platform, String coverImage) {
            this.nsuid = nsuid;
            this.name = name;
            this.platform = platform;
            this.coverImage = coverImage;
        }
    }

    public void runScraping() {
        LOG.info("Iniciando rotina de scraping...");

        // 1. Scraping dos Best Sellers em promoção via HTML/__NEXT_DATA__
        scrapeBestSellersPage(BEST_SELLERS_URL, "Promoções (Best Sellers)");

        // 2. Scraping do catálogo de Mais Vendidos Geral via HTML/__NEXT_DATA__
        scrapeBestSellersPage(GAMES_BEST_SELLERS_URL, "Mais Vendidos Geral");

        // 3. Scraping do catálogo geral via Solr + API de Preços
        // scrapeCatalog();

        // 4. Exporta banco de dados para JSON para consumo pelo frontend
        exportDatabaseToJson();
    }

    private void scrapeBestSellersPage(String url, String sourceLabel) {
        LOG.infof("Iniciando scraping da página %s (%s)...", sourceLabel, url);
        try {
            Document doc = Jsoup.connect(url)
                    .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36")
                    .timeout(30000)
                    .get();

            Element nextDataScript = doc.getElementById("__NEXT_DATA__");
            if (nextDataScript == null) {
                LOG.errorf("Não foi possível encontrar a tag <script id=\"__NEXT_DATA__\"> no HTML da página %s.", sourceLabel);
                return;
            }

            String jsonText = nextDataScript.html();
            JsonNode rootNode = objectMapper.readTree(jsonText);

            JsonNode merchandisedGrid = rootNode.at("/props/pageProps/page/content/merchandisedGrid");
            if (merchandisedGrid.isMissingNode() || !merchandisedGrid.isArray()) {
                LOG.warnf("O nó 'merchandisedGrid' não foi encontrado ou não é uma lista no JSON da página %s.", sourceLabel);
                return;
            }

            LOG.infof("Encontrados %d itens no merchandisedGrid de %s. Processando...", merchandisedGrid.size(), sourceLabel);
            int processedCount = 0;
            Set<String> processedNsuids = new HashSet<>();

            for (JsonNode item : merchandisedGrid) {
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
                    LOG.errorf("Erro ao processar item de %s: %s. Detalhes: %s", sourceLabel, item.get("name"), e.getMessage(), e);
                }
            }
            LOG.infof("Scraping de %s finalizado. Itens processados: %d", sourceLabel, processedCount);

        } catch (Exception e) {
            LOG.errorf("Erro geral no scraping de %s: %s", sourceLabel, e.getMessage(), e);
        }
    }

    private void processHitIntoMap(JsonNode hit, Map<String, GameMetadata> metadataMap) {
        String nsuid = hit.has("nsuid") ? hit.get("nsuid").asText() : null;
        String title = hit.has("title") ? hit.get("title").asText() : null;
        
        if (nsuid != null && !nsuid.trim().isEmpty() && title != null && !title.trim().isEmpty()) {
            String platformLabel = hit.has("platform") ? hit.get("platform").asText() : "Nintendo Switch";
            String platform = platformLabel.toLowerCase().contains("switch 2") || platformLabel.toLowerCase().contains("switch™ 2") 
                    ? "switch 2" 
                    : "switch";

            String coverImage = null;
            if (hit.has("horizontalHeaderImage")) {
                coverImage = hit.get("horizontalHeaderImage").asText();
            }

            metadataMap.put(nsuid, new GameMetadata(nsuid, title, platform, coverImage));
        }
    }

    private void processGameItemFromJson(JsonNode item) {
        String name = item.has("name") ? item.get("name").asText() : null;
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
        if (imgNode != null && imgNode.has("publicId")) {
            coverImage = "https://assets.nintendo.com/image/upload/f_auto,q_auto,w_400/" + imgNode.get("publicId").asText();
        }

        BigDecimal regularPrice = BigDecimal.ZERO;
        BigDecimal salePrice = null;
        JsonNode pricesNode = item.get("prices");
        if (pricesNode != null) {
            if (pricesNode.has("regularPrice")) {
                regularPrice = new BigDecimal(pricesNode.get("regularPrice").asText());
            }
            if (pricesNode.has("discounted") && pricesNode.get("discounted").asBoolean()) {
                if (pricesNode.has("finalPrice")) {
                    salePrice = new BigDecimal(pricesNode.get("finalPrice").asText());
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

    private void exportDatabaseToJson() {
        LOG.infof("Exportando banco de dados de jogos para %s...", dumpPath);
        try {
            List<Game> games = io.quarkus.narayana.jta.QuarkusTransaction.requiringNew().call(() -> Game.listAll());
            java.io.File file = new java.io.File(dumpPath);
            java.io.File parentFile = file.getParentFile();
            if (parentFile != null && !parentFile.exists()) {
                parentFile.mkdirs();
            }
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(file, games);
            LOG.infof("Exportação concluída com sucesso! Total de jogos exportados: %d", games.size());
        } catch (Exception e) {
            LOG.error("Erro ao exportar banco de dados para JSON: " + e.getMessage(), e);
        }
    }
}
