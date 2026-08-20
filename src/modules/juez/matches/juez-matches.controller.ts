import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { JuezMatchesService } from "./juez-matches.service";
import { CreateJuezMatchDto } from "./dto/create-juez-match.dto";
import { ToggleJuezAvailabilityDto } from "./dto/toggle-juez-availability.dto";
import { ConfirmJuezAssignmentDto } from "./dto/confirm-juez-assignment.dto";

@Controller()
export class JuezMatchesController {
  constructor(private readonly juezMatchesService: JuezMatchesService) {}

  @Get("juez-matches")
  listMatches() {
    return this.juezMatchesService.listMatches();
  }

  @Post("juez-matches")
  createMatch(@Body() dto: CreateJuezMatchDto) {
    return this.juezMatchesService.createMatch(dto);
  }

  @Get("juez-availability")
  listAvailability() {
    return this.juezMatchesService.listAvailability();
  }

  @Post("juez-matches/:id/availability/toggle")
  toggleAvailability(@Param("id") id: string, @Body() dto: ToggleJuezAvailabilityDto) {
    return this.juezMatchesService.toggleAvailability(Number(id), dto);
  }

  @Get("juez-assignments")
  listAssignments() {
    return this.juezMatchesService.listAssignments();
  }

  @Post("juez-matches/:id/assignment")
  confirmAssignment(@Param("id") id: string, @Body() dto: ConfirmJuezAssignmentDto) {
    return this.juezMatchesService.confirmAssignment(Number(id), dto);
  }
}
