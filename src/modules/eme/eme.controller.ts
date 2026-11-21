import { Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Patch, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { bearerToken, EmeAuthGuard, EmeAuthService, EmePublic, type EmeUser } from "./eme-auth.service";
import { APP_WIDE_USER, NoticesService } from "../notices/notices.service";
import { AddEmeCategoryDto, CreateEmeClientDto, CreateEmeOrderDto, EditEmeOrderDto, EmeLoginDto, EmeExpenseDto, EmeOpeningDto, EmePaymentDto, PatchEmeOrderDto, SaveEmeProductDto } from "./dto/eme.dto";
import { TrackEmeActivityDto } from "./dto/track-eme-activity.dto";
import { EmeService } from "./eme.service";

// EME (restaurante). Sin login por ahora: la app se usa desde el local.
// 20/11/2026: con login. Todo pide sesion salvo lo marcado @EmePublic().
@UseGuards(EmeAuthGuard)
@Controller("eme")
export class EmeController {
  constructor(
    private readonly emeService: EmeService,
    private readonly noticesService: NoticesService,
    private readonly authService: EmeAuthService
  ) {}

  // ---------------- Login (20/11/2026) ----------------
  @EmePublic()
  @Post("auth/login")
  login(@Body() dto: EmeLoginDto) {
    return this.authService.login(dto.username, dto.password);
  }

  @Get("auth/me")
  me(@Req() request: Request & { emeUser?: EmeUser }) {
    return { user: request.emeUser };
  }

  @Post("auth/logout")
  async logout(@Req() request: Request) {
    await this.authService.logout(bearerToken(request));
    return { ok: true };
  }

  // Aviso de demora activado desde Scrum (aplica a toda la app: no hay login).
  @EmePublic()
  @Get("notice")
  async getNotice() {
    return { active: await this.noticesService.isActiveFor("eme", APP_WIDE_USER) };
  }

  @EmePublic()
  @Post("notice/seen")
  async noticeSeen() {
    await this.noticesService.markSeen("eme", APP_WIDE_USER);
    return { ok: true };
  }

  // Estado de la app. Con ?since=<version>, si no cambio nada responde "unchanged".
  @Get("state")
  getState(@Query("since") since?: string) {
    const parsed = since !== undefined && since !== "" ? Number(since) : null;
    return this.emeService.getState(parsed !== null && Number.isInteger(parsed) ? parsed : null);
  }

  // Registro interno de uso (se ve en la app de Movimientos).
  @EmePublic()
  @Post("activity")
  async trackActivity(@Body() dto: TrackEmeActivityDto, @Headers("user-agent") userAgent?: string) {
    await this.emeService.trackActivity(dto, userAgent);
    return { ok: true };
  }

  @Post("orders")
  createOrder(@Body() dto: CreateEmeOrderDto) {
    return this.emeService.createOrder(dto);
  }

  @Patch("orders/:id")
  patchOrder(@Param("id") id: string, @Body() dto: PatchEmeOrderDto) {
    return this.emeService.patchOrder(id, dto);
  }

  @Post("clients")
  createClient(@Body() dto: CreateEmeClientDto) {
    return this.emeService.createClient(dto);
  }

  @Post("clients/:id/payments")
  registerPayment(@Param("id", ParseIntPipe) id: number, @Body() dto: EmePaymentDto) {
    return this.emeService.registerPayment(id, dto.amount);
  }

  @Post("products")
  createProduct(@Body() dto: SaveEmeProductDto) {
    return this.emeService.createProduct(dto);
  }

  @Put("products/:id")
  updateProduct(@Param("id") id: string, @Body() dto: SaveEmeProductDto) {
    return this.emeService.updateProduct(id, dto);
  }

  @Delete("products/:id")
  deleteProduct(@Param("id") id: string) {
    return this.emeService.deleteProduct(id);
  }

  @Post("categories")
  addCategory(@Body() dto: AddEmeCategoryDto) {
    return this.emeService.addCategory(dto);
  }

  // ---------------- Caja (19/11/2026) ----------------
  @Put("register/opening")
  setOpening(@Body() dto: EmeOpeningDto) {
    return this.emeService.setOpening(dto.amount);
  }

  @Post("register/expenses")
  addExpense(@Body() dto: EmeExpenseDto) {
    return this.emeService.addExpense(dto.description, dto.amount);
  }

  @Delete("register/expenses/:id")
  deleteExpense(@Param("id", ParseIntPipe) id: number) {
    return this.emeService.deleteExpense(id);
  }

  @Post("register/close")
  closeRegister() {
    return this.emeService.closeRegister();
  }

  // Editar los productos de un pedido (20/11/2026).
  @Put("orders/:id")
  editOrder(@Param("id") id: string, @Body() dto: EditEmeOrderDto) {
    return this.emeService.editOrder(id, dto);
  }
}
