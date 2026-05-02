import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CamionesAuthGuard } from "./camiones-auth.guard";
import { CamionesService } from "./camiones.service";
import { CamionesRequestUser } from "./camiones.types";
import { CurrentCamionesUser } from "./current-camiones-user.decorator";
import { CreateCamionesClientDto } from "./dto/create-camiones-client.dto";
import { CreateCamionesTripDto } from "./dto/create-camiones-trip.dto";
import { ListCamionesClientsDto } from "./dto/list-camiones-clients.dto";
import { ListCamionesTripsDto } from "./dto/list-camiones-trips.dto";

@Controller("camiones")
@UseGuards(CamionesAuthGuard)
export class CamionesController {
  constructor(private readonly camionesService: CamionesService) {}

  @Get("clients")
  listClients(@CurrentCamionesUser() currentUser: CamionesRequestUser, @Query() query: ListCamionesClientsDto) {
    return this.camionesService.listClients(currentUser, query);
  }

  @Post("clients")
  createClient(@CurrentCamionesUser() currentUser: CamionesRequestUser, @Body() dto: CreateCamionesClientDto) {
    return this.camionesService.createClient(currentUser, dto);
  }

  @Get("trips")
  listTrips(@CurrentCamionesUser() currentUser: CamionesRequestUser, @Query() query: ListCamionesTripsDto) {
    return this.camionesService.listTrips(currentUser, query);
  }

  @Post("trips")
  createTrip(@CurrentCamionesUser() currentUser: CamionesRequestUser, @Body() dto: CreateCamionesTripDto) {
    return this.camionesService.createTrip(currentUser, dto);
  }

  @Patch("trips/:id/pay")
  markTripPaid(@CurrentCamionesUser() currentUser: CamionesRequestUser, @Param("id", ParseIntPipe) tripId: number) {
    return this.camionesService.markTripPaid(currentUser, tripId);
  }
}
