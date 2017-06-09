function handlePushEvent(event) {
  const DEFAULT_TAG = 'web-push-demo'
  return Promise.resolve()
  .then(() => {
    return event.data.json();
  })
  .then((data) => {
    const title = data.notification.title;
    const options = data.notification;
    if (!options.tag) {
      options.tag = DEFAULT_TAG;
    }
    return registration.showNotification(title, options);
  })
  .catch((err) => {
    console.error('Push event caused an error: ', err);

    const title = 'Message Received';
    const options = {
      body: event.data.text(),
      tag: DEFAULT_TAG
    };
    return registration.showNotification(title, options);
  });
}

self.addEventListener('push', function(event) {
  event.waitUntil(handlePushEvent(event));
});

const doSomething = () => {
  return Promise.resolve();
};

self.addEventListener('notificationclick', function(event) {
  const clickedNotification = event.notification;
  clickedNotification.close();
  if(event.action === 'archive') {
    clients.openWindow('/admin.html')
  }else if(event.action === 'like') {
    clients.openWindow('/index.html')
  }else{
    clients.openWindow('/index.html')
  }

  const promiseChain = doSomething();
  event.waitUntil(promiseChain);
});
