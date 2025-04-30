# 4.3.0

- Remove fullDebug mode
- Add posthogCaptureImmediate to await an promise for each capture (for serverless enviroments)

# 4.2.1

- Add fullDebug mode and limit full size of event input

# 4.1.0

- add truncation to vercel ai sdk inputs and outputs

# 4.0.1

- add new util to sanitize inputs, outputs and errors

# 4.0.0

- feat: separate out packages as separate exports so you can import { OpenAI } from @posthog/ai/openai and reduce import size

# 3.3.2 - 2025-03-25

- fix: langchain name mapping

# 3.3.1 - 2025-03-13

- fix: fix vercel output mapping and token caching

# 3.3.0 - 2025-03-08

- feat: add reasoning and cache tokens to openai and anthropic
- feat: add tool support for vercel
- feat: add support for other media types vercel

# 3.2.1 - 2025-02-11

- fix: add experimental_wrapLanguageModel to vercel middleware supporting older versions of ai

# 3.2.0 - 2025-02-11

- feat: change how we handle streaming support for openai and anthropic

# 3.1.1 - 2025-02-07

- fix: bump ai to 4.1.0

# 3.1.0 - 2025-02-07

- feat: add posthogCostOverride, posthogModelOverride, and posthogProviderOverride to sendEventToPosthog for vercel

# 2.4.0 - 2025-02-03

- feat: add anthropic support for sdk
