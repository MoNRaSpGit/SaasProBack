import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CapabilityGuard } from "../../shared/authz/capability.guard";
import { RequireCapability } from "../../shared/authz/require-capability.decorator";
import { CamionesAuthGuard } from "./camiones-auth.guard";
import { CamionesService } from "./camiones.service";
import { CamionesRequestUser } from "./camiones.types";
import { CurrentCamionesUser } from "./current-camiones-user.decorator";
import { CreateCamionesClientDto } from "./dto/create-camiones-client.dto";
import { CreateCamionesPlaceDto } from "./dto/create-camiones-place.dto";
import { CreateCamionesTripDto } from "./dto/create-camiones-trip.dto";
import { ListCamionesClientsDto } from "./dto/list-camiones-clients.dto";
import { ListCamionesPlacesDto } from "./dto/list-camiones-places.dto";
import { ListCamionesTripsDto } from "./dto/list-camiones-trips.dto";
import { UpdateCamionesClientDto } from "./dto/update-camiones-client.dto";
import { UpdateCamionesPlaceDto } from "./dto/update-camiones-place.dto";
import { UpdateCamionesTripDto } from "./dto/update-camiones-trip.dto";

@Controller("camiones")
@UseGuards(CamionesAuthGuard)
export class CamionesController {
  constructor(private readonly camionesService: CamionesService) {}

  @RequireCapability("camiones.clients.read")
  @UseGuards(CapabilityGuard)
  @Get("clients")
  listClients(@CurrentCamionesUser() currentUser: CamionesRequestUser, @Query() query: ListCamionesClientsDto) {
    return this.camionesService.listClients(currentUser, query);
  }

  @RequireCapability("camiones.clients.write")
  @UseGuards(CapabilityGuard)
  @Post("clients")
  createClient(@CurrentCamionesUser() currentUser: CamionesRequestUser, @Body() dto: CreateCamionesClientDto) {
    return this.camionesService.createClient(currentUser, dto);
  }

  @RequireCapability("camiones.clients.write")
  @UseGuards(CapabilityGuard)
  @Patch("clients/:id")
  updateClient(
    @CurrentCamionesUser() currentUser: CamionesRequestUser,
    @Param("id", ParseIntPipe) clientId: number,
    @Body() dto: UpdateCamionesClientDto
  ) {
    return this.camionesService.updateClient(currentUser, clientId, dto);
  }

  @RequireCapability("camiones.clients.write")
  @UseGuards(CapabilityGuard)
  @Patch("clients/:id/archive")
  archiveClient(@CurrentCamionesUser() currentUser: CamionesRequestUser, @Param("id", ParseIntPipe) clientId: number) {
    return this.camionesService.archiveClient(currentUser, clientId);
  }

  @RequireCapability("camiones.places.read")
  @UseGuards(CapabilityGuard)
  @Get("places")
  listPlaces(@CurrentCamionesUser() currentUser: CamionesRequestUser, @Query() query: ListCamionesPlacesDto) {
    return this.camionesService.listPlaces(currentUser, query);
  }

  @RequireCapability("camiones.places.write")
  @UseGuards(CapabilityGuard)
  @Post("places")
  createPlace(@CurrentCamionesUser() currentUser: CamionesRequestUser, @Body() dto: CreateCamionesPlaceDto) {
    return this.camionesService.createPlace(currentUser, dto);
  }

  @RequireCapability("camiones.places.write")
  @UseGuards(CapabilityGuard)
  @Patch("places/:id")
  updatePlace(
    @CurrentCamionesUser() currentUser: CamionesRequestUser,
    @Param("id", ParseIntPipe) placeId: number,
    @Body() dto: UpdateCamionesPlaceDto
  ) {
    return this.camionesService.updatePlace(currentUser, placeId, dto);
  }

  @RequireCapability("camiones.places.write")
  @UseGuards(CapabilityGuard)
  @Patch("places/:id/archive")
  archivePlace(@CurrentCamionesUser() currentUser: CamionesRequestUser, @Param("id", ParseIntPipe) placeId: number) {
    return this.camionesService.archivePlace(currentUser, placeId);
  }

  @RequireCapability("camiones.trips.read")
  @UseGuards(CapabilityGuard)
  @Get("trips")
  listTrips(@CurrentCamionesUser() currentUser: CamionesRequestUser, @Query() query: ListCamionesTripsDto) {
    return this.camionesService.listTrips(currentUser, query);
  }

  @RequireCapability("camiones.trips.write")
  @UseGuards(CapabilityGuard)
  @Post("trips")
  createTrip(@CurrentCamionesUser() currentUser: CamionesRequestUser, @Body() dto: CreateCamionesTripDto) {
    return this.camionesService.createTrip(currentUser, dto);
  }

  @RequireCapability("camiones.trips.write")
  @UseGuards(CapabilityGuard)
  @Patch("trips/:id")
  updateTrip(
    @CurrentCamionesUser() currentUser: CamionesRequestUser,
    @Param("id", ParseIntPipe) tripId: number,
    @Body() dto: UpdateCamionesTripDto
  ) {
    return this.camionesService.updateTrip(currentUser, tripId, dto);
  }

  @RequireCapability("camiones.trips.pay")
  @UseGuards(CapabilityGuard)
  @Patch("trips/:id/pay")
  markTripPaid(@CurrentCamionesUser() currentUser: CamionesRequestUser, @Param("id", ParseIntPipe) tripId: number) {
    return this.camionesService.markTripPaid(currentUser, tripId);
  }
}
