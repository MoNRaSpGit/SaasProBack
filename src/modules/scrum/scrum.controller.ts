import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from "@nestjs/common";
import { CreateScrumClientDto } from "./dto/create-scrum-client.dto";
import { CreateScrumDebtDto } from "./dto/create-scrum-debt.dto";
import { CreateScrumDebtChargeDto } from "./dto/create-scrum-debt-charge.dto";
import { CreateScrumDebtPaymentDto } from "./dto/create-scrum-debt-payment.dto";
import { CreateScrumTaskDto } from "./dto/create-scrum-task.dto";
import { RegisterScrumClientDebtPaymentDto } from "./dto/register-scrum-client-debt-payment.dto";
import { UpdateScrumClientDto } from "./dto/update-scrum-client.dto";
import { UpdateScrumDebtDto } from "./dto/update-scrum-debt.dto";
import { UpdateScrumTaskDifficultyDto } from "./dto/update-scrum-task-difficulty.dto";
import { UpdateScrumTaskStatusDto } from "./dto/update-scrum-task-status.dto";
import { UpdateScrumTaskDurationDto } from "./dto/update-scrum-task-duration.dto";
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

  @Patch("tasks/:id/duration")
  updateTaskDuration(@Param("id", ParseIntPipe) taskId: number, @Body() dto: UpdateScrumTaskDurationDto) {
    return this.scrumService.updateTaskDuration(taskId, dto);
  }

  @Patch("tasks/:id/difficulty")
  updateTaskDifficulty(@Param("id", ParseIntPipe) taskId: number, @Body() dto: UpdateScrumTaskDifficultyDto) {
    return this.scrumService.updateTaskDifficulty(taskId, dto);
  }

  @Delete("tasks/:id")
  deleteTask(@Param("id", ParseIntPipe) taskId: number) {
    return this.scrumService.deleteTask(taskId);
  }

  @Post("clients")
  createClient(@Body() dto: CreateScrumClientDto) {
    return this.scrumService.createClient(dto);
  }

  @Patch("clients/:id")
  updateClient(@Param("id", ParseIntPipe) clientId: number, @Body() dto: UpdateScrumClientDto) {
    return this.scrumService.updateClient(clientId, dto);
  }

  @Patch("clients/:id/payment")
  registerClientPayment(@Param("id", ParseIntPipe) clientId: number) {
    return this.scrumService.registerClientPayment(clientId);
  }

  @Patch("clients/:id/debt-payment")
  registerClientDebtPayment(@Param("id", ParseIntPipe) clientId: number, @Body() dto: RegisterScrumClientDebtPaymentDto) {
    return this.scrumService.registerClientDebtPayment(clientId, dto);
  }

  @Delete("clients/:id")
  deleteClient(@Param("id", ParseIntPipe) clientId: number) {
    return this.scrumService.deleteClient(clientId);
  }

  @Post("debts")
  createDebt(@Body() dto: CreateScrumDebtDto) {
    return this.scrumService.createDebt(dto);
  }

  @Patch("debts/:id")
  updateDebt(@Param("id", ParseIntPipe) debtId: number, @Body() dto: UpdateScrumDebtDto) {
    return this.scrumService.updateDebt(debtId, dto);
  }

  @Post("debts/:id/charges")
  addDebtCharge(@Param("id", ParseIntPipe) debtId: number, @Body() dto: CreateScrumDebtChargeDto) {
    return this.scrumService.addDebtCharge(debtId, dto);
  }

  @Post("debts/:id/payments")
  addDebtPayment(@Param("id", ParseIntPipe) debtId: number, @Body() dto: CreateScrumDebtPaymentDto) {
    return this.scrumService.addDebtPayment(debtId, dto);
  }

  @Delete("debts/:id")
  deleteDebt(@Param("id", ParseIntPipe) debtId: number) {
    return this.scrumService.deleteDebt(debtId);
  }
}
