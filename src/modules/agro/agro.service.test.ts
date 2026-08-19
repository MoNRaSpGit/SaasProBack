import { BadRequestException, ConflictException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgroService } from "./agro.service";
import { SaveAgroDiscoveryResponseDto } from "./dto/save-agro-discovery-response.dto";
import { SaveAgroWorkspaceDto } from "./dto/save-agro-workspace.dto";
import { AgroRequestUser, AgroWorkspaceData } from "./agro.types";

function createFakeDatabaseService() {
  return {
    query: vi.fn(),
    execute: vi.fn()
  };
}

function createUser(overrides: Partial<AgroRequestUser> = {}): AgroRequestUser {
  return {
    userId: 1,
    email: "test@example.com",
    tenantId: 123,
    tenantName: "Tenant de prueba",
    tenantSlug: "tenant-de-prueba",
    membershipRole: "owner",
    modules: ["agro"],
    ...overrides
  };
}

function createWorkspaceDto(overrides: Partial<SaveAgroWorkspaceDto> = {}): SaveAgroWorkspaceDto {
  const dto = new SaveAgroWorkspaceDto();
  dto.workspaceKey = "public";
  dto.version = "v1";
  dto.expectedRowVersion = undefined;
  dto.establishments = [];
  dto.fields = [];
  dto.animalMovements = [];
  dto.accountingEntries = [];
  dto.rainfallRecords = [];
  dto.sanitaryRecords = [];
  dto.monthlyExchangeRates = [];
  return Object.assign(dto, overrides);
}

// Diez registros repartidos entre las distintas listas del workspace --
// justo el umbral que usa assertWorkspaceSaveIsNotAccidentalWipe para
// empezar a proteger contra un guardado que vacia todo por error.
function tenRecordsWorkspaceJson(): AgroWorkspaceData {
  return {
    establishments: [{}, {}],
    fields: [{}, {}, {}],
    animalMovements: [{}, {}, {}, {}, {}],
    accountingEntries: [],
    rainfallRecords: [],
    sanitaryRecords: [],
    monthlyExchangeRates: []
  };
}

