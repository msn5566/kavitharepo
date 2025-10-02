import { Server } from "@modelcontextprotocol/sdk/server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/stdio";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types";
import { exec } from "child_process";

function runCommand(cmd, cwd = ".") {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd }, (error, stdout, stderr) => {
      if (error) reject(stderr || error.message);
      else resolve(stdout);
    });
  });
}

async function snykScan(repoPath) {
  try {
    const output = await runCommand("snyk test --json", repoPath);
    const result = JSON.parse(output);

    if (!result.vulnerabilities || result.vulnerabilities.length === 0) {
      return "✅ No vulnerabilities found";
    }

    return result.vulnerabilities
      .map(
        (v) =>
          `- [${v.severity.toUpperCase()}] ${v.title} in ${v.from.join(" > ")}\n  Fix: ${
            v.fix?.upgradePaths?.[0]?.path?.join(" → ") || "N/A"
          }`
      )
      .join("\n");
  } catch (err) {
    return `❌ Error during scan: ${err}`;
  }
}

const server = new Server(
  { name: "snyk-server", version: "3.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  const repoPath = args.repoPath || ".";
  const baseBranch = args.baseBranch || "main";
  const newBranch = args.newBranch || "snyk-fix-branch";

  if (name === "checkVulnerabilities") {
    const summary = await snykScan(repoPath);
    return { content: [{ type: "text", text: `Snyk scan results:\n\n${summary}` }] };
  }

  if (name === "fixVulnerabilities") {
    try {
      const fixOutput = await runCommand("snyk fix", repoPath);
      const summary = await snykScan(repoPath);

      return {
        content: [
          {
            type: "text",
            text: `🛠️ Snyk auto-fix completed:\n${fixOutput}\n\n🔍 Post-fix scan:\n${summary}`,
          },
        ],
      };
    } catch (err) {
      return { content: [{ type: "text", text: `❌ Fix failed: ${err}` }] };
    }
  }

  if (name === "fixAndPR") {
    try {
      const fixOutput = await runCommand("snyk fix", repoPath);
      const summary = await snykScan(repoPath);

      if (summary.includes("✅ No vulnerabilities")) {
        await runCommand(`git checkout ${baseBranch}`, repoPath);
        await runCommand(`git pull origin ${baseBranch}`, repoPath);
        await runCommand(`git checkout -b ${newBranch}`, repoPath);
        await runCommand(`git add .`, repoPath);
        await runCommand(`git commit -m "fix: snyk auto-fix applied"`, repoPath);
        await runCommand(`git push origin ${newBranch}`, repoPath);

        // Create PR with GitHub CLI
        const prOutput = await runCommand(
          `gh pr create --base ${baseBranch} --head ${newBranch} --title "Snyk Auto-Fix" --body "This PR contains automatic dependency upgrades from Snyk fix"`,
          repoPath
        );

        return {
          content: [
            {
              type: "text",
              text: `🛠️ Snyk auto-fix completed:\n${fixOutput}\n\n✅ Fix committed and PR created:\n${prOutput}`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: `⚠️ Snyk fix applied, but some vulnerabilities remain:\n${summary}`,
            },
          ],
        };
      }
    } catch (err) {
      return { content: [{ type: "text", text: `❌ Fix+PR failed: ${err}` }] };
    }
  }

  return { content: [{ type: "text", text: "❌ Unknown tool" }] };
});

server.connect(new StdioServerTransport());
