# Cloudflare Workers 部署指南

通过 **Cloudflare Dashboard 直连 GitHub** 部署。无需 GitHub Secrets。

## 步骤

1. 登录 https://dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git
2. 授权 GitHub，选择 qwerrrtttyyy/mapgen 仓库
3. 配置：
   - Project name: `mapgen`
   - Production branch: `main`
   - Framework preset: `Vite`
   - Build command: `bun run build`（失败则改 `npm install && npm run build`）
   - Build output directory: `packages/web/dist`
4. Save and Deploy
5. 获得 `https://mapgen.<subdomain>.workers.dev` 地址

后续 push to main 自动部署，PR 分支自动生成预览 URL。

## 本地预览

\`\`\`bash
bun run preview:cloudflare  # build + wrangler dev (本地 8787 端口)
\`\`\`

## 相关文件

- \`wrangler.toml\` — Cloudflare 配置（本地预览用）
- \`packages/web/vite.config.ts\` — Vite 构建配置