describe("AgroService", () => {
  let db: ReturnType<typeof createFakeDatabaseService>;
  let service: AgroService;

  beforeEach(() => {
    db = createFakeDatabaseService();
    db.execute.mockResolvedValue({ affectedRows: 1, insertId: 0 });
    service = new AgroService(db as any);
  });

  describe("getStatus", () => {
    it("no toca la base -- devuelve el estado a partir del usuario nomas", () => {
      const status = service.getStatus(createUser({ tenantId: 42, tenantName: "Estancia La Prueba" }));

      expect(status).toEqual({
        module: "agro",
        status: "ok",
        tenantId: 42,
        tenantName: "Estancia La Prueba",
        persistenceScope: {
          backendReadyNow: ["discovery"],
          localDemoOnly: ["stock-demo", "accounting-demo", "reports-demo"]
        }
      });
      expect(db.query).not.toHaveBeenCalled();
      expect(db.execute).not.toHaveBeenCalled();
    });
  });

  describe("getPublicWorkspace", () => {
    it("devuelve un workspace vacio si todavia no hay fila guardada", async () => {
      db.query.mockResolvedValueOnce([]);

      const workspace = await service.getPublicWorkspace();

      expect(workspace.data).toEqual({
        establishments: [],
        fields: [],
        animalMovements: [],
        accountingEntries: [],
        rainfallRecords: [],
        sanitaryRecords: [],
        monthlyExchangeRates: []
      });
      expect(workspace.updatedAt).toBeNull();
      expect(workspace.rowVersion).toBe(0);
    });

    it("parsea workspace_json venga como string, Buffer u objeto ya parseado", async () => {
      const data = { establishments: [{ id: "1" }], fields: [], animalMovements: [], accountingEntries: [], rainfallRecords: [], sanitaryRecords: [], monthlyExchangeRates: [] };
      const updatedAt = new Date("2026-08-01T12:00:00.000Z");

      for (const workspace_json of [JSON.stringify(data), Buffer.from(JSON.stringify(data), "utf8"), data]) {
        db.query.mockResolvedValueOnce([{ id: 1, workspace_key: "public", version: "v1", workspace_json, updated_at: updatedAt }]);
        const workspace = await service.getPublicWorkspace();
        expect(workspace.data.establishments).toEqual([{ id: "1" }]);
        expect(workspace.updatedAt).toBe(updatedAt.toISOString());
      }
    });

    it("si el JSON guardado le faltan campos, los completa con arrays vacios en vez de romper", async () => {
      db.query.mockResolvedValueOnce([
        { id: 1, workspace_key: "public", version: "v1", workspace_json: JSON.stringify({ establishments: [{ id: "1" }] }), updated_at: new Date() }
      ]);

      const workspace = await service.getPublicWorkspace();

      expect(workspace.data.establishments).toEqual([{ id: "1" }]);
      expect(workspace.data.fields).toEqual([]);
      expect(workspace.data.animalMovements).toEqual([]);
      expect(workspace.data.monthlyExchangeRates).toEqual([]);
    });
  });

  describe("saveWorkspace -- bloqueo optimista (assertWorkspaceRowVersion)", () => {
    it("permite guardar si no hay fila previa, sin importar expectedRowVersion", async () => {
      db.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      await expect(service.saveWorkspace(createUser(), createWorkspaceDto({ expectedRowVersion: 5 }))).resolves.toBeDefined();
    });

    it("permite guardar si expectedRowVersion coincide con la fila actual", async () => {
      const currentRow = {
        id: 1,
        tenant_id: 123,
        workspace_key: "public",
        version: "v1",
        workspace_json: JSON.stringify({ establishments: [], fields: [], animalMovements: [], accountingEntries: [], rainfallRecords: [], sanitaryRecords: [], monthlyExchangeRates: [] }),
        row_version: 3,
        updated_at: new Date()
      };
      db.query.mockResolvedValueOnce([currentRow]).mockResolvedValueOnce([currentRow]);

      await expect(
        service.saveWorkspace(createUser(), createWorkspaceDto({ expectedRowVersion: 3 }))
      ).resolves.toBeDefined();
    });

    it("rechaza el guardado si expectedRowVersion no coincide -- otra pestana guardo algo mas nuevo", async () => {
      const currentRow = {
        id: 1,
        tenant_id: 123,
        workspace_key: "public",
        version: "v1",
        workspace_json: JSON.stringify({ establishments: [], fields: [], animalMovements: [], accountingEntries: [], rainfallRecords: [], sanitaryRecords: [], monthlyExchangeRates: [] }),
        row_version: 7,
        updated_at: new Date()
      };
      db.query.mockResolvedValueOnce([currentRow]);

      await expect(
        service.saveWorkspace(createUser(), createWorkspaceDto({ expectedRowVersion: 3 }))
      ).rejects.toBeInstanceOf(ConflictException);
      // No debe llegar a ejecutar el INSERT si el chequeo de version corta antes.
      expect(db.execute).not.toHaveBeenCalledWith(expect.stringContaining("INSERT INTO saas_agro_workspaces"), expect.anything());
    });

    it("no valida version si expectedRowVersion viene null/undefined (cliente sin dato previo)", async () => {
      const currentRow = {
        id: 1,
        tenant_id: 123,
        workspace_key: "public",
        version: "v1",
        workspace_json: JSON.stringify({ establishments: [], fields: [], animalMovements: [], accountingEntries: [], rainfallRecords: [], sanitaryRecords: [], monthlyExchangeRates: [] }),
        row_version: 9,
        updated_at: new Date()
      };
      db.query.mockResolvedValueOnce([currentRow]).mockResolvedValueOnce([currentRow]);

      await expect(
        service.saveWorkspace(createUser(), createWorkspaceDto({ expectedRowVersion: undefined }))
      ).resolves.toBeDefined();
    });
  });

  describe("saveWorkspace -- proteccion contra vaciado accidental (assertWorkspaceSaveIsNotAccidentalWipe)", () => {
    it("bloquea un guardado que deja el workspace sin datos centrales, viniendo de uno con 10+ registros", async () => {
      const currentRow = {
        id: 1,
        tenant_id: 123,
        workspace_key: "public",
        version: "v1",
        workspace_json: JSON.stringify(tenRecordsWorkspaceJson()),
        row_version: 1,
        updated_at: new Date()
      };
      db.query.mockResolvedValueOnce([currentRow]);

      await expect(
        service.saveWorkspace(
          createUser(),
          createWorkspaceDto({ establishments: [], fields: [], animalMovements: [] })
        )
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("bloquea un guardado que pierde casi todo (10+ registros perdidos) aunque queden 1-2 sueltos", async () => {
      // 15 registros -> baja a 1: pierde 14 (>=10) y queda con 1 (<=2), asi
      // que dispara por "perdio casi todo" aunque no tenga las tres listas
      // centrales en cero (esa otra condicion se prueba aparte arriba).
      const bigWorkspace: AgroWorkspaceData = {
        establishments: [{}, {}, {}, {}, {}],
        fields: [{}, {}, {}, {}, {}],
        animalMovements: [{}, {}, {}, {}, {}],
        accountingEntries: [],
        rainfallRecords: [],
        sanitaryRecords: [],
        monthlyExchangeRates: []
      };
      const currentRow = {
        id: 1,
        tenant_id: 123,
        workspace_key: "public",
        version: "v1",
        workspace_json: JSON.stringify(bigWorkspace),
        row_version: 1,
        updated_at: new Date()
      };
      db.query.mockResolvedValueOnce([currentRow]);

      await expect(
        service.saveWorkspace(
          createUser(),
          createWorkspaceDto({ establishments: [{}], fields: [], animalMovements: [] })
        )
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("permite un guardado que reduce datos pero se queda con menos de 10 de diferencia", async () => {
      const currentRow = {
        id: 1,
        tenant_id: 123,
        workspace_key: "public",
        version: "v1",
        workspace_json: JSON.stringify(tenRecordsWorkspaceJson()),
        row_version: 1,
        updated_at: new Date()
      };
      db.query.mockResolvedValueOnce([currentRow]).mockResolvedValueOnce([currentRow]);

      await expect(
        service.saveWorkspace(
          createUser(),
          createWorkspaceDto({ establishments: [{}, {}], fields: [{}, {}, {}], animalMovements: [{}, {}, {}] })
        )
      ).resolves.toBeDefined();
    });

    it("no bloquea nada si todavia no habia workspace previo (primer guardado)", async () => {
      db.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      await expect(
        service.saveWorkspace(createUser(), createWorkspaceDto({ establishments: [], fields: [], animalMovements: [] }))
      ).resolves.toBeDefined();
    });

    it("no bloquea si el workspace previo tenia menos de 10 registros en total", async () => {
      const smallWorkspace: AgroWorkspaceData = {
        establishments: [{}],
        fields: [{}],
        animalMovements: [],
        accountingEntries: [],
        rainfallRecords: [],
        sanitaryRecords: [],
        monthlyExchangeRates: []
      };
      const currentRow = {
        id: 1,
        tenant_id: 123,
        workspace_key: "public",
        version: "v1",
        workspace_json: JSON.stringify(smallWorkspace),
        row_version: 1,
        updated_at: new Date()
      };
      db.query.mockResolvedValueOnce([currentRow]).mockResolvedValueOnce([currentRow]);

      await expect(
        service.saveWorkspace(createUser(), createWorkspaceDto({ establishments: [], fields: [], animalMovements: [] }))
      ).resolves.toBeDefined();
    });
  });

  describe("saveDiscoveryResponse / getLatestDiscoveryResponse", () => {
    it("recorta espacios en questionId/selectedOption antes de guardar", async () => {
      db.execute.mockResolvedValueOnce({ affectedRows: 1, insertId: 55 });
      db.query.mockResolvedValueOnce([
        {
          id: 55,
          tenant_id: 123,
          module_key: "agro",
          version: "v1",
          answered_at: new Date("2026-08-01T10:00:00.000Z"),
          answers_json: JSON.stringify([{ questionId: "q1", selectedOption: "si" }]),
          created_at: new Date("2026-08-01T10:00:00.000Z"),
          updated_at: new Date("2026-08-01T10:00:00.000Z")
        }
      ]);

      const dto = new SaveAgroDiscoveryResponseDto();
      dto.moduleKey = "agro";
      dto.version = "v1";
      dto.answeredAt = "2026-08-01T10:00:00.000Z";
      dto.answers = [{ questionId: "  q1  ", selectedOption: "  si  " } as any];

      await service.saveDiscoveryResponse(createUser(), dto);

      const [, params] = db.execute.mock.calls[0];
      const savedAnswersJson = params[params.length - 1];
      expect(JSON.parse(savedAnswersJson)).toEqual([{ questionId: "q1", selectedOption: "si" }]);
    });

    it("getLatestDiscoveryResponse devuelve null si el tenant nunca respondio nada", async () => {
      db.query.mockResolvedValueOnce([]);

      const result = await service.getLatestDiscoveryResponse(createUser());

      expect(result).toBeNull();
    });

    it("getLatestDiscoveryResponse mapea la fila mas reciente a camelCase", async () => {
      db.query.mockResolvedValueOnce([
        {
          id: 9,
          tenant_id: 123,
          module_key: "agro",
          version: "v1",
          answered_at: new Date("2026-08-02T00:00:00.000Z"),
          answers_json: [{ questionId: "q1", selectedOption: "no" }],
          created_at: new Date("2026-08-02T00:00:00.000Z"),
          updated_at: new Date("2026-08-02T00:00:00.000Z")
        }
      ]);

      const result = await service.getLatestDiscoveryResponse(createUser());

      expect(result).toMatchObject({
        id: 9,
        tenantId: 123,
        moduleKey: "agro",
        version: "v1",
        answers: [{ questionId: "q1", selectedOption: "no" }]
      });
    });
  });
});
