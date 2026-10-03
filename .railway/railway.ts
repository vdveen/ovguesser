// Railway configuration for the OVGuesser app service (replaces railway.json).
// Railway doesn't read this file during deploys. Apply changes with:
//   railway config plan    (preview, read-only)
//   railway config apply
// This is a named partial: it manages only the ovguesser service. The Postgres
// database and its volume stay under dashboard control, so nothing in this file
// can delete them.
import { defineRailway, github, preserve, project, service } from "railway/iac";

export const partial = "ovguesser";

export default defineRailway(() => {
  const ovguesser = service("ovguesser", {
    // Deploys on every push to main, after the GitHub checks pass.
    source: github("vdveen/ovguesser", { branch: "main", checkSuites: true }),
    build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    start: "node dist/server/main.js",
    healthcheck: "/healthz",
    healthcheckTimeout: 60,
    // Restart policy type is Railway's default (ON_FAILURE); only the retry count is set here.
    deploy: {
      restartPolicyMaxRetries: 5,
      limitOverride: { containers: { cpu: 3, memoryBytes: 4_000_000_000 } },
    },
    replicas: { "europe-west4-drams3a": 1 },
    domains: ["ovguesser.nl", "ovguesser.com"],
    // Values stay in Railway. DATABASE_URL references the Postgres service.
    env: { CANONICAL_HOST: preserve(), DATABASE_URL: preserve(), PORT: preserve(), REDIRECT_HOSTS: preserve() },
  });

  return project("ovguesser", { resources: [ovguesser] });
});
