import { Controller, Get, Query } from "@nestjs/common";
import { ClientesTacuaService } from "./clientes-tacua.service";
import { DistribuidoraCategoria, GpsCategoria } from "./clientes-tacua.types";

@Controller("clientes-tacua")
export class ClientesTacuaController {
  constructor(private readonly clientesTacuaService: ClientesTacuaService) {}

  @Get("resumen")
  getResumen() {
    return this.clientesTacuaService.getResumen();
  }

  @Get("distribuidora")
  listDistribuidora(
    @Query("categoria") categoria: DistribuidoraCategoria = "todos",
    @Query("busqueda") busqueda = "",
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "50"
  ) {
    return this.clientesTacuaService.listDistribuidora(categoria, busqueda, Number(page), Number(pageSize));
  }

  @Get("gps")
  listGps(
    @Query("categoria") categoria: GpsCategoria = "todos",
    @Query("busqueda") busqueda = "",
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "50"
  ) {
    return this.clientesTacuaService.listGps(categoria, busqueda, Number(page), Number(pageSize));
  }
}
