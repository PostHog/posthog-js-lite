import { PostHog } from 'posthog-node'

const posthog = new PostHog('phc_pQ70jJhZKHRvDIL5ruOErnPy6xiAiWCqlL4ayELj4X8', {
  flushAt: 1,
  flushInterval: 0
})
posthog.debug(true)

function delay(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) );
}

async function main() {

//   posthog.on("error", (...args) => {
//     console.error("PostHog error:", args);
//   });

//   posthog.on("flush", (messages) => {
//     messages.forEach((message: { event: string }) => {
//       console.log("Event name: flush", message.event);
//     });
//     console.info("PostHog flush:", messages);
//   });

  for (let i = 100; i < 200; i++) {
    posthog.capture({
      distinctId: 'dis ' + i,
      event: 'test-event ' + i,
    })
  }

  // 3s
  posthog.capture({
    distinctId: '123',
    event: '$screen',
    properties: {
      $screen_name: 'ScreenASession1',
      $session_id: '1'
    },
  })

  // should not interfer because another session
  posthog.capture({
    distinctId: '123',
    event: 'Application Backgrounded',
    properties: {
      $session_id: '2'
    },
  })

  await delay(3000);

  // 5s
  posthog.capture({
    distinctId: '123',
    event: '$screen',
    properties: {
      $screen_name: 'ScreenBSession1',
      $session_id: '1'
    },
  })

  // should not interfer because another user
  posthog.capture({
    distinctId: '234',
    event: '$screen',
    properties: {
      $screen_name: 'ScreenBSession1',
      $session_id: '1'
    },
  })

  await delay(5000);

  posthog.capture({
    distinctId: '123',
    event: 'Application Backgrounded',
    properties: {
      $session_id: '1'
    },
  })

  await delay(2000);


  // should not appear because no next event nor next backgrounded
  posthog.capture({
    distinctId: '123',
    event: '$screen',
    properties: {
      $screen_name: 'ScreenCSession1',
      $session_id: '1'
    },
  })

  await delay(2000);

  await posthog.flush()
  await posthog.shutdown()
}

main().then(() => {
  console.log('done')
})
