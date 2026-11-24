# Codex setup — Salon Queue Management System

This package is prepared for OpenAI Codex. The three requirement documents are retained from the original project specification; `AGENTS.md` contains the repository instructions Codex should follow.

## Recommended: ChatGPT desktop app (Windows)

1. Install or update the official ChatGPT desktop app for Windows.
2. Open the app and choose **Codex** mode.
3. Choose **Add new project** (or press `Ctrl+O`) and select the extracted `salon-queue-codex` folder.
4. Confirm the project is open in Codex. Do not use a regular ChatGPT chat with pasted files; Codex needs the local folder as its working project.
5. Start a new Codex task and paste **Prompt 1** from `CODEX_START_PROMPTS.md`.
6. Review its initial discovery summary. Then give it the next phase prompt only after the initial plan is sound.

The Windows app runs Codex natively with PowerShell by default. For a smooth React/Vite workflow, have Git and Node.js LTS installed. The official Windows guide lists both as useful developer tools.

Codex can also be used through the VS Code IDE extension or its CLI. The selected folder/workspace is the local project context. Codex CLI should be launched from this repository root so it can discover the root `AGENTS.md`.

## Optional: Codex CLI on Windows

If you prefer a terminal workflow:

1. Install Node.js if it is not already installed.
2. Open PowerShell in this extracted folder.
3. Install Codex CLI:

   ```powershell
   npm install -g @openai/codex@latest
   ```

4. Launch it from the project root:

   ```powershell
   codex
   ```

5. Sign in with your ChatGPT account when prompted.
6. Paste Prompt 1 from `CODEX_START_PROMPTS.md`.

Official setup instructions:
- Windows desktop app: https://learn.chatgpt.com/docs/windows/windows-app
- Codex CLI: https://learn.chatgpt.com/docs/codex/cli
- Codex with your ChatGPT plan: https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan

## How Codex uses AGENTS.md

Codex reads applicable `AGENTS.md` instructions when it starts a task/session. Start Codex from this project folder or open this folder as the project in the IDE/desktop app. If you move the project or start Codex from a different directory, check that the correct repository root is selected. Official guidance: https://learn.chatgpt.com/docs/agent-configuration/agents-md

## Important project constraints

- The requirements intentionally prioritize a working prototype over a production system.
- Do not enter real customer data.
- A local browser-storage fallback does not provide synchronization between different devices.
- Do not spend the three-hour lab building a complex backend. Choose the simplest persistence mode that can honestly support the required demo.
