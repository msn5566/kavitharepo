import { Server } from "@modelcontextprotocol/sdk/server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/stdio";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types";
import { exec } from "child_process";

const server = new Server(
  { name: "snyk-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name === "checkVulnerabilities") {
    const repoPath = req.params.arguments.repoPath || ".";

    return new Promise((resolve) => {
      exec(`cd ${repoPath} && snyk test --json`, (error, stdout, stderr) => {
        if (error) {
          resolve({
            content: [
              {
                type: "text",
                text: `❌ Failed to run Snyk: ${stderr || error.message}`,
              },
            ],
          });
          return;
        }

        try {
          const result = JSON.parse(stdout);

          // Summarize vulnerabilities
          const summary = result.vulnerabilities
            ? result.vulnerabilities
                .map(
                  (v) =>
                    `- [${v.severity.toUpperCase()}] ${v.title} in ${v.from.join(
                      " > "
                    )} (Upgrade: ${v.fix?.upgradePaths?.[0]?.path?.join(" → ") || "N/A"})`
                )
                .join("\n")
            : "✅ No vulnerabilities found";

          resolve({
            content: [
              {
                type: "text",
                text: `Snyk scan completed:\n\n${summary}`,
              },
            ],
          });
        } catch (e) {
          resolve({
            content: [
              { type: "text", text: `⚠️ Could not parse Snyk output: ${stdout}` },
            ],
          });
        }
      });
    });
  }

  return { content: [{ type: "text", text: "❌ Unknown tool" }] };
});

server.connect(new StdioServerTransport());
