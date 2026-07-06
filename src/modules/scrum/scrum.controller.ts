import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from "@nestjs/common";
import { CreateScrumClientDto } from "./dto/create-scrum-client.dto";
import { CreateScrumTaskDto } from "./dto/create-scrum-task.dto";
import { UpdateScrumTaskStatusDto } from "./dto/update-scrum-task-status.dto";
import { ScrumService } from "./scrum.service";

@Controller("scrum")
export class ScrumController {
  constructor(private readonly scrumService: ScrumService) {}

  @Get("workspace")
  getWorkspace() {
    return this.scrumService.getWorkspace();
  }

  @Post("tasks")
  createTask(@Body() dto: CreateScrumTaskDto) {
    return this.scrumService.createTask(dto);
  }

  @Patch("tasks/:id/status")
  updateTaskStatus(@Param("id", ParseIntPipe) taskId: number, @Body() dto: UpdateScrumTaskStatusDto) {
    return this.scrumService.updateTaskStatus(taskId, dto);
  }

  @Delete("tasks/:id")
  deleteTask(@Param("id", ParseIntPipe) taskId: number) {
    return this.scrumService.deleteTask(taskId);
  }

  @Post("clients")
  createClient(@Body() dto: CreateScrumClientDto) {
    return this.scrumService.createClient(dto);
  }

  @Patch("clients/:id/payment")
  registerClientPayment(@Param("id", ParseIntPipe) clientId: number) {
    return this.scrumService.registerClientPayment(clientId);
  }

  @Delete("clients/:id")
  deleteClient(@Param("id", ParseIntPipe) clientId: number) {
    return this.scrumService.deleteClient(clientId);
  }
}
