import { startMergeProxyServer } from "../src/server/mergeProxy";

const port = Number(process.env.PORT || process.env.TOKSCALE_MERGE_PROXY_PORT || "3456");

startMergeProxyServer(port)
  .then(() => {
    console.log(`Tokscale merge proxy listening on http://localhost:${port}`);
  })
  .catch((error) => {
    console.error("Failed to start merge proxy", error);
    process.exit(1);
  });
