const { spawnSync } = require("child_process");

const suite = [
  {
    name: "core",
    command: "node",
    args: ["scripts/verify-saas-core.js"]
  },
  {
    name: "auth-multitenant",
    command: "npx.cmd",
    args: ["ts-node", "scripts/validate-auth-multitenant.ts"]
  },
  {
    name: "auth-smoke",
    command: "node",
    args: ["scripts/smoke-auth-module-access.js"]
  },
  {
    name: "alamcen",
    command: "npx.cmd",
    args: ["ts-node", "scripts/validate-alamcen.ts"]
  },
  {
    name: "camiones",
    command: "npx.cmd",
    args: ["ts-node", "scripts/validate-camiones.ts"]
  },
  {
    name: "role-capabilities",
    command: "npx.cmd",
    args: ["ts-node", "scripts/validate-role-capabilities.ts"]
  },
  {
    name: "saas-admin-lite",
    command: "npx.cmd",
    args: ["ts-node", "scripts/validate-saas-admin-lite.ts"]
  }
];

function runStep(step) {
  console.log(`\n[functional] Running ${step.name}...`);

  const result = spawnSync(step.command, step.args, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: true
  });

  if (result.status !== 0) {
    throw new Error(`Functional suite failed at step: ${step.name}`);
  }
}

function main() {
  const startedAt = Date.now();

  for (const step of suite) {
    runStep(step);
  }

  const durationMs = Date.now() - startedAt;
  console.log(
    JSON.stringify(
      {
        ok: true,
        suite: "saas-functional",
        steps: suite.map((step) => step.name),
        durationMs
      },
      null,
      2
    )
  );
}

try {
  main();
} catch (error) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        suite: "saas-functional",
        error: error instanceof Error ? error.message : String(error)
      },
      null,
      2
    )
  );
  process.exit(1);
}
