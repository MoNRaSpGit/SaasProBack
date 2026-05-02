import { Injectable, NotFoundException } from "@nestjs/common";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { DatabaseService } from "../../shared/database/database.service";
import { UpdateTenantBillingDto } from "./dto/update-tenant-billing.dto";
import { UpdateTenantModulesDto } from "./dto/update-tenant-modules.dto";
import { SAAS_ADMIN_MODULE_KEYS, SaasAdminModuleKey, TenantBillingStatus } from "./saas-admin.types";

type TenantListRow = RowDataPacket & {
  tenant_id: number;
  tenant_name: string;
  tenant_slug: string;
  tenant_status: string;
  tenant_created_at: string;
  tenant_updated_at: string;
  billing_status: TenantBillingStatus | null;
  paid_until: string | null;
  grace_until: string | null;
  blocked_reason: string | null;
  primary_user_email: string | null;
  primary_user_full_name: string | null;
  primary_membership_role: string | null;
  module_key: SaasAdminModuleKey | null;
};

type TenantRow = RowDataPacket & {
  id: number;
  name: string;
  slug: string;
  status: string;
};

@Injectable()
export class SaasAdminService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listTenants() {
    const rows = await this.databaseService.query<TenantListRow[]>(
      `SELECT
         t.id AS tenant_id,
         t.name AS tenant_name,
         t.slug AS tenant_slug,
         t.status AS tenant_status,
         t.created_at AS tenant_created_at,
         t.updated_at AS tenant_updated_at,
         s.billing_status,
         s.paid_until,
         s.grace_until,
         s.blocked_reason,
         u.email AS primary_user_email,
         u.full_name AS primary_user_full_name,
         m.role AS primary_membership_role,
         tm.module_key
       FROM saas_tenants t
       LEFT JOIN saas_tenant_settings s
         ON s.tenant_id = t.id
       LEFT JOIN saas_tenant_memberships m
         ON m.tenant_id = t.id
        AND m.status = 'active'
        AND m.is_default = 1
       LEFT JOIN saasPro_users u
         ON u.id = m.user_id
       LEFT JOIN saas_tenant_modules tm
         ON tm.tenant_id = t.id
        AND tm.enabled = 1
       ORDER BY
         CASE COALESCE(s.billing_status, 'active')
           WHEN 'pending_manual_block' THEN 1
           WHEN 'grace_period' THEN 2
           WHEN 'blocked' THEN 3
           ELSE 4
         END,
         t.updated_at DESC,
         t.id DESC`
    );

    const tenants = new Map<number, any>();

    for (const row of rows) {
      const existing =
        tenants.get(row.tenant_id) ||
        {
          id: row.tenant_id,
          name: row.tenant_name,
          slug: row.tenant_slug,
          status: row.tenant_status,
          createdAt: row.tenant_created_at,
          updatedAt: row.tenant_updated_at,
          billing: {
            status: row.billing_status || "active",
            paidUntil: row.paid_until,
            graceUntil: row.grace_until,
            blockedReason: row.blocked_reason
          },
          primaryUser: row.primary_user_email
            ? {
                email: row.primary_user_email,
                fullName: row.primary_user_full_name,
                membershipRole: row.primary_membership_role
              }
            : null,
          modules: [] as string[]
        };

      if (row.module_key && !existing.modules.includes(row.module_key)) {
        existing.modules.push(row.module_key);
      }

      tenants.set(row.tenant_id, existing);
    }

    return {
      availableModules: [...SAAS_ADMIN_MODULE_KEYS],
      items: Array.from(tenants.values()),
      total: tenants.size
    };
  }

  async updateTenantBilling(tenantId: number, dto: UpdateTenantBillingDto) {
    const tenantRows = await this.databaseService.query<TenantRow[]>(
      `SELECT id, name, slug, status
       FROM saas_tenants
       WHERE id = ?
       LIMIT 1`,
      [tenantId]
    );
    const tenant = tenantRows[0];
    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }

    await this.databaseService.execute<ResultSetHeader>(
      `INSERT INTO saas_tenant_settings (
         tenant_id,
         brand_name,
         billing_status,
         paid_until,
         grace_until,
         blocked_reason
       )
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         billing_status = VALUES(billing_status),
         paid_until = VALUES(paid_until),
         grace_until = VALUES(grace_until),
         blocked_reason = VALUES(blocked_reason)`,
      [
        tenantId,
        tenant.name,
        dto.billingStatus,
        dto.paidUntil || null,
        dto.graceUntil || null,
        dto.blockedReason || null
      ]
    );

    const updatedRows = await this.databaseService.query<
      Array<
        RowDataPacket & {
          billing_status: TenantBillingStatus;
          paid_until: string | null;
          grace_until: string | null;
          blocked_reason: string | null;
        }
      >
    >(
      `SELECT billing_status, paid_until, grace_until, blocked_reason
       FROM saas_tenant_settings
       WHERE tenant_id = ?
       LIMIT 1`,
      [tenantId]
    );

    const updated = updatedRows[0];

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status
      },
      billing: {
        status: updated.billing_status,
        paidUntil: updated.paid_until,
        graceUntil: updated.grace_until,
        blockedReason: updated.blocked_reason
      }
    };
  }

  async updateTenantModules(tenantId: number, dto: UpdateTenantModulesDto) {
    const tenantRows = await this.databaseService.query<TenantRow[]>(
      `SELECT id, name, slug, status
       FROM saas_tenants
       WHERE id = ?
       LIMIT 1`,
      [tenantId]
    );
    const tenant = tenantRows[0];
    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }

    await this.databaseService.withTransaction(async (connection) => {
      await connection.execute(
        `DELETE FROM saas_tenant_modules
         WHERE tenant_id = ?`,
        [tenantId]
      );

      for (const moduleKey of dto.enabledModules) {
        await connection.execute(
          `INSERT INTO saas_tenant_modules (tenant_id, module_key, enabled)
           VALUES (?, ?, 1)`,
          [tenantId, moduleKey]
        );
      }
    });

    const moduleRows = await this.databaseService.query<
      Array<
        RowDataPacket & {
          module_key: SaasAdminModuleKey;
        }
      >
    >(
      `SELECT module_key
       FROM saas_tenant_modules
       WHERE tenant_id = ?
         AND enabled = 1
       ORDER BY module_key ASC`,
      [tenantId]
    );

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status
      },
      modules: moduleRows.map((row) => row.module_key)
    };
  }
}
