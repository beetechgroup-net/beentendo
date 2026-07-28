package com.beetendo.resource;

import com.beetendo.entity.Game;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@Path("/games")
@Produces(MediaType.APPLICATION_JSON)
public class GameResource {

    @GET
    public Map<String, Object> listAll() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("updateDate", LocalDateTime.now().toString());
        response.put("games", Game.listAll());
        return response;
    }
}
