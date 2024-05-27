// import { PostHog } from "posthog-node";
// const PostHog = require('./test.ts').default;
// const PostHog = require('posthog-node').default;;
const { PostHog } = require('posthog-node');

const posthog = new PostHog('phc_pQ70jJhZKHRvDIL5ruOErnPy6xiAiWCqlL4ayELj4X8', {
    // flushAt: 1,
    // flushInterval: 0
  })

// posthog.on("error", (args: []) => {
//     console.error("PostHog error:", args);
// });

// posthog.on("flush", (messages: []) => {
//     messages.forEach((message: { event: string }) => {
//         console.log("Event name: flush", message.event);
//     });
//     console.info("PostHog flush:", messages);
// });

async function sendEvent() {
    posthog.capture({
        distinctId: 'test',
        event: 'test-event'
    })

    await posthog.flush()
}
