import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CapabilityGuard } from "../../shared/authz/capability.guard";
import { RequireCapability } from "../../shared/authz/require-capability.decorator";
import { CurrentNeonUser } from "./current-neon-user.decorator";
import { NeonAuthGuard } from "./neon-auth.guard";
import { NeonRequestUser } from "./neon.types";
import { CreateNeonActivityDto } from "./dto/create-neon-activity.dto";
import { CreateNeonAccountDto } from "./dto/create-neon-account.dto";
import { CreateNeonClientDto } from "./dto/create-neon-client.dto";
import { CreateNeonCategoryDto } from "./dto/create-neon-category.dto";
import { CreateNeonExpenseDto } from "./dto/create-neon-expense.dto";
import { CreateNeonJournalEntryDto } from "./dto/create-neon-journal-entry.dto";
import { ListNeonActivitiesDto } from "./dto/list-neon-activities.dto";
import { ListNeonCategoriesDto } from "./dto/list-neon-categories.dto";
import { ListNeonClientsDto } from "./dto/list-neon-clients.dto";
import { ListNeonJournalDto } from "./dto/list-neon-journal.dto";
import { UpdateNeonActivityDto } from "./dto/update-neon-activity.dto";
import { UpdateNeonClientDto } from "./dto/update-neon-client.dto";
import { CreateNeonActivityPaymentDto } from "./dto/create-neon-activity-payment.dto";
import { NeonService } from "./neon.service";

@Controller("neon")
@UseGuards(NeonAuthGuard)
export class NeonController {
  constructor(private readonly neonService: NeonService) {}

  @RequireCapability("neon.shell.read")
  @UseGuards(CapabilityGuard)
  @Get("status")
  getStatus(@CurrentNeonUser() currentUser: NeonRequestUser) {
    return this.neonService.getStatus(currentUser);
  }

  @RequireCapability("neon.clients.read")
  @UseGuards(CapabilityGuard)
  @Get("clients")
  listClients(@CurrentNeonUser() currentUser: NeonRequestUser, @Query() query: ListNeonClientsDto) {
    return this.neonService.listClients(currentUser, query);
  }

  @RequireCapability("neon.clients.write")
  @UseGuards(CapabilityGuard)
  @Post("clients")
  createClient(@CurrentNeonUser() currentUser: NeonRequestUser, @Body() dto: CreateNeonClientDto) {
    return this.neonService.createClient(currentUser, dto);
  }

  @RequireCapability("neon.clients.write")
  @UseGuards(CapabilityGuard)
  @Patch("clients/:id")
  updateClient(
    @CurrentNeonUser() currentUser: NeonRequestUser,
    @Param("id", ParseIntPipe) clientId: number,
    @Body() dto: UpdateNeonClientDto
  ) {
    return this.neonService.updateClient(currentUser, clientId, dto);
  }

  @RequireCapability("neon.accounts.read")
  @UseGuards(CapabilityGuard)
  @Get("accounts")
  listAccounts(@CurrentNeonUser() currentUser: NeonRequestUser) {
    return this.neonService.listAccounts(currentUser);
  }

  @RequireCapability("neon.accounts.write")
  @UseGuards(CapabilityGuard)
  @Post("accounts")
  createAccount(@CurrentNeonUser() currentUser: NeonRequestUser, @Body() dto: CreateNeonAccountDto) {
    return this.neonService.createAccount(currentUser, dto);
  }

  @RequireCapability("neon.categories.read")
  @UseGuards(CapabilityGuard)
  @Get("categories")
  listCategories(@CurrentNeonUser() currentUser: NeonRequestUser, @Query() query: ListNeonCategoriesDto) {
    return this.neonService.listCategories(currentUser, query);
  }

  @RequireCapability("neon.categories.write")
  @UseGuards(CapabilityGuard)
  @Post("categories")
  createCategory(@CurrentNeonUser() currentUser: NeonRequestUser, @Body() dto: CreateNeonCategoryDto) {
    return this.neonService.createCategory(currentUser, dto);
  }

  @RequireCapability("neon.activities.read")
  @UseGuards(CapabilityGuard)
  @Get("activities")
  listActivities(@CurrentNeonUser() currentUser: NeonRequestUser, @Query() query: ListNeonActivitiesDto) {
    return this.neonService.listActivities(currentUser, query);
  }

  @RequireCapability("neon.activities.read")
  @UseGuards(CapabilityGuard)
  @Get("activities/:id")
  getActivity(@CurrentNeonUser() currentUser: NeonRequestUser, @Param("id", ParseIntPipe) activityId: number) {
    return this.neonService.getActivity(currentUser, activityId);
  }

  @RequireCapability("neon.activities.write")
  @UseGuards(CapabilityGuard)
  @Post("activities")
  createActivity(@CurrentNeonUser() currentUser: NeonRequestUser, @Body() dto: CreateNeonActivityDto) {
    return this.neonService.createActivity(currentUser, dto);
  }

  @RequireCapability("neon.activities.write")
  @UseGuards(CapabilityGuard)
  @Patch("activities/:id")
  updateActivity(
    @CurrentNeonUser() currentUser: NeonRequestUser,
    @Param("id", ParseIntPipe) activityId: number,
    @Body() dto: UpdateNeonActivityDto
  ) {
    return this.neonService.updateActivity(currentUser, activityId, dto);
  }

  @RequireCapability("neon.activities.write")
  @UseGuards(CapabilityGuard)
  @Post("activities/:id/payments")
  createActivityPayment(
    @CurrentNeonUser() currentUser: NeonRequestUser,
    @Param("id", ParseIntPipe) activityId: number,
    @Body() dto: CreateNeonActivityPaymentDto
  ) {
    return this.neonService.createActivityPayment(currentUser, activityId, dto);
  }

  @RequireCapability("neon.expenses.read")
  @UseGuards(CapabilityGuard)
  @Get("expenses")
  listExpenses(@CurrentNeonUser() currentUser: NeonRequestUser) {
    return this.neonService.listExpenses(currentUser);
  }

  @RequireCapability("neon.expenses.write")
  @UseGuards(CapabilityGuard)
  @Post("expenses")
  createExpense(@CurrentNeonUser() currentUser: NeonRequestUser, @Body() dto: CreateNeonExpenseDto) {
    return this.neonService.createExpense(currentUser, dto);
  }

  @RequireCapability("neon.journal.read")
  @UseGuards(CapabilityGuard)
  @Get("journal")
  listJournal(@CurrentNeonUser() currentUser: NeonRequestUser, @Query() query: ListNeonJournalDto) {
    return this.neonService.listJournal(currentUser, query);
  }

  @RequireCapability("neon.journal.write")
  @UseGuards(CapabilityGuard)
  @Post("journal")
  createJournalEntry(@CurrentNeonUser() currentUser: NeonRequestUser, @Body() dto: CreateNeonJournalEntryDto) {
    return this.neonService.createJournalEntry(currentUser, dto);
  }
}
