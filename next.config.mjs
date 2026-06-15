/** @type {import('next').NextConfig} */
const nextConfig = {
  // @huggingface/transformers and pdf-parse are server-only native-ish deps;
  // keep them external so Next doesn't try to bundle them into serverless output.
  serverExternalPackages: ["@huggingface/transformers", "pdf-parse"],
};

export default nextConfig;
