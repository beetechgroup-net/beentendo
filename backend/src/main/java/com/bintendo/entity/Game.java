package com.bintendo.entity;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "game")
public class Game extends PanacheEntity {
    
    @Column(unique = true, nullable = false)
    public String nsuid;
    
    @Column(nullable = false)
    public String name;
    
    @Column(nullable = false)
    public String platform;
    
    @Column(name = "cover_image")
    public String coverImage;

    @jakarta.persistence.OneToMany(mappedBy = "game", fetch = jakarta.persistence.FetchType.EAGER, cascade = jakarta.persistence.CascadeType.ALL)
    @jakarta.persistence.OrderBy("recordedAt ASC")
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties("game")
    public java.util.List<PriceRecord> prices;
}
