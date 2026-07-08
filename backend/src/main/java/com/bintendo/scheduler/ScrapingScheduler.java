package com.bintendo.scheduler;

import com.bintendo.service.ScrapingService;
import io.quarkus.runtime.StartupEvent;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

@ApplicationScoped
public class ScrapingScheduler {

    private static final Logger LOG = Logger.getLogger(ScrapingScheduler.class);

    @Inject
    ScrapingService scrapingService;

    // Executa ciclicamente de acordo com a propriedade 'scraping.interval'
    // Evita execuções concorrentes se a rotina anterior ainda estiver rodando
    @Scheduled(every = "${scraping.interval}", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void scheduledScraping() {
        LOG.info("Executando scraping periódico agendado...");
        try {
            scrapingService.runScraping();
        } catch (Exception e) {
            LOG.error("Erro no scraping agendado: " + e.getMessage(), e);
        }
    }
}
    