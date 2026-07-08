package com.beetendo.entity;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "price_record")
public class PriceRecord extends PanacheEntity {
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "game_id", nullable = false)
    public Game game;
    
    @Column(name = "regular_price", nullable = false, precision = 10, scale = 2)
    public BigDecimal regularPrice;
    
    @Column(name = "sale_price", precision = 10, scale = 2)
    public BigDecimal salePrice;
    
    @Column(name = "currency", nullable = false)
    public String currency = "BRL";
    
    @Column(name = "recorded_at", nullable = false)
    public LocalDateTime recordedAt;
}
