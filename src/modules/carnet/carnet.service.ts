import { BadRequestException, Injectable } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { AddCarnetEventPlayerBuyerDto } from "./dto/add-carnet-event-player-buyer.dto";
import { CreateCarnetEventDto } from "./dto/create-carnet-event.dto";
import { CreateCarnetPlayerDto } from "./dto/create-carnet-player.dto";
import { SetCarnetEventPlayerBuyerDeliveredDto } from "./dto/set-carnet-event-player-buyer-delivered.dto";
import { UpdateCarnetEventPlayerDto } from "./dto/update-carnet-event-player.dto";
import { UpdateCarnetPlayerDto } from "./dto/update-carnet-player.dto";
import { UpsertCarnetEventPlayerDto } from "./dto/upsert-carnet-event-player.dto";
import { CarnetEvent, CarnetEventDetail, CarnetEventRankingItem, CarnetEventSaleBuyer, CarnetPlayer, CarnetStatus } from "./carnet.types";

type CarnetPlayerRow = RowDataPacket & {
  id: number;
  name: string;
  expiry_date: string | Date;
  sex: "masculino" | "femenino" | null;
  cedula: string | null;
  birth_date: string | Date | null;
  sales_count: number | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type CarnetEventRow = RowDataPacket & {
  id: number;
  name: string;
  end_date: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
  players_count: number;
  total_sales: number;
};

type CarnetEventItemRow = RowDataPacket & {
  id: number;
  event_id: number;
  player_id: number;
  sales_count: number;
  created_at: string | Date;
  updated_at: string | Date;
  player_name: string;
  player_expiry_date: string | Date;
  player_created_at: string | Date;
  player_updated_at: string | Date;
};

type CarnetEventPlayerBuyerRow = RowDataPacket & {
  id: number;
  event_player_id: number;
  buyer_name: string;
  quantity: number;
  delivered: number;
};

@Injectable()
export class CarnetService {
  private tablesReady: Promise<void> | null = null;

  constructor(private readonly databaseService: DatabaseService) {}

  async getStatus(): Promise<CarnetStatus> {
    await this.ensureTables();
    const count = await this.countPlayers();
    const eventsCount = await this.countEvents();

    return {
      module: "carnet",
      status: "ok",
      playersCount: count,
      eventsCount,
      backend: {
        database: "connected",
        currentTimestamp: new Date().toISOString()
      }
    };
  }

  async listPlayers() {
    await this.ensureTables();

    const rows = await this.databaseService.query<CarnetPlayerRow[]>(
      `SELECT
         id,
         name,
         expiry_date,
         sex,
         cedula,
         birth_date,
         sales_count,
         created_at,
         updated_at
       FROM saas_carnet_players
       ORDER BY expiry_date ASC, name ASC`
    );

    return {
      items: rows.map((row) => this.mapPlayer(row)),
      meta: {
        count: rows.length
      }
    };
  }

  async listEvents() {
    await this.ensureTables();

    const rows = await this.databaseService.query<CarnetEventRow[]>(
      `SELECT
         e.id,
         e.name,
         e.end_date,
         e.created_at,
         e.updated_at,
         COUNT(ep.id) AS players_count,
         COALESCE(SUM(ep.sales_count), 0) AS total_sales
       FROM saas_carnet_events e
       LEFT JOIN saas_carnet_event_players ep ON ep.event_id = e.id
       GROUP BY e.id, e.name, e.end_date, e.created_at, e.updated_at
       ORDER BY e.created_at DESC`
    );

    return {
      items: rows.map((row) => this.mapEvent(row))
    };
  }

  async getEvent(eventId: number): Promise<{ item: CarnetEventDetail }> {
    await this.ensureTables();

    const eventRows = await this.databaseService.query<CarnetEventRow[]>(
      `SELECT
         e.id,
         e.name,
         e.end_date,
         e.created_at,
         e.updated_at,
         COUNT(ep.id) AS players_count,
         COALESCE(SUM(ep.sales_count), 0) AS total_sales
       FROM saas_carnet_events e
       LEFT JOIN saas_carnet_event_players ep ON ep.event_id = e.id
       WHERE e.id = ?
       GROUP BY e.id, e.name, e.end_date, e.created_at, e.updated_at
       LIMIT 1`,
      [eventId]
    );

    const eventRow = eventRows[0];
    if (!eventRow) {
      throw new BadRequestException("Evento no encontrado");
    }

    const rankingRows = await this.databaseService.query<CarnetEventItemRow[]>(
      `SELECT
         ep.id,
         ep.event_id,
         ep.player_id,
         ep.sales_count,
         ep.created_at,
         ep.updated_at,
         p.name AS player_name,
         p.expiry_date AS player_expiry_date,
         p.created_at AS player_created_at,
         p.updated_at AS player_updated_at
       FROM saas_carnet_event_players ep
       INNER JOIN saas_carnet_players p ON p.id = ep.player_id
       WHERE ep.event_id = ?
       ORDER BY ep.sales_count DESC, p.name ASC, ep.updated_at DESC`,
      [eventId]
    );

    const buyerRows = await this.databaseService.query<CarnetEventPlayerBuyerRow[]>(
      `SELECT b.id, b.event_player_id, b.buyer_name, b.quantity, b.delivered
       FROM saas_carnet_event_player_buyers b
       INNER JOIN saas_carnet_event_players ep ON ep.id = b.event_player_id
       WHERE ep.event_id = ?
       ORDER BY b.created_at ASC, b.id ASC`,
      [eventId]
    );

    const buyersByEventPlayerId = new Map<number, CarnetEventPlayerBuyerRow[]>();
    for (const buyerRow of buyerRows) {
      const list = buyersByEventPlayerId.get(buyerRow.event_player_id) ?? [];
      list.push(buyerRow);
      buyersByEventPlayerId.set(buyerRow.event_player_id, list);
    }

    const playersRows = await this.databaseService.query<CarnetPlayerRow[]>(
      `SELECT
         id,
         name,
         expiry_date,
         sex,
         cedula,
         birth_date,
         sales_count,
         created_at,
         updated_at
       FROM saas_carnet_players
       ORDER BY name ASC`
    );

    return {
      item: {
        event: this.mapEvent(eventRow),
        players: playersRows.map((row) => this.mapPlayer(row)),
        ranking: rankingRows.map((row, index) =>
          this.mapEventRankingItem(row, index + 1, buyersByEventPlayerId.get(row.id) ?? [])
        )
      }
    };
  }

  async createEvent(dto: CreateCarnetEventDto) {
    await this.ensureTables();

    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException("El nombre del evento es obligatorio");
    }

    const duplicateRows = await this.databaseService.query<CarnetEventRow[]>(
      `SELECT
         e.id,
         e.name,
         e.end_date,
         e.created_at,
         e.updated_at,
         COUNT(ep.id) AS players_count,
         COALESCE(SUM(ep.sales_count), 0) AS total_sales
       FROM saas_carnet_events e
       LEFT JOIN saas_carnet_event_players ep ON ep.event_id = e.id
       WHERE LOWER(e.name) = LOWER(?)
       GROUP BY e.id, e.name, e.end_date, e.created_at, e.updated_at
       LIMIT 1`,
      [name]
    );

    if (duplicateRows[0]) {
      return { item: this.mapEvent(duplicateRows[0]) };
    }

    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_carnet_events (name, end_date) VALUES (?, ?)`,
      [name, this.normalizeDate(dto.endDate)]
    );

    const rows = await this.databaseService.query<CarnetEventRow[]>(
      `SELECT
         e.id,
         e.name,
         e.end_date,
         e.created_at,
         e.updated_at,
         0 AS players_count,
         0 AS total_sales
       FROM saas_carnet_events e
       WHERE e.id = ?
       LIMIT 1`,
      [result.insertId]
    );

    return { item: this.mapEvent(rows[0]) };
  }

  async createPlayer(dto: CreateCarnetPlayerDto) {
    await this.ensureTables();

    const name = dto.name.trim();
    const expiryDate = this.normalizeDate(dto.expiryDate);
    const sex = dto.sex;

    const duplicateRows = await this.databaseService.query<CarnetPlayerRow[]>(
      `SELECT
         id,
         name,
         expiry_date,
         sex,
         cedula,
         birth_date,
         sales_count,
         created_at,
         updated_at
       FROM saas_carnet_players
       WHERE LOWER(name) = LOWER(?)
         AND expiry_date = ?
         AND sex = ?
       LIMIT 1`,
      [name, expiryDate, sex]
    );

    if (duplicateRows[0]) {
      return { item: this.mapPlayer(duplicateRows[0]) };
    }

    const result = await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_carnet_players (
         name,
         expiry_date,
         sex,
         cedula,
         birth_date,
         sales_count
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        name,
        expiryDate,
        sex,
        dto.cedula.trim(),
        this.normalizeDate(dto.birthDate, "Fecha de nacimiento invalida"),
        dto.sales ?? null
      ]
    );

    const rows = await this.databaseService.query<CarnetPlayerRow[]>(
      `SELECT
         id,
         name,
         expiry_date,
         sex,
         cedula,
         birth_date,
         sales_count,
         created_at,
         updated_at
       FROM saas_carnet_players
       WHERE id = ?
       LIMIT 1`,
      [result.insertId]
    );

    return { item: this.mapPlayer(rows[0]) };
  }

  async upsertEventPlayer(eventId: number, dto: UpsertCarnetEventPlayerDto) {
    await this.ensureTables();

    const event = await this.findEventById(eventId);
    if (!event) {
      throw new BadRequestException("Evento no encontrado");
    }

    const player = await this.findPlayerById(dto.playerId);
    if (!player) {
      throw new BadRequestException("Jugador no encontrado");
    }

    await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_carnet_event_players (
         event_id,
         player_id,
         sales_count
       ) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         sales_count = VALUES(sales_count)`,
      [eventId, dto.playerId, dto.sales]
    );

    return this.getEvent(eventId);
  }

  async updateEventPlayer(eventId: number, playerId: number, dto: UpdateCarnetEventPlayerDto) {
    await this.ensureTables();

    const event = await this.findEventById(eventId);
    if (!event) {
      throw new BadRequestException("Evento no encontrado");
    }

    const player = await this.findPlayerById(playerId);
    if (!player) {
      throw new BadRequestException("Jugador no encontrado");
    }

    const result = await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_carnet_event_players
       SET sales_count = ?
       WHERE event_id = ? AND player_id = ?`,
      [dto.sales, eventId, playerId]
    );

    if (!result.affectedRows) {
      throw new BadRequestException("El jugador no esta cargado en este evento");
    }

    return this.getEvent(eventId);
  }

  async addEventPlayerBuyer(eventId: number, playerId: number, dto: AddCarnetEventPlayerBuyerDto) {
    await this.ensureTables();

    const eventPlayerRows = await this.databaseService.query<Array<RowDataPacket & { id: number; sales_count: number }>>(
      `SELECT id, sales_count
       FROM saas_carnet_event_players
       WHERE event_id = ? AND player_id = ?
       LIMIT 1`,
      [eventId, playerId]
    );

    const eventPlayerRow = eventPlayerRows[0];
    if (!eventPlayerRow) {
      throw new BadRequestException("El jugador no esta cargado en este evento");
    }

    const buyerName = dto.buyerName.trim();
    if (!buyerName) {
      throw new BadRequestException("El nombre es obligatorio");
    }

    const assignedRows = await this.databaseService.query<Array<RowDataPacket & { total_assigned: string | number }>>(
      `SELECT COALESCE(SUM(quantity), 0) AS total_assigned
       FROM saas_carnet_event_player_buyers
       WHERE event_player_id = ?`,
      [eventPlayerRow.id]
    );

    const totalAssigned = Number(assignedRows[0]?.total_assigned || 0);
    if (totalAssigned + dto.quantity > Number(eventPlayerRow.sales_count)) {
      throw new BadRequestException("Estas asignando mas ventas de las que tiene cargadas el jugador");
    }

    await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_carnet_event_player_buyers (
         event_player_id,
         buyer_name,
         quantity
       ) VALUES (?, ?, ?)`,
      [eventPlayerRow.id, buyerName, dto.quantity]
    );

    return this.getEvent(eventId);
  }

  async setEventPlayerBuyerDelivered(
    eventId: number,
    playerId: number,
    buyerId: number,
    dto: SetCarnetEventPlayerBuyerDeliveredDto
  ) {
    await this.ensureTables();

    await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_carnet_event_player_buyers b
       INNER JOIN saas_carnet_event_players ep ON ep.id = b.event_player_id
       SET b.delivered = ?
       WHERE b.id = ? AND ep.event_id = ? AND ep.player_id = ?`,
      [dto.delivered ? 1 : 0, buyerId, eventId, playerId]
    );

    return this.getEvent(eventId);
  }

  async removeEventPlayerBuyer(eventId: number, playerId: number, buyerId: number) {
    await this.ensureTables();

    await this.databaseService.execute<ResultSetHeader>(
      `DELETE b FROM saas_carnet_event_player_buyers b
       INNER JOIN saas_carnet_event_players ep ON ep.id = b.event_player_id
       WHERE b.id = ? AND ep.event_id = ? AND ep.player_id = ?`,
      [buyerId, eventId, playerId]
    );

    return this.getEvent(eventId);
  }

  async updatePlayer(playerId: number, dto: UpdateCarnetPlayerDto) {
    await this.ensureTables();

    const currentRows = await this.databaseService.query<CarnetPlayerRow[]>(
      `SELECT
         id,
         name,
         expiry_date,
         sex,
         cedula,
         birth_date,
         sales_count,
         created_at,
         updated_at
       FROM saas_carnet_players
       WHERE id = ?
       LIMIT 1`,
      [playerId]
    );

    if (!currentRows[0]) {
      throw new BadRequestException("Jugador no encontrado");
    }

    const currentPlayer = currentRows[0];
    const nextName = dto.name?.trim() || currentPlayer.name;
    const nextExpiryDate = dto.expiryDate ? this.normalizeDate(dto.expiryDate) : this.toIsoDate(currentPlayer.expiry_date);
    const nextSex = dto.sex ?? (currentPlayer.sex ?? "masculino");
    const nextCedula = dto.cedula?.trim() ?? currentPlayer.cedula;
    const nextBirthDate = dto.birthDate
      ? this.normalizeDate(dto.birthDate, "Fecha de nacimiento invalida")
      : this.toIsoDateNullable(currentPlayer.birth_date);
    const nextSales = dto.sales ?? currentPlayer.sales_count;

    const duplicateRows = await this.databaseService.query<CarnetPlayerRow[]>(
      `SELECT
         id,
         name,
         expiry_date,
         sex,
         cedula,
         birth_date,
         sales_count,
         created_at,
         updated_at
       FROM saas_carnet_players
       WHERE LOWER(name) = LOWER(?)
         AND expiry_date = ?
         AND sex = ?
         AND id <> ?
       LIMIT 1`,
      [nextName, nextExpiryDate, nextSex, playerId]
    );

    if (duplicateRows[0]) {
      return { item: this.mapPlayer(duplicateRows[0]) };
    }

    await this.databaseService.execute<ResultSetHeader>(
      `UPDATE saas_carnet_players
       SET name = ?,
           expiry_date = ?,
           sex = ?,
           cedula = ?,
           birth_date = ?,
           sales_count = ?
       WHERE id = ?`,
      [nextName, nextExpiryDate, nextSex, nextCedula, nextBirthDate, nextSales, playerId]
    );

    const rows = await this.databaseService.query<CarnetPlayerRow[]>(
      `SELECT
         id,
         name,
         expiry_date,
         sex,
         cedula,
         birth_date,
         sales_count,
         created_at,
         updated_at
       FROM saas_carnet_players
       WHERE id = ?
       LIMIT 1`,
      [playerId]
    );

    return { item: this.mapPlayer(rows[0]) };
  }

  async deletePlayer(playerId: number) {
    await this.ensureTables();

    const currentRows = await this.databaseService.query<CarnetPlayerRow[]>(
      `SELECT
         id,
         name,
         expiry_date,
         sex,
         cedula,
         birth_date,
         sales_count,
         created_at,
         updated_at
       FROM saas_carnet_players
       WHERE id = ?
       LIMIT 1`,
      [playerId]
    );

    if (!currentRows[0]) {
      throw new BadRequestException("Jugador no encontrado");
    }

    const player = this.mapPlayer(currentRows[0]);

    await this.databaseService.execute<ResultSetHeader>(
      `DELETE FROM saas_carnet_event_players
       WHERE player_id = ?`,
      [playerId]
    );

    await this.databaseService.execute<ResultSetHeader>(
      `DELETE FROM saas_carnet_players
       WHERE id = ?`,
      [playerId]
    );

    return { item: player };
  }

  private mapPlayer(row: CarnetPlayerRow | undefined): CarnetPlayer {
    if (!row) {
      throw new BadRequestException("Jugador no encontrado");
    }

    return {
      id: row.id,
      name: row.name,
      expiryDate: this.toIsoDate(row.expiry_date),
      sex: (row.sex ?? "masculino") as "masculino" | "femenino",
      cedula: row.cedula,
      birthDate: this.toIsoDateNullable(row.birth_date),
      sales: row.sales_count === null ? null : Number(row.sales_count),
      createdAt: this.toIsoString(row.created_at),
      updatedAt: this.toIsoString(row.updated_at)
    };
  }

  private mapEvent(row: CarnetEventRow): CarnetEvent {
    return {
      id: row.id,
      name: row.name,
      endDate: this.toIsoDateNullable(row.end_date),
      createdAt: this.toIsoString(row.created_at),
      updatedAt: this.toIsoString(row.updated_at),
      playersCount: Number(row.players_count || 0),
      totalSales: Number(row.total_sales || 0)
    };
  }

  private mapEventRankingItem(
    row: CarnetEventItemRow,
    position: number,
    buyerRows: CarnetEventPlayerBuyerRow[]
  ): CarnetEventRankingItem {
    const sales = Number(row.sales_count || 0);
    const buyers: CarnetEventSaleBuyer[] = buyerRows.map((buyerRow) => ({
      id: buyerRow.id,
      buyerName: buyerRow.buyer_name,
      quantity: Number(buyerRow.quantity),
      delivered: Boolean(Number(buyerRow.delivered))
    }));
    const assigned = buyers.reduce((sum, buyer) => sum + buyer.quantity, 0);

    return {
      id: row.id,
      playerId: row.player_id,
      playerName: row.player_name,
      sales,
      position,
      buyers,
      unassignedSales: Math.max(0, sales - assigned)
    };
  }

  private async ensureTables() {
    if (!this.tablesReady) {
      this.tablesReady = (async () => {
        await this.ensurePlayerTable();
        await this.ensureEventTables();
      })().catch((error) => {
        this.tablesReady = null;
        throw error;
      });
    }

    await this.tablesReady;
  }

  private async ensurePlayerTable() {
    await this.databaseService.execute(
      `CREATE TABLE IF NOT EXISTS saas_carnet_players (
         id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
         name VARCHAR(120) NOT NULL,
         expiry_date DATE NOT NULL,
         sex VARCHAR(20) NOT NULL DEFAULT 'masculino',
         sales_count INT NULL DEFAULT NULL,
         created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
         PRIMARY KEY (id),
         KEY idx_saas_carnet_players_expiry_date (expiry_date),
         KEY idx_saas_carnet_players_name (name),
         KEY idx_saas_carnet_players_sex (sex)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    const hasSexColumn = await this.hasColumn("saas_carnet_players", "sex");
    if (!hasSexColumn) {
      await this.databaseService.execute(
        `ALTER TABLE saas_carnet_players
         ADD COLUMN sex VARCHAR(20) NULL DEFAULT NULL`
      );
    }

    await this.databaseService.execute(
      `UPDATE saas_carnet_players
       SET sex = 'masculino'
       WHERE sex IS NULL OR sex = ''`
    );

    await this.databaseService.execute(
      `ALTER TABLE saas_carnet_players
       MODIFY COLUMN sex VARCHAR(20) NOT NULL DEFAULT 'masculino'`
    );

    const hasSalesColumn = await this.hasColumn("saas_carnet_players", "sales_count");
    if (!hasSalesColumn) {
      await this.databaseService.execute(
        `ALTER TABLE saas_carnet_players
         ADD COLUMN sales_count INT NULL DEFAULT NULL`
      );
    }

    const hasCedulaColumn = await this.hasColumn("saas_carnet_players", "cedula");
    if (!hasCedulaColumn) {
      await this.databaseService.execute(
        `ALTER TABLE saas_carnet_players
         ADD COLUMN cedula VARCHAR(20) NULL DEFAULT NULL`
      );
    }

    const hasBirthDateColumn = await this.hasColumn("saas_carnet_players", "birth_date");
    if (!hasBirthDateColumn) {
      await this.databaseService.execute(
        `ALTER TABLE saas_carnet_players
         ADD COLUMN birth_date DATE NULL DEFAULT NULL`
      );
    }
  }

  private async ensureEventTables() {
    await this.databaseService.execute(
      `CREATE TABLE IF NOT EXISTS saas_carnet_events (
         id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
         name VARCHAR(120) NOT NULL,
         end_date DATE NOT NULL,
         created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
         PRIMARY KEY (id),
         UNIQUE KEY uq_saas_carnet_events_name (name)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    const hasEndDateColumn = await this.hasColumn("saas_carnet_events", "end_date");

    if (!hasEndDateColumn) {
      await this.databaseService.execute(
        `ALTER TABLE saas_carnet_events
         ADD COLUMN end_date DATE NULL`
      );
    }

    await this.databaseService.execute(
      `UPDATE saas_carnet_events
       SET end_date = CURRENT_DATE
       WHERE end_date IS NULL`
    );

    await this.databaseService.execute(
      `ALTER TABLE saas_carnet_events
       MODIFY COLUMN end_date DATE NOT NULL`
    );

    await this.databaseService.execute(
      `CREATE TABLE IF NOT EXISTS saas_carnet_event_players (
         id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
         event_id BIGINT UNSIGNED NOT NULL,
         player_id BIGINT UNSIGNED NOT NULL,
         sales_count INT NOT NULL DEFAULT 0,
         created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
         PRIMARY KEY (id),
         UNIQUE KEY uq_saas_carnet_event_players_event_player (event_id, player_id),
         KEY idx_saas_carnet_event_players_event_sales (event_id, sales_count),
         KEY idx_saas_carnet_event_players_player (player_id)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    await this.databaseService.execute(
      `CREATE TABLE IF NOT EXISTS saas_carnet_event_player_buyers (
         id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
         event_player_id BIGINT UNSIGNED NOT NULL,
         buyer_name VARCHAR(120) NOT NULL,
         quantity INT UNSIGNED NOT NULL,
         delivered TINYINT(1) NOT NULL DEFAULT 0,
         created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
         PRIMARY KEY (id),
         KEY idx_saas_carnet_event_player_buyers_event_player (event_player_id),
         CONSTRAINT fk_saas_carnet_event_player_buyers_event_player
           FOREIGN KEY (event_player_id) REFERENCES saas_carnet_event_players (id)
           ON DELETE CASCADE
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    const hasDeliveredColumn = await this.hasColumn("saas_carnet_event_player_buyers", "delivered");
    if (!hasDeliveredColumn) {
      await this.databaseService.execute(
        `ALTER TABLE saas_carnet_event_player_buyers
         ADD COLUMN delivered TINYINT(1) NOT NULL DEFAULT 0 AFTER quantity`
      );
    }
  }

  private async countPlayers() {
    const rows = await this.databaseService.query<Array<RowDataPacket & { total: number }>>(
      `SELECT COUNT(*) AS total
       FROM saas_carnet_players`
    );

    return Number(rows[0]?.total || 0);
  }

  private async countEvents() {
    const rows = await this.databaseService.query<Array<RowDataPacket & { total: number }>>(
      `SELECT COUNT(*) AS total
       FROM saas_carnet_events`
    );

    return Number(rows[0]?.total || 0);
  }

  private async findEventById(eventId: number) {
    const rows = await this.databaseService.query<CarnetEventRow[]>(
      `SELECT
         e.id,
         e.name,
         e.end_date,
         e.created_at,
         e.updated_at,
         COUNT(ep.id) AS players_count,
         COALESCE(SUM(ep.sales_count), 0) AS total_sales
       FROM saas_carnet_events e
       LEFT JOIN saas_carnet_event_players ep ON ep.event_id = e.id
       WHERE e.id = ?
       GROUP BY e.id, e.name, e.end_date, e.created_at, e.updated_at
       LIMIT 1`,
      [eventId]
    );

    return rows[0] ? this.mapEvent(rows[0]) : null;
  }

  private async findPlayerById(playerId: number) {
    const rows = await this.databaseService.query<CarnetPlayerRow[]>(
      `SELECT
         id,
         name,
         expiry_date,
         sex,
         cedula,
         birth_date,
         sales_count,
         created_at,
         updated_at
       FROM saas_carnet_players
       WHERE id = ?
       LIMIT 1`,
      [playerId]
    );

    return rows[0] ? this.mapPlayer(rows[0]) : null;
  }

  private async hasColumn(tableName: string, columnName: string) {
    const rows = await this.databaseService.query<Array<RowDataPacket & { total: number }>>(
      `SELECT COUNT(*) AS total
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND COLUMN_NAME = ?`,
      [tableName, columnName]
    );

    return Number(rows[0]?.total || 0) > 0;
  }

  private normalizeDate(value: string, errorMessage = "Fecha de vencimiento invalida") {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(errorMessage);
    }

    return this.toMysqlDate(date);
  }

  private toMysqlDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private toIsoDate(value: string | Date) {
    if (value instanceof Date) {
      return this.toMysqlDate(value);
    }

    return value;
  }

  private toIsoString(value: string | Date) {
    if (value instanceof Date) {
      return value.toISOString();
    }

    return value;
  }

  private toIsoDateNullable(value: string | Date | null) {
    if (!value) {
      return null;
    }

    return this.toIsoDate(value);
  }
}
