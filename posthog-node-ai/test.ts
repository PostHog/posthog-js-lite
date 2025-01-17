import OpenAI from './index';
import { PostHog } from 'posthog-node';

// Initialize PostHog client
const phClient = new PostHog(
  process.env.POSTHOG_API_KEY || 'your_api_key_here',
  { host: process.env.POSTHOG_HOST || 'http://localhost:8000' }
);

// Initialize the monitoring wrapper
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
  posthog: phClient,
});

async function test() {
  try {
    // Use the wrapped client with monitoring parameters
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello, world!' }],
      // Add monitoring parameters
      posthog_distinct_id: 'test-user-id',
      posthog_properties: {
        test_property: 'test_value'
      }
    });

    console.log(response);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Clean up PostHog client when done
    await phClient.shutdown();
  }
}

test();
