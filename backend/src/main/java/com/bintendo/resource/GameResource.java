package com.bintendo.resource;

import com.bintendo.entity.Game;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.util.List;

@Path("/games")
@Produces(MediaType.APPLICATION_JSON)
public class GameResource {

    @GET
    public List<Game> listAll() {
        return Game.listAll();
    }
}
